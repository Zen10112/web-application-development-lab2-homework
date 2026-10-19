
import { describe, expect, it } from "vitest";
import {
  AudioTaskQueue,
  type TrackLoader,
} from "./audio-queue-controller";

const fakeContext = {} as AudioContext;
const fakeBuffer = {} as AudioBuffer;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("AudioTaskQueue", () => {
  it("processes tasks in strict FIFO order", async () => {
    const events: string[] = [];

    const loader: TrackLoader = async (url) => {
      events.push(`start:${url}`);
      await sleep(url === "A" ? 25 : 5);
      events.push(`end:${url}`);
      return fakeBuffer;
    };

    const queue = new AudioTaskQueue(fakeContext, loader);

    await Promise.all([
      queue.enqueue("A"),
      queue.enqueue("B"),
      queue.enqueue("C"),
    ]);

    expect(events).toEqual([
      "start:A",
      "end:A",
      "start:B",
      "end:B",
      "start:C",
      "end:C",
    ]);

    queue.dispose();
  });

  it("never executes two loaders simultaneously", async () => {
    let active = 0;
    let maxActive = 0;

    const loader: TrackLoader = async () => {
      active++;
      maxActive = Math.max(maxActive, active);

      try {
        await sleep(5);
        return fakeBuffer;
      } finally {
        active--;
      }
    };

    const queue = new AudioTaskQueue(fakeContext, loader);

    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        queue.enqueue(`track-${index}`)
      )
    );

    expect(maxActive).toBe(1);
    queue.dispose();
  });

  it("continues after a failed download", async () => {
    const processed: string[] = [];

    const loader: TrackLoader = async (url) => {
      processed.push(url);

      if (url === "B") {
        throw new Error("HTTP 404");
      }

      return fakeBuffer;
    };

    const queue = new AudioTaskQueue(fakeContext, loader);

    const results = await Promise.allSettled([
      queue.enqueue("A"),
      queue.enqueue("B"),
      queue.enqueue("C"),
    ]);

    expect(results.map((r) => r.status)).toEqual([
      "fulfilled",
      "rejected",
      "fulfilled",
    ]);

    expect(processed).toEqual(["A", "B", "C"]);

    queue.dispose();
  });

  it("rejects active and waiting tasks on cancelAll", async () => {
    const gate = deferred<void>();

    const loader: TrackLoader = async (url) => {
      if (url === "A") {
        await gate.promise;
      }

      return fakeBuffer;
    };

    const queue = new AudioTaskQueue(fakeContext, loader);

    const tasks = [
      queue.enqueue("A"),
      queue.enqueue("B"),
      queue.enqueue("C"),
    ];

    queue.cancelAll();

    const results = await Promise.allSettled(tasks);

    expect(
      results.every((r) => r.status === "rejected")
    ).toBe(true);

    gate.resolve();
    queue.dispose();
  });

  it("rejects immediately during non-abortable decode", async () => {
    const gate = deferred<AudioBuffer>();

    const loader: TrackLoader = async () => gate.promise;

    const queue = new AudioTaskQueue(fakeContext, loader);

    const result = queue.enqueue("A").then(
      () => "fulfilled",
      () => "rejected"
    );

    queue.cancelAll();

    expect(await result).toBe("rejected");

    gate.resolve(fakeBuffer);
    queue.dispose();
  });

  it("can process new tasks after cancellation", async () => {
    const gate = deferred<AudioBuffer>();
    const events: string[] = [];

    const loader: TrackLoader = async (url) => {
      events.push(`start:${url}`);

      if (url === "A") {
        return gate.promise;
      }

      return fakeBuffer;
    };

    const queue = new AudioTaskQueue(fakeContext, loader);

    const first = queue.enqueue("A");
    queue.cancelAll();

    const second = queue.enqueue("B");

    // The cancelled decoder is still running.
    expect(events).toEqual(["start:A"]);

    gate.resolve(fakeBuffer);

    const results = await Promise.allSettled([
      first,
      second,
    ]);

    expect(results[0].status).toBe("rejected");
    expect(results[1].status).toBe("fulfilled");
    expect(events).toEqual(["start:A", "start:B"]);

    queue.dispose();
  });

  it("rejects new tasks after dispose", async () => {
    const loader: TrackLoader = async () => fakeBuffer;
    const queue = new AudioTaskQueue(fakeContext, loader);

    queue.dispose();

    await expect(queue.enqueue("A")).rejects.toThrow(
      "Queue has been disposed"
    );
  });

  it("does not settle an aborted task twice", async () => {
    const gate = deferred<AudioBuffer>();

    const loader: TrackLoader = async () => gate.promise;
    const queue = new AudioTaskQueue(fakeContext, loader);

    let settlements = 0;

    const task = queue.enqueue("A").then(
      () => {
        settlements++;
      },
      () => {
        settlements++;
      }
    );

    queue.cancelAll();

    await task;

    gate.resolve(fakeBuffer);
    await sleep(0);

    expect(settlements).toBe(1);

    queue.dispose();
  });
});
