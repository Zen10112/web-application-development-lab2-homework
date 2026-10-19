
import { AudioTaskQueue } from "./audio-queue-controller";

export class AudioPlayer {
  private source: AudioBufferSourceNode | null = null;
  private analyser: AnalyserNode;
  private requestVersion = 0;
  private disposed = false;

  // Called when playback finishes naturally.
  public onPlaybackEnded: (() => void) | null = null;

  constructor(
    private readonly audioContext: AudioContext,
    private readonly queue: AudioTaskQueue
  ) {
    // Create one analyser for this player.
    this.analyser = audioContext.createAnalyser();

    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;

    // Connect analyser to speakers once.
    this.analyser.connect(audioContext.destination);
  }

  public getAnalyser(): AnalyserNode {
    return this.analyser;
  }

  public setFFTSize(size: 256 | 512): void {
    this.analyser.fftSize = size;
  }

  public async play(trackUrl: string): Promise<void> {
    if (this.disposed) {
      throw new Error("AudioPlayer has been disposed");
    }

    // Stop previous playback and invalidate old requests.
    this.stop();

    const version = this.requestVersion;

    // Browsers can suspend AudioContext until user interaction.
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    if (
      this.disposed ||
      version !== this.requestVersion
    ) {
      return;
    }

    if (this.audioContext.state !== "running") {
      throw new Error("AudioContext is not running");
    }

    // Queue handles fetching and decoding.
    const buffer = await this.queue.enqueue(trackUrl);

    // Ignore an outdated playback request.
    if (
      this.disposed ||
      version !== this.requestVersion
    ) {
      return;
    }

    // Every play creates a NEW source node.
    const source = this.audioContext.createBufferSource();

    source.buffer = buffer;

    // Audio graph:
    // source -> analyser -> destination
    source.connect(this.analyser);

    source.onended = () => {
      source.onended = null;
      source.disconnect();

      if (this.source === source) {
        this.source = null;

        if (!this.disposed) {
          this.onPlaybackEnded?.();
        }
      }
    };

    this.source = source;

    try {
      // AudioBufferSourceNode.start() only once.
      source.start(0);
    } catch (error) {
      source.onended = null;
      source.disconnect();

      if (this.source === source) {
        this.source = null;
      }

      throw error;
    }
  }

  public stop(): void {
    // Invalidate in-progress async playback requests.
    this.requestVersion++;

    // Abort active fetch and reject waiting queue tasks.
    this.queue.cancelAll();

    const current = this.source;
    this.source = null;

    if (!current) return;

    // Prevent manual stop from firing natural-end callback.
    current.onended = null;

    try {
      current.stop();
    } catch {
      // Source may have already stopped.
    }

    current.disconnect();
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

    this.onPlaybackEnded = null;
    this.analyser.disconnect();
  }
}
