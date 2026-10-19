
import { describe, expect, it, vi } from "vitest";
import { AudioPlayer } from "./audio-player";
import { AudioTaskQueue } from "./audio-queue-controller";

function createFixture() {
  const source = {
    buffer: null as AudioBuffer | null,
    onended: null as (() => void) | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };

  const analyser = {
    fftSize: 256,
    smoothingTimeConstant: 0,
    minDecibels: -90,
    maxDecibels: -10,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const context = {
    state: "running",
    destination: {},
    resume: vi.fn(async () => {}),
    createAnalyser: vi.fn(() => analyser),
    createBufferSource: vi.fn(() => source),
  } as unknown as AudioContext;

  const queue = {
    enqueue: vi.fn(async () => ({} as AudioBuffer)),
    cancelAll: vi.fn(),
  } as unknown as AudioTaskQueue;

  const player = new AudioPlayer(context, queue);

  return {
    player,
    source,
    analyser,
    context,
    queue,
  };
}

describe("AudioPlayer", () => {
  it("creates and starts a source once", async () => {
    const { player, source, queue } = createFixture();

    await player.play("/audio/track-a.mp3");

    expect(queue.enqueue).toHaveBeenCalledWith(
      "/audio/track-a.mp3",
      expect.any(AbortSignal)
    );

    expect(source.start).toHaveBeenCalledTimes(1);
    expect(source.connect).toHaveBeenCalledTimes(1);

    player.dispose();
  });

  it("stops and disconnects its active source", async () => {
    const { player, source } = createFixture();

    await player.play("/audio/track-a.mp3");

    player.stop();

    expect(source.stop).toHaveBeenCalledTimes(1);
    expect(source.disconnect).toHaveBeenCalled();
    expect(player.getIsPlaying()).toBe(false);

    player.dispose();
  });

  it("does not globally cancel the shared queue", async () => {
    const { player, queue } = createFixture();

    await player.play("/audio/track-a.mp3");

    player.stop();

    expect(queue.cancelAll).not.toHaveBeenCalled();

    player.dispose();
  });

  it("disconnects analyser on dispose", () => {
    const { player, analyser } = createFixture();

    player.dispose();

    expect(analyser.disconnect).toHaveBeenCalledTimes(1);
  });

  it("supports FFT 256 and 512", () => {
    const { player, analyser } = createFixture();

    player.setFFTSize(512);
    expect(analyser.fftSize).toBe(512);

    player.setFFTSize(256);
    expect(analyser.fftSize).toBe(256);

    player.dispose();
  });

  it("resumes suspended AudioContext", async () => {
    const { player, context } = createFixture();

    Object.defineProperty(context, "state", {
      value: "suspended",
      configurable: true,
      writable: true,
    });

    vi.mocked(context.resume).mockImplementation(async () => {
      Object.defineProperty(context, "state", {
        value: "running",
        configurable: true,
        writable: true,
      });
    });

    await player.play("/audio/track-a.mp3");

    expect(context.resume).toHaveBeenCalledTimes(1);

    player.dispose();
  });

  it("ignores end callback after manual Stop", async () => {
    const { player, source } = createFixture();

    const onEnded = vi.fn();

    await player.play("/audio/track-a.mp3", onEnded);

    const oldCallback = source.onended;

    player.stop();

    // Simulate a late event from an old source.
    oldCallback?.();

    expect(onEnded).not.toHaveBeenCalled();

    player.dispose();
  });
});
