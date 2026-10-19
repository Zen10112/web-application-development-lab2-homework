
import { useEffect, useState } from "react";
import { createAntiDriftTimer } from "../utils/anti-drift-timer";

const DISPLAY_STEP_MS = 50;

function displayRemaining(remainingMs: number): number {
  if (remainingMs <= 0) {
    return 0;
  }

  // Update displayed time in 50ms increments.
  return (
    Math.ceil(remainingMs / DISPLAY_STEP_MS) *
    DISPLAY_STEP_MS
  );
}

export function useCountdown(durationMs: number) {
  // The deadline is created only once for this mount.
  // React re-renders will not reset the timer.
  const [targetTime] = useState(() => {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new RangeError(
        "durationMs must be a finite, non-negative number"
      );
    }

    return Date.now() + durationMs;
  });

  const [remainingMs, setRemainingMs] = useState(() =>
    displayRemaining(
      Math.max(0, targetTime - Date.now())
    )
  );

  useEffect(() => {
    const updateRemaining = () => {
      const actualRemaining = Math.max(
        0,
        targetTime - Date.now()
      );

      const displayed = displayRemaining(actualRemaining);

      setRemainingMs((previous) =>
        previous === displayed ? previous : displayed
      );
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateRemaining();
      }
    };

    // The original utility owns the animation-frame loop.
    const cleanupTimer = createAntiDriftTimer(
      Math.max(0, targetTime - Date.now()),
      (remaining) => {
        // Avoid frequent React updates in background tabs.
        if (!document.hidden || remaining === 0) {
          updateRemaining();
        }
      }
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      cleanupTimer();

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [targetTime]);

  return {
    remainingMs,
    isEnded: remainingMs === 0,
  };
}
