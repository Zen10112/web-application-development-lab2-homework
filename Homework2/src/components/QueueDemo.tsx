
import { useEffect, useRef, useState } from "react";
import { AudioTaskQueue } from "../controllers/audio-queue-controller";
import { AudioPlayer } from "../controllers/audio-player";
import { demoTracks } from "../data/demo-tracks";

export default function QueueDemo() {
  const contextRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<AudioTaskQueue | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);

  const mountedRef = useRef(false);
  const operationRef = useRef(0);

  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState("Idle");
  const [busy, setBusy] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      operationRef.current++;

      playerRef.current?.dispose();
      queueRef.current?.dispose();

      const context = contextRef.current;

      playerRef.current = null;
      queueRef.current = null;
      contextRef.current = null;

      if (context && context.state !== "closed") {
        void context.close().catch(console.error);
      }
    };
  }, []);

  const addLog = (message: string) => {
    if (!mountedRef.current) return;

    setLogs((previous) => [...previous, message]);
  };

  // Create Web Audio objects lazily on user interaction.
  const getAudioEngine = () => {
    if (
      contextRef.current &&
      queueRef.current &&
      playerRef.current
    ) {
      return {
        context: contextRef.current,
        queue: queueRef.current,
        player: playerRef.current,
      };
    }

    const context = new AudioContext();
    const queue = new AudioTaskQueue(context);
    const player = new AudioPlayer(context, queue);

    contextRef.current = context;
    queueRef.current = queue;
    playerRef.current = player;

    return { context, queue, player };
  };

  const playTrack = async (index: number) => {
    const operation = ++operationRef.current;

    setBusy(true);
    setStatus("Loading audio...");

    const track = demoTracks[index];

    try {
      const { player } = getAudioEngine();

      addLog(`Request playback: ${track.name}`);

      await player.play(track.url);

      if (operation !== operationRef.current) return;

      setCurrentIndex(index);
      setStatus(`Playing: ${track.name}`);
      addLog(`Playback started: ${track.name}`);
    } catch (error) {
      if (operation !== operationRef.current) return;

      const message =
        error instanceof Error ? error.message : String(error);

      setStatus("Playback error");
      addLog(`ERROR: ${message}`);
    } finally {
      if (operation === operationRef.current && mountedRef.current) {
        setBusy(false);
      }
    }
  };

  const stopPlayback = () => {
    operationRef.current++;

    playerRef.current?.stop();
    queueRef.current?.cancelAll();

    setBusy(false);
    setCurrentIndex(-1);
    setStatus("Stopped");

    addLog("Playback stopped and pending tasks cancelled");
  };

  const nextTrack = () => {
    const nextIndex =
      (currentIndex + 1) % demoTracks.length;

    void playTrack(nextIndex);
  };

  const runConcurrentTest = async () => {
    const operation = ++operationRef.current;

    setBusy(true);
    setStatus("Testing FIFO Queue...");

    try {
      const { context, queue, player } = getAudioEngine();

      player.stop();

      if (context.state === "suspended") {
        await context.resume();
      }

      if (operation !== operationRef.current) return;

      addLog("Enqueue all three tracks simultaneously");

      const tasks = demoTracks.map(async (track) => {
        addLog(`ENQUEUED: ${track.name}`);

        const buffer = await queue.enqueue(track.url);

        addLog(`RESOLVED: ${track.name}`);
        return buffer;
      });

      const results = await Promise.allSettled(tasks);

      if (operation !== operationRef.current) return;

      const success = results.filter(
        (result) => result.status === "fulfilled"
      ).length;

      const failure = results.length - success;

      setStatus(
        `FIFO finished: ${success} success, ${failure} failed`
      );

      addLog(`Results: ${success} success, ${failure} failed`);
    } catch (error) {
      if (operation !== operationRef.current) return;

      const message =
        error instanceof Error ? error.message : String(error);

      setStatus("Test failed");
      addLog(`ERROR: ${message}`);
    } finally {
      if (operation === operationRef.current && mountedRef.current) {
        setBusy(false);
      }
    }
  };

  return (
    <section className="queue-demo">
      <h2>Web Audio FIFO Queue Engine</h2>

      <p>
        Load, decode and play audio using the Web Audio API.
      </p>

      <h3>Tracks</h3>

      <div className="track-list">
        {demoTracks.map((track, index) => (
          <div className="track-item" key={track.id}>
            <span>{track.name}</span>

            <button
              type="button"
              disabled={busy}
              onClick={() => void playTrack(index)}
            >
              Play
            </button>
          </div>
        ))}
      </div>

      <h3>Playback Controls</h3>

      <div className="audio-controls">
        <button
          type="button"
          onClick={stopPlayback}
        >
          Stop
        </button>

        <button
          type="button"
          onClick={nextTrack}
          disabled={busy}
        >
          Next Track
        </button>
      </div>

      <h3>Concurrency Test</h3>

      <div className="audio-controls">
        <button
          type="button"
          onClick={() => void runConcurrentTest()}
          disabled={busy}
        >
          Run Concurrent FIFO Test
        </button>
      </div>

      <p role="status" aria-live="polite">
        Status: {status}
      </p>

      <h3>Execution Log</h3>

      <div
        className="queue-log"
        role="log"
        aria-live="polite"
        aria-label="Audio queue execution log"
      >
        {logs.length === 0 ? (
          <p>No audio tasks yet.</p>
        ) : (
          <ol>
            {logs.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
