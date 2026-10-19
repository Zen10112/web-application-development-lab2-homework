
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createAntiDriftTimer } from "./anti-drift-timer";

describe("createAntiDriftTimer", () => {
  let frames: Map<number, FrameRequestCallback>;
  let nextFrameId: number;

  const runFrame = () => {
    const callbacks = [...frames.values()];
    frames.clear();

    callbacks.forEach((callback) => {
      callback(performance.now());
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();

    frames = new Map();
    nextFrameId = 1;

    vi.stubGlobal(
      "requestAnimationFrame",
      (callback: FrameRequestCallback) => {
        const id = nextFrameId++;
        frames.set(id, callback);
        return id;
      }
    );

    vi.stubGlobal(
      "cancelAnimationFrame",
      (id: number) => {
        frames.delete(id);
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("calculates remaining time correctly", () => {
    const onTick = vi.fn();

    const stop = createAntiDriftTimer(10000, onTick);

    vi.setSystemTime(Date.now() + 3000);
    runFrame();

    expect(onTick).toHaveBeenLastCalledWith(7000);

    stop();
  });

  it("does not accumulate drift after lag", () => {
    const onTick = vi.fn();

    const stop = createAntiDriftTimer(10000, onTick);

    // Simulate a frame delayed by 7 seconds
    vi.setSystemTime(Date.now() + 7000);
    runFrame();

    expect(onTick).toHaveBeenLastCalledWith(3000);

    stop();
  });

  it("stops at zero exactly once", () => {
    const onTick = vi.fn();

    createAntiDriftTimer(1000, onTick);

    vi.setSystemTime(Date.now() + 2000);
    runFrame();
    runFrame();

    expect(onTick).toHaveBeenLastCalledWith(0);

    expect(
      onTick.mock.calls.filter(([value]) => value === 0)
    ).toHaveLength(1);
  });

  it("supports zero duration", () => {
    const onTick = vi.fn();

    createAntiDriftTimer(0, onTick);

    expect(onTick).toHaveBeenCalledExactlyOnceWith(0);
    expect(frames.size).toBe(0);
  });

  it("cancels pending animation frames", () => {
    const onTick = vi.fn();

    const stop = createAntiDriftTimer(5000, onTick);
    const callCount = onTick.mock.calls.length;

    stop();
    vi.setSystemTime(Date.now() + 1000);
    runFrame();

    expect(onTick).toHaveBeenCalledTimes(callCount);
    expect(frames.size).toBe(0);
  });

  it("rejects invalid durations", () => {
    expect(() =>
      createAntiDriftTimer(-1, () => {})
    ).toThrow(RangeError);

    expect(() =>
      createAntiDriftTimer(Infinity, () => {})
    ).toThrow(RangeError);

    expect(() =>
      createAntiDriftTimer(NaN, () => {})
    ).toThrow(RangeError);
  });
});
