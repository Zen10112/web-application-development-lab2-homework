
import { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  fftSize: 256 | 512;
}

const MAX_BARS = 64;

export default function AudioVisualizer({
  analyser,
  isPlaying,
  fftSize,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    analyserRef.current = analyser;
  }, [analyser]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const node = analyserRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;

    let width = 0;
    let height = 0;

    let barGradient: CanvasGradient | null = null;

    // Cancel any older animation loop.
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    const drawBackground = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, width, height);
    };

    const drawIdle = () => {
      drawBackground();

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "15px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillText(
        "Play a track to visualize audio",
        width / 2,
        height / 2
      );
    };

    const resizeCanvas = () => {
      if (disposed) return;

      const rect = canvas.getBoundingClientRect();

      width = rect.width;
      height = rect.height;

      const dpr = Math.min(
        window.devicePixelRatio || 1,
        2
      );

      const pixelWidth = Math.max(
        1,
        Math.round(width * dpr)
      );

      const pixelHeight = Math.max(
        1,
        Math.round(height * dpr)
      );

      if (
        canvas.width !== pixelWidth ||
        canvas.height !== pixelHeight
      ) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Reuse one gradient until the canvas size changes.
      barGradient = ctx.createLinearGradient(
        0,
        0,
        0,
        height
      );

      barGradient.addColorStop(0, "#38bdf8");
      barGradient.addColorStop(0.5, "#6366f1");
      barGradient.addColorStop(1, "#a855f7");

      // Keep idle canvas visible after a resize.
      if (!isPlaying || !node) {
        drawIdle();
      }
    };

    const resizeObserver = new ResizeObserver(
      resizeCanvas
    );

    resizeObserver.observe(canvas);
    resizeCanvas();

    if (!isPlaying || !node) {
      return () => {
        disposed = true;
        resizeObserver.disconnect();
      };
    }

    node.fftSize = fftSize;

    const frequencyData = new Uint8Array(
      node.frequencyBinCount
    );

    const draw = () => {
      if (disposed) return;

      node.getByteFrequencyData(frequencyData);

      drawBackground();

      const barCount = Math.min(
        MAX_BARS,
        frequencyData.length
      );

      if (barCount > 0 && width > 0 && height > 0) {
        const gap = Math.min(
          3,
          width / (barCount * 3)
        );

        const barWidth = Math.max(
          0,
          (width - gap * (barCount - 1)) / barCount
        );

        const binsPerBar =
          frequencyData.length / barCount;

        ctx.fillStyle = barGradient ?? "#38bdf8";

        for (let i = 0; i < barCount; i++) {
          const start = Math.floor(
            i * binsPerBar
          );

          const end = Math.max(
            start + 1,
            Math.floor((i + 1) * binsPerBar)
          );

          let sum = 0;

          for (let j = start; j < end; j++) {
            sum += frequencyData[j];
          }

          const average = sum / (end - start);
          const normalized = average / 255;

          const barHeight = Math.max(
            2,
            normalized * Math.max(0, height - 12)
          );

          const x = i * (barWidth + gap);
          const y = height - barHeight;

          ctx.fillRect(
            x,
            y,
            barWidth,
            barHeight
          );
        }
      }

      // Only one requestAnimationFrame chain.
      animationRef.current =
        requestAnimationFrame(draw);
    };

    animationRef.current =
      requestAnimationFrame(draw);

    return () => {
      disposed = true;

      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      resizeObserver.disconnect();
    };
  }, [analyser, isPlaying, fftSize]);

  return (
    <div className="visualizer-panel">
      <div className="visualizer-header">
        <h3>Audio Frequency Visualizer</h3>

        <span className="visualizer-fft-label">
          FFT: {fftSize}
        </span>
      </div>

      <canvas
        ref={canvasRef}
        className="audio-visualizer-canvas"
        role="img"
        aria-label={
          isPlaying
            ? "Animated audio frequency spectrum"
            : "Audio frequency visualizer is idle"
        }
      />

      <p className="visualizer-description">
        {isPlaying
          ? "Visualizing audio frequencies in real time"
          : "Visualizer is waiting for audio playback"}
      </p>
    </div>
  );
}
