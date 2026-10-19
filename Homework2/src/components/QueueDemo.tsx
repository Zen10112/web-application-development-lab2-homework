
import { useEffect, useRef, useState } from "react";
import {
  AudioTaskQueue,
} from "../controllers/audio-queue-controller";
import { AudioPlayer } from "../controllers/audio-player";
import { demoTracks } from "../data/demo-tracks";
import AudioVisualizer from "./AudioVisualizer";

interface AudioEngine {
  context: AudioContext;
  queue: AudioTaskQueue;
  player: AudioPlayer;
}

export default function QueueDemo() {
  // Keep audio objects alive across React renders.
  const engineRef = useRef<AudioEngine | null>(null);

  // Prevent outdated async operations from updating UI.
  const operationRef = useRef(0);
  const mountedRef = useRef(false);

  const [analyser, setAnalyser] =
    useState<AnalyserNode | null>(null);

  const [fftSize, setFFTSize] =
    useState<256 | 512>(256);

  const [isPlaying, setIsPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const [status, setStatus] = useState("Idle");
  const [pendingCount, setPendingCount] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      operationRef.current++;

      const engine = engineRef.current;

      if (engine) {
        engine.player.dispose();
        engine.queue.dispose();

        if (engine.context.state !== "closed") {
          void engine.context.close().catch(
            console.error
          );
        }
      }

      engineRef.current = null;
    };
  }, []);

  const addLog = (message: string) => {
    if (!mountedRef.current) return;

    setLogs((previous) => [
      ...previous,
      message,
    ]);
  };

  const updateQueueStatus = () => {
    const queue = engineRef.current?.queue;

    if (!queue || !mountedRef.current) return;

    setPendingCount(queue.getPendingCount());
  };

  // Create a single AudioContext, Queue and Player.
  const getEngine = (): AudioEngine => {
    if (engineRef.current) {
      return engineRef.current;
    }

    const context = new AudioContext();
    const queue = new AudioTaskQueue(context);
    const player = new AudioPlayer(context, queue);

    player.setFFTSize(fftSize);

    player.onPlaybackEnded = () => {
      if (!mountedRef.current) return;

      setIsPlaying(false);
      setStatus("Playback finished");
      addLog("Playback ended naturally");
    };

    const engine = {
      context,
      queue,
      player,
    };

    engineRef.current = engine;

    // Only updates when engine is initialized.
    setAnalyser(player.getAnalyser());

    return engine;
  };

  const handleFFTChange = (size: 256 | 512) => {
    setFFTSize(size);

    engineRef.current?.player.setFFTSize(size);

    addLog(`FFT size changed to ${size}`);
  };

  const playTrack = async (index: number) => {
    const operation = ++operationRef.current;
    const track = demoTracks[index];

    if (!track) return;

    setBusy(true);
    setIsPlaying(false);
    setStatus(`Loading ${track.name}...`);

    try {
      const { player } = getEngine();

      addLog(`Request playback: ${track.name}`);

      await player.play(track.url);

      if (
        operation !== operationRef.current ||
        !mountedRef.current
      ) {
        return;
      }

      updateQueueStatus();

      if (player.getIsPlaying()) {
        setCurrentIndex(index);
        setIsPlaying(true);
        setStatus(`Playing: ${track.name}`);

        addLog(`Playback started: ${track.name}`);
      } else {
        setIsPlaying(false);
        setStatus("Playback finished");
      }
    } catch (error) {
      if (
        operation !== operationRef.current ||
        !mountedRef.current
      ) {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      setIsPlaying(false);
      setStatus("Playback error");

      addLog(`ERROR: ${message}`);
    } finally {
      if (
        operation === operationRef.current &&
        mountedRef.current
      ) {
        setBusy(false);
        updateQueueStatus();
      }
    }
  };

  const stopPlayback = () => {
    operationRef.current++;

    engineRef.current?.player.stop();

    setIsPlaying(false);
    setBusy(false);
    setCurrentIndex(-1);
    setStatus("Stopped");
    setPendingCount(0);

    addLog("Playback stopped and queue cancelled");
  };

  const nextTrack = () => {
    const nextIndex =
      (currentIndex + 1) % demoTracks.length;

    void playTrack(nextIndex);
  };

  const runConcurrentTest = async () => {
    const operation = ++operationRef.current;

    setBusy(true);
    setIsPlaying(false);
    setCurrentIndex(-1);
    setStatus("Testing FIFO Queue...");

    try {
      const { queue, player } = getEngine();

      // Stop playback before testing decoding.
      player.stop();

      addLog("Starting concurrent FIFO test");

      const tasks = demoTracks.map((track) => {
        addLog(`ENQUEUED: ${track.name}`);

        const promise = queue.enqueue(track.url);

        return promise.then(
          (buffer) => {
            if (operation === operationRef.current) {
              addLog(`RESOLVED: ${track.name}`);
              updateQueueStatus();
            }

            return buffer;
          },
          (error: unknown) => {
            if (operation === operationRef.current) {
              const message =
                error instanceof Error
                  ? error.message
                  : String(error);

              addLog(
                `REJECTED: ${track.name} - ${message}`
              );

              updateQueueStatus();
            }

            throw error;
          }
        );
      });

      updateQueueStatus();

      const results = await Promise.allSettled(tasks);

      if (
        operation !== operationRef.current ||
        !mountedRef.current
      ) {
        return;
      }

      const success = results.filter(
        (result) => result.status === "fulfilled"
      ).length;

      const failure = results.length - success;

      setStatus(
        `FIFO finished: ${success} success, ${failure} failed`
      );

      addLog(
        `Results: ${success} success, ${failure} failed`
      );
    } catch (error) {
      if (operation !== operationRef.current) return;

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      setStatus("FIFO test failed");
      addLog(`ERROR: ${message}`);
    } finally {
      if (
        operation === operationRef.current &&
        mountedRef.current
      ) {
        setBusy(false);
        updateQueueStatus();
      }
    }
  };

  return (
    <section className="audio-dashboard">
      <div className="dashboard-heading">
        <h2>Audio Queue Dashboard</h2>
        <p>
          Web Audio API - FFT Frequency Visualization
        </p>
      </div>

      {/* TRACK LIST */}
      <div className="dashboard-card">
        <h3>Music Library</h3>

        <div className="track-list">
          {demoTracks.map((track, index) => (
            <div
              className={
                currentIndex === index && isPlaying
                  ? "track-item active-track"
                  : "track-item"
              }
              key={track.id}
            >
              <div className="track-info">
                <span className="track-icon" aria-hidden="true">
                  ♪
                </span>

                <div>
                  <strong>{track.name}</strong>
                  <small>MP3 Audio</small>
                </div>
              </div>

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
      </div>

      {/* PLAYBACK CONTROLS */}
      <div className="dashboard-card">
        <h3>Playback Controls</h3>

        <div className="audio-controls">
          <button
            type="button"
            className="stop-button"
            onClick={stopPlayback}
          >
            Stop
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={nextTrack}
          >
            Next Track
          </button>
        </div>
      </div>

      {/* FFT SETTINGS */}
      <div className="dashboard-card">
        <h3>FFT Configuration</h3>

        <div
          className="fft-controls"
          role="group"
          aria-label="FFT size"
        >
          <button
            type="button"
            className={
              fftSize === 256 ? "fft-active" : ""
            }
            aria-pressed={fftSize === 256}
            onClick={() => handleFFTChange(256)}
          >
            FFT 256
          </button>

          <button
            type="button"
            className={
              fftSize === 512 ? "fft-active" : ""
            }
            aria-pressed={fftSize === 512}
            onClick={() => handleFFTChange(512)}
          >
            FFT 512
          </button>
        </div>
      </div>

      {/* VISUALIZER */}
      <AudioVisualizer
        analyser={analyser}
        isPlaying={isPlaying}
        fftSize={fftSize}
      />

      {/* QUEUE STATUS */}
      <div className="dashboard-card">
        <h3>Queue Status</h3>

        <div className="queue-status-grid">
          <div className="status-box">
            <span>Status</span>
            <strong role="status">{status}</strong>
          </div>

          <div className="status-box">
            <span>Pending Tasks</span>
            <strong>{pendingCount}</strong>
          </div>

          <div className="status-box">
            <span>Playback</span>
            <strong>
              {isPlaying ? "Playing" : "Stopped"}
            </strong>
          </div>
        </div>

        <div className="audio-controls test-controls">
          <button
            type="button"
            disabled={busy}
            onClick={() => void runConcurrentTest()}
          >
            Run Concurrent FIFO Test
          </button>
        </div>
      </div>

      {/* EXECUTION LOG */}
      <div className="dashboard-card">
        <h3>Execution Log</h3>

        <div
          className="queue-log"
          role="log"
          aria-live="polite"
          aria-label="Audio processing log"
        >
          {logs.length === 0 ? (
            <p>No audio tasks yet.</p>
          ) : (
            <ol>
              {logs.map((message, index) => (
                <li key={index}>
                  {message}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
