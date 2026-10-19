
import { AudioTaskQueue } from "./audio-queue-controller";

export class AudioPlayer {
  private source: AudioBufferSourceNode | null = null;
  private analyser: AnalyserNode;

  private playbackController: AbortController | null = null;
  private requestVersion = 0;
  private disposed = false;

  public onPlaybackEnded: (() => void) | null = null;

  constructor(
    private readonly audioContext: AudioContext,
    private readonly queue: AudioTaskQueue
  ) {
    this.analyser = audioContext.createAnalyser();

    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;

    this.analyser.connect(audioContext.destination);
  }

  public getAnalyser(): AnalyserNode {
    return this.analyser;
  }

  public setFFTSize(size: 256 | 512): void {
    this.analyser.fftSize = size;
  }

  public async play(
    trackUrl: string,
    onEnded?: () => void
  ): Promise<void> {
    if (this.disposed) {
      throw new Error("AudioPlayer has been disposed");
    }

    // Stop the previous playback request only.
    this.stop();

    const version = this.requestVersion;

    const controller = new AbortController();
    this.playbackController = controller;

    try {
      // Resume within a user-initiated playback request.
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      if (
        controller.signal.aborted ||
        version !== this.requestVersion ||
        this.disposed
      ) {
        return;
      }

      if (this.audioContext.state !== "running") {
        throw new Error("AudioContext is not running");
      }

      // Cancellation belongs only to this playback task.
      const buffer = await this.queue.enqueue(
        trackUrl,
        controller.signal
      );

      if (
        controller.signal.aborted ||
        version !== this.requestVersion ||
        this.disposed
      ) {
        return;
      }

      const source = this.audioContext.createBufferSource();

      source.buffer = buffer;
      source.connect(this.analyser);

      source.onended = () => {
        source.onended = null;
        source.disconnect();

        if (this.source !== source) {
          return;
        }

        this.source = null;

        if (
          !this.disposed &&
          version === this.requestVersion
        ) {
          onEnded?.();
          this.onPlaybackEnded?.();
        }
      };

      this.source = source;

      try {
        // Each source node starts exactly once.
        source.start(0);
      } catch (error) {
        source.onended = null;
        source.disconnect();

        if (this.source === source) {
          this.source = null;
        }

        throw error;
      }
    } finally {
      if (this.playbackController === controller) {
        this.playbackController = null;
      }
    }
  }

  public stop(): void {
    // Invalidates old async requests and callbacks.
    this.requestVersion++;

    // Only abort this player's request.
    this.playbackController?.abort();
    this.playbackController = null;

    const current = this.source;
    this.source = null;

    if (!current) return;

    current.onended = null;

    try {
      current.stop();
    } catch {
      // The source may already have stopped.
    }

    current.disconnect();
  }

  public async next(
    trackUrl: string,
    onEnded?: () => void
  ): Promise<void> {
    await this.play(trackUrl, onEnded);
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
