
export type TrackLoader = (
  trackUrl: string,
  signal: AbortSignal,
  audioContext: AudioContext
) => Promise<AudioBuffer>;

interface AudioTask {
  trackUrl: string;
  controller: AbortController;
  settled: boolean;
  resolve: (buffer: AudioBuffer) => void;
  reject: (reason: unknown) => void;
}

export function createAbortError(): DOMException {
  return new DOMException(
    "Audio task was cancelled",
    "AbortError"
  );
}

export class AudioTaskQueue {
  private queue: AudioTask[] = [];
  private isProcessing = false;
  private activeController: AbortController | null = null;
  private activeTask: AudioTask | null = null;
  private disposed = false;

  constructor(
    private readonly audioContext: AudioContext,
    private readonly loadTrack: TrackLoader =
      AudioTaskQueue.defaultTrackLoader
  ) {}

  // Download audio and decode it into AudioBuffer.
  private static async defaultTrackLoader(
    trackUrl: string,
    signal: AbortSignal,
    audioContext: AudioContext
  ): Promise<AudioBuffer> {
    if (signal.aborted) {
      throw createAbortError();
    }

    const response = await fetch(trackUrl, { signal });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${trackUrl}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    if (signal.aborted) {
      throw createAbortError();
    }

    // decodeAudioData cannot be directly aborted.
    const buffer = await audioContext.decodeAudioData(
      arrayBuffer
    );

    // Cancellation could happen during decoding.
    if (signal.aborted) {
      throw createAbortError();
    }

    return buffer;
  }

  private resolveTask(
    task: AudioTask,
    buffer: AudioBuffer
  ): void {
    if (task.settled) return;

    task.settled = true;
    task.resolve(buffer);
  }

  private rejectTask(
    task: AudioTask,
    reason: unknown
  ): void {
    if (task.settled) return;

    task.settled = true;
    task.reject(reason);
  }

  public enqueue(
    trackUrl: string
  ): Promise<AudioBuffer> {
    if (this.disposed) {
      return Promise.reject(
        new Error("Queue has been disposed")
      );
    }

    const controller = new AbortController();

    return new Promise<AudioBuffer>((resolve, reject) => {
      const task: AudioTask = {
        trackUrl,
        controller,
        settled: false,
        resolve,
        reject,
      };

      this.queue.push(task);

      // The processing flag prevents multiple workers.
      void this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.disposed) {
      return;
    }

    // Set synchronously before the first await.
    this.isProcessing = true;

    try {
      while (!this.disposed && this.queue.length > 0) {
        const task = this.queue.shift();

        if (!task) continue;

        this.activeTask = task;
        this.activeController = task.controller;

        try {
          if (task.controller.signal.aborted) {
            throw createAbortError();
          }

          const buffer = await this.loadTrack(
            task.trackUrl,
            task.controller.signal,
            this.audioContext
          );

          if (task.controller.signal.aborted) {
            throw createAbortError();
          }

          this.resolveTask(task, buffer);
        } catch (error) {
          this.rejectTask(task, error);
        } finally {
          if (this.activeTask === task) {
            this.activeTask = null;
            this.activeController = null;
          }
        }
      }
    } finally {
      this.isProcessing = false;

      // Defensive recovery if a new task was queued.
      if (!this.disposed && this.queue.length > 0) {
        void this.processNext();
      }
    }
  }

  // Immediately reject promises and abort active fetch.
  public cancelAll(): void {
    if (this.activeTask) {
      this.activeController?.abort();

      this.rejectTask(
        this.activeTask,
        createAbortError()
      );
    }

    const pendingTasks = this.queue.splice(0);

    for (const task of pendingTasks) {
      task.controller.abort();

      this.rejectTask(
        task,
        createAbortError()
      );
    }
  }

  public dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.cancelAll();
  }

  public getPendingCount(): number {
    return this.queue.length;
  }

  public getIsProcessing(): boolean {
    return this.isProcessing;
  }
}
