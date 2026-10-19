
import { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  fftSize: 256 | 512;
}

const MAX_BARS = 64;
const TARGET_FPS = 60;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

export default function AudioVisualizer({
  analyser,
  isPlaying,
  fftSize,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const ctx = context;

    let disposed = false;
    let width = 0;
    let height = 0;
    let lastFrameTime = 0;

    let gradient: CanvasGradient | null = null;

    const motionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    let reducedMotion = motionQuery.matches;

    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (analyser) {
      analyser.fftSize = fftSize;
    }

    const frequencyData = analyser
      ? new Uint8Array(analyser.frequencyBinCount)
      : null;

    const drawBackground = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, width, height);
    };

    const drawIdle = () => {
      drawBackground();

      if (width <= 0 || height <= 0) return;

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

    const drawSpectrum = () => {
      if (!analyser || !frequencyData) {
        drawIdle();
        return;
      }

      analyser.getByteFrequencyData(frequencyData);

      drawBackground();

      const barCount = Math.min(
        MAX_BARS,
        frequencyData.length
      );

      if (barCount === 0 || width <= 0 || height <= 0) {
        return;
      }

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

      ctx.fillStyle = gradient ?? "#38bdf8";

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
    };

    const draw = (timestamp: number) => {
      if (disposed || !isPlaying || reducedMotion) {
        animationRef.current = null;
        return;
      }

      // Cap expensive Canvas drawing near 60 FPS.
      // The 1ms tolerance avoids unnecessarily skipping
      // every other frame on some 60Hz displays.
      if (
        lastFrameTime === 0 ||
        timestamp - lastFrameTime >= FRAME_INTERVAL - 1
      ) {
        lastFrameTime = timestamp;
        drawSpectrum();
      }

      animationRef.current =
        requestAnimationFrame(draw);
    };

    const startAnimation = () => {
      if (
        disposed ||
        !isPlaying ||
        !analyser ||
        reducedMotion ||
        animationRef.current !== null
      ) {
        return;
      }

      lastFrameTime = 0;

      animationRef.current =
        requestAnimationFrame(draw);
    };

    const stopAnimation = () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
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

      gradient = ctx.createLinearGradient(
        0,
        0,
        0,
        height
      );

      gradient.addColorStop(0, "#38bdf8");
      gradient.addColorStop(0.5, "#6366f1");
      gradient.addColorStop(1, "#a855f7");

      // Render a static spectrum for reduced-motion users.
      if (isPlaying && analyser) {
        drawSpectrum();
      } else {
        drawIdle();
      }
    };

    const handleMotionChange = (
      event: MediaQueryListEvent
    ) => {
      reducedMotion = event.matches;

      if (reducedMotion) {
        stopAnimation();

        if (isPlaying && analyser) {
          drawSpectrum();
        }
      } else {
        startAnimation();
      }
    };

    const resizeObserver = new ResizeObserver(
      resizeCanvas
    );

    resizeObserver.observe(canvas);

    motionQuery.addEventListener(
      "change",
      handleMotionChange
    );

    resizeCanvas();

    if (isPlaying && analyser && !reducedMotion) {
      startAnimation();
    }

    return () => {
      disposed = true;

      stopAnimation();
      resizeObserver.disconnect();

      motionQuery.removeEventListener(
        "change",
        handleMotionChange
      );
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
            ? "Audio frequency spectrum"
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
