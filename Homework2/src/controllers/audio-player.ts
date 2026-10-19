
import { AudioTaskQueue } from "./audio-queue-controller";

export class AudioPlayer {
  private source: AudioBufferSourceNode | null = null;
  private requestVersion = 0;
  private disposed = false;

  constructor(
    private readonly audioContext: AudioContext,
    private readonly queue: AudioTaskQueue
  ) {}

  public async play(trackUrl: string): Promise<void> {
    if (this.disposed) {
      throw new Error("Player has been disposed");
    }

    // Invalidate older playback requests.
    this.stop();

    const version = this.requestVersion;

    // Must be initiated through a user action.
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    if (version !== this.requestVersion || this.disposed) {
      return;
    }

    if (this.audioContext.state !== "running") {
      throw new Error("AudioContext is not running");
    }

    // FIFO Queue handles fetch + decode.
    const buffer = await this.queue.enqueue(trackUrl);

    // Ignore outdated requests.
    if (version !== this.requestVersion || this.disposed) {
      return;
    }

    const source = this.audioContext.createBufferSource();

    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    source.onended = () => {
      source.disconnect();

      if (this.source === source) {
        this.source = null;
      }
    };

    this.source = source;

    try {
      // start() is called exactly once per source.
      source.start(0);
    } catch (error) {
      this.source = null;
      source.onended = null;
      source.disconnect();
      throw error;
    }
  }

  public stop(): void {
    // Prevent an old async play() from starting later.
    this.requestVersion++;

    // Reject pending downloads and abort active fetch.
    this.queue.cancelAll();

    const current = this.source;
    this.source = null;

    if (current) {
      current.onended = null;

      try {
        current.stop();
      } catch {
        // Source may already have stopped.
      }

      current.disconnect();
    }
  }

  public async next(trackUrl: string): Promise<void> {
    await this.play(trackUrl);
  }

  public getIsPlaying(): boolean {
    return this.source !== null;
  }

  public dispose(): void {
    if (this.disposed) return;

    this.stop();
    this.disposed = true;
  }
}
