
import { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  fftSize: 256 | 512;
}

export default function AudioVisualizer({
  analyser,
  isPlaying,
  fftSize,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  // Store the analyser without causing a re-render.
  useEffect(() => {
    analyserRef.current = analyser;
  }, [analyser]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const node = analyserRef.current;

    if (!canvas) return;

    const context = canvas.getContext("2d");

    if (!context) return;

    // Stop any previous animation loop.
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();

      const dpr = Math.min(
        window.devicePixelRatio || 1,
        2
      );

      canvas.width = Math.max(
        1,
        Math.round(rect.width * dpr)
      );

      canvas.height = Math.max(
        1,
        Math.round(rect.height * dpr)
      );

      context.setTransform(
        dpr, 0, 0, dpr, 0, 0
      );
    };

    resizeCanvas();

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);

    const drawBackground = (
      width: number,
      height: number
    ) => {
      context.clearRect(0, 0, width, height);

      context.fillStyle = "#0f172a";
      context.fillRect(0, 0, width, height);
    };

    const drawIdle = () => {
      const { width, height } =
        canvas.getBoundingClientRect();

      drawBackground(width, height);

      context.fillStyle = "#94a3b8";
      context.font = "15px Arial";
      context.textAlign = "center";
      context.textBaseline = "middle";

      context.fillText(
        "Play a track to visualize audio",
        width / 2,
        height / 2
      );
    };

    if (!isPlaying || !node) {
      drawIdle();

      return () => {
        observer.disconnect();
      };
    }

    node.fftSize = fftSize;

    // FFT size 256 -> 128 frequency bins.
    // FFT size 512 -> 256 frequency bins.
    const frequencyData = new Uint8Array(
      node.frequencyBinCount
    );

    let lastFrameTime = 0;

    const draw = (timestamp: number) => {
      // Animation is limited to approximately 60 FPS.
      // The browser may render slower on some devices.
      const elapsed = timestamp - lastFrameTime;

      if (elapsed >= 1000 / 60) {
        lastFrameTime = timestamp;

        node.getByteFrequencyData(frequencyData);

        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        drawBackground(width, height);

        const maxBars = 64;
        const barCount = Math.min(
          maxBars,
          frequencyData.length
        );

        const gap = 3;
        const barWidth = Math.max(
          1,
          (width - gap * (barCount - 1)) / barCount
        );

        const binsPerBar =
          frequencyData.length / barCount;

        for (let i = 0; i < barCount; i++) {
          const start = Math.floor(i * binsPerBar);
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
            normalized * (height - 20)
          );

          const x = i * (barWidth + gap);
          const y = height - barHeight;

          const gradient =
            context.createLinearGradient(
              0,
              y,
              0,
              height
            );

          gradient.addColorStop(0, "#38bdf8");
          gradient.addColorStop(0.5, "#6366f1");
          gradient.addColorStop(1, "#a855f7");

          context.fillStyle = gradient;

          context.fillRect(
            x,
            y,
            barWidth,
            barHeight
          );
        }
      }

      animationRef.current =
        requestAnimationFrame(draw);
    };

    animationRef.current =
      requestAnimationFrame(draw);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      observer.disconnect();
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
