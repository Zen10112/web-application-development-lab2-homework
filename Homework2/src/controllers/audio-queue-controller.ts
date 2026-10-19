
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
  cleanup: () => void;
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
  private activeTask: AudioTask | null = null;
  private disposed = false;

  constructor(
    private readonly audioContext: AudioContext,
    private readonly loadTrack: TrackLoader =
      AudioTaskQueue.defaultTrackLoader
  ) {}

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

    // decodeAudioData cannot be aborted directly.
    const buffer = await audioContext.decodeAudioData(
      arrayBuffer
    );

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
    task.cleanup();
    task.resolve(buffer);
  }

  private rejectTask(
    task: AudioTask,
    reason: unknown
  ): void {
    if (task.settled) return;

    task.settled = true;
    task.cleanup();
    task.reject(reason);
  }

  private cancelTask(task: AudioTask): void {
    if (task.settled) return;

    // Abort the task's fetch operation.
    task.controller.abort();

    // Remove it if it has not started processing.
    const index = this.queue.indexOf(task);

    if (index !== -1) {
      this.queue.splice(index, 1);
    }

    // Reject immediately, even if decoding is still running.
    this.rejectTask(task, createAbortError());
  }

  public enqueue(
    trackUrl: string,
    signal?: AbortSignal
  ): Promise<AudioBuffer> {
    if (this.disposed) {
      return Promise.reject(
        new Error("Queue has been disposed")
      );
    }

    if (signal?.aborted) {
      return Promise.reject(createAbortError());
    }

    const controller = new AbortController();

    return new Promise<AudioBuffer>((resolve, reject) => {
      const task: AudioTask = {
        trackUrl,
        controller,
        settled: false,
        resolve,
        reject,
        cleanup: () => {},
      };

      if (signal) {
        const onAbort = () => {
          this.cancelTask(task);
        };

        signal.addEventListener("abort", onAbort, {
          once: true,
        });

        task.cleanup = () => {
          signal.removeEventListener("abort", onAbort);
        };
      }

      this.queue.push(task);

      // Handle a signal aborted during registration.
      if (signal?.aborted) {
        this.cancelTask(task);
        return;
      }

      void this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.disposed) {
      return;
    }

    // Lock before the first await.
    this.isProcessing = true;

    try {
      while (!this.disposed && this.queue.length > 0) {
        const task = this.queue.shift();

        if (!task || task.settled) {
          continue;
        }

        this.activeTask = task;

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
          }
        }
      }
    } finally {
      this.isProcessing = false;

      if (!this.disposed && this.queue.length > 0) {
        void this.processNext();
      }
    }
  }

  // Global cancellation, used only when explicitly required.
  public cancelAll(): void {
    if (this.activeTask) {
      this.cancelTask(this.activeTask);
    }

    const waiting = [...this.queue];

    for (const task of waiting) {
      this.cancelTask(task);
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
