import { useEffect, useRef, useState } from "react";
import { AudioTaskQueue, type TrackLoader } from "../controllers/audio-queue-controller";
import { demoTracks } from "../data/demo-tracks";

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Cancelled", "AbortError")); return; }
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export default function QueueDemo() {
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const queueRef = useRef<AudioTaskQueue | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const mountedRef = useRef(false);
  const runRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runRef.current++;
      queueRef.current?.dispose();
      queueRef.current = null;
      const context = contextRef.current;
      contextRef.current = null;
      if (context && context.state !== "closed") void context.close();
    };
  }, []);

  const addLog = (message: string, run: number) => {
    if (mountedRef.current && runRef.current === run)
      setLogs(previous => [...previous, message]);
  };

  const runDemo = async () => {
    if (running) return;
    const run = ++runRef.current;
    setRunning(true);
    setLogs([]);
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      contextRef.current = context;
      const loader: TrackLoader = async (url, signal, audioContext) => {
        const track = demoTracks.find(item => item.url === url);
        if (!track) throw new Error(`Unknown track: ${url}`);
        addLog(`START: ${track.name}`, run);
        await wait(track.delay, signal);
        const buffer = audioContext.createBuffer(1, 256, 44100);
        addLog(`DECODED: ${track.name}`, run);
        return buffer;
      };
      const queue = new AudioTaskQueue(context, loader);
      queueRef.current = queue;
      addLog("Enqueuing A, B, C...", run);
      const tasks = demoTracks.map(async track => {
        const buffer = await queue.enqueue(track.url);
        addLog(`RESOLVED: ${track.name} (${buffer.length} samples)`, run);
      });
      await Promise.all(tasks);
      addLog("All tracks processed successfully.", run);
    } catch (error) {
      addLog(`ERROR: ${error instanceof Error ? error.message : String(error)}`, run);
    } finally {
      queueRef.current?.dispose();
      queueRef.current = null;
      if (context && context.state !== "closed") await context.close();
      if (contextRef.current === context) contextRef.current = null;
      if (mountedRef.current && runRef.current === run) setRunning(false);
    }
  };

  return (
    <section className="queue-demo">
      <h2>FIFO Queue Test</h2>
      <p>Run three simulated audio tasks to verify sequential processing.</p>
      <button type="button" onClick={() => void runDemo()} disabled={running}>
        {running ? "Processing..." : "Run FIFO Test"}
      </button>
      <h3>Execution Log</h3>
      <div className="queue-log" role="log" aria-live="polite">
        {logs.length === 0 ? <p>No tasks executed yet.</p> :
          <ol>{logs.map((message, index) => <li key={index}>{message}</li>)}</ol>}
      </div>
    </section>
  );
}
