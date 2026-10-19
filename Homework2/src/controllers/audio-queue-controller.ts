export type TrackLoader = (
  trackUrl: string,
  signal: AbortSignal,
  audioContext: AudioContext
) => Promise<AudioBuffer>;

interface AudioTask {
  trackUrl: string;
  controller: AbortController;
  resolve: (buffer: AudioBuffer) => void;
  reject: (reason: unknown) => void;
}

const abortError = () => new DOMException("Audio task cancelled", "AbortError");

export class AudioTaskQueue {
  private queue: AudioTask[] = [];
  private isProcessing = false;
  private activeController: AbortController | null = null;
  private disposed = false;

  constructor(
    private readonly audioContext: AudioContext,
    private readonly loader: TrackLoader = AudioTaskQueue.defaultLoader
  ) {}

  private static async defaultLoader(
    trackUrl: string,
    signal: AbortSignal,
    audioContext: AudioContext
  ): Promise<AudioBuffer> {
    const response = await fetch(trackUrl, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${trackUrl}`);
    const bytes = await response.arrayBuffer();
    if (signal.aborted) throw abortError();
    // decodeAudioData is not abortable; discard the result after cancellation.
    const buffer = await audioContext.decodeAudioData(bytes);
    if (signal.aborted) throw abortError();
    return buffer;
  }

  public enqueue(trackUrl: string): Promise<AudioBuffer> {
    if (this.disposed) return Promise.reject(new Error("Queue has been disposed"));
    const controller = new AbortController();
    return new Promise<AudioBuffer>((resolve, reject) => {
      this.queue.push({ trackUrl, controller, resolve, reject });
      void this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.disposed) return;
    // Synchronous lock before the first await guarantees one worker.
    this.isProcessing = true;
    try {
      while (!this.disposed && this.queue.length > 0) {
        const task = this.queue.shift();
        if (!task) continue;
        this.activeController = task.controller;
        try {
          if (task.controller.signal.aborted) throw abortError();
          const buffer = await this.loader(
            task.trackUrl, task.controller.signal, this.audioContext
          );
          if (task.controller.signal.aborted) throw abortError();
          task.resolve(buffer);
        } catch (error) {
          task.reject(error);
        } finally {
          this.activeController = null;
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public cancelAll(): void {
    this.activeController?.abort();
    for (const task of this.queue.splice(0)) {
      task.controller.abort();
      task.reject(abortError());
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelAll();
    // The caller owns and closes AudioContext.
  }

  public getPendingCount(): number { return this.queue.length; }
  public getIsProcessing(): boolean { return this.isProcessing; }
}
