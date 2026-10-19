import { describe, expect, it } from "vitest";
import { AudioTaskQueue, type TrackLoader } from "./audio-queue-controller";

const fakeAudioContext = {} as AudioContext;
const fakeBuffer = {} as AudioBuffer;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

describe("AudioTaskQueue", () => {
  it("handles tasks in strict FIFO order", async () => {
    const events: string[] = [];
    const loader: TrackLoader = async url => {
      events.push(`start:${url}`);
      await sleep(url === "A" ? 25 : 5);
      events.push(`end:${url}`);
      return fakeBuffer;
    };
    const queue = new AudioTaskQueue(fakeAudioContext, loader);
    await Promise.all([queue.enqueue("A"), queue.enqueue("B"), queue.enqueue("C")]);
    expect(events).toEqual(["start:A", "end:A", "start:B", "end:B", "start:C", "end:C"]);
    queue.dispose();
  });

  it("runs at most one worker at a time", async () => {
    let active = 0;
    let maxActive = 0;
    const loader: TrackLoader = async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      try { await sleep(5); return fakeBuffer; }
      finally { active--; }
    };
    const queue = new AudioTaskQueue(fakeAudioContext, loader);
    await Promise.all(Array.from({ length: 10 }, (_, i) => queue.enqueue(`track-${i}`)));
    expect(maxActive).toBe(1);
    queue.dispose();
  });

  it("keeps processing after a failure", async () => {
    const events: string[] = [];
    const loader: TrackLoader = async url => {
      events.push(url);
      if (url === "B") throw new Error("Decode failed");
      return fakeBuffer;
    };
    const queue = new AudioTaskQueue(fakeAudioContext, loader);
    const results = await Promise.allSettled([
      queue.enqueue("A"), queue.enqueue("B"), queue.enqueue("C")
    ]);
    expect(results.map(result => result.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
    expect(events).toEqual(["A", "B", "C"]);
    queue.dispose();
  });

  it("rejects cancelled active and queued tasks", async () => {
    let releaseFirst!: () => void;
    const gate = new Promise<void>(resolve => { releaseFirst = resolve; });
    const loader: TrackLoader = async url => {
      if (url === "A") await gate;
      return fakeBuffer;
    };
    const queue = new AudioTaskQueue(fakeAudioContext, loader);
    const tasks = [queue.enqueue("A"), queue.enqueue("B"), queue.enqueue("C")];
    queue.cancelAll();
    releaseFirst();
    const results = await Promise.allSettled(tasks);
    expect(results.every(result => result.status === "rejected")).toBe(true);
    queue.dispose();
  });

  
it("rejects an active task immediately when cancelled", async () => {
  let releaseDecode!: () => void;

  const decoding = new Promise<void>((resolve) => {
    releaseDecode = resolve;
  });

  const loader: TrackLoader = async () => {
    await decoding;
    return fakeBuffer;
  };

  const queue = new AudioTaskQueue(
    fakeAudioContext,
    loader
  );

  const result = queue.enqueue("track-a").then(
    () => "fulfilled",
    () => "rejected"
  );

  queue.cancelAll();

  expect(await result).toBe("rejected");

  // Allow underlying decode simulation to finish.
  releaseDecode();

  queue.dispose();
});

it("processes the next track after a failed download", async () => {
  const processed: string[] = [];

  const loader: TrackLoader = async (url) => {
    processed.push(url);

    if (url === "track-b") {
      throw new Error("HTTP 404");
    }

    return fakeBuffer;
  };

  const queue = new AudioTaskQueue(
    fakeAudioContext,
    loader
  );

  const results = await Promise.allSettled([
    queue.enqueue("track-a"),
    queue.enqueue("track-b"),
    queue.enqueue("track-c"),
  ]);

  expect(results.map((result) => result.status)).toEqual([
    "fulfilled",
    "rejected",
    "fulfilled",
  ]);

  expect(processed).toEqual([
    "track-a",
    "track-b",
    "track-c",
  ]);

  queue.dispose();
});

});
