
import { useEffect, useState } from "react";
import { createAntiDriftTimer } from "../utils/anti-drift-timer";

const DISPLAY_STEP_MS = 50;

function roundForDisplay(ms: number): number {
  if (ms <= 0) return 0;

  return Math.ceil(ms / DISPLAY_STEP_MS) * DISPLAY_STEP_MS;
}

export function useCountdown(durationMs: number) {
  const [targetTime] = useState(() => {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new RangeError(
        "durationMs must be finite and non-negative"
      );
    }

    return Date.now() + durationMs;
  });

  const [remainingMs, setRemainingMs] = useState(() =>
    roundForDisplay(
      Math.max(0, targetTime - Date.now())
    )
  );

  useEffect(() => {
    const update = () => {
      const actual = Math.max(
        0,
        targetTime - Date.now()
      );

      const displayed = roundForDisplay(actual);

      setRemainingMs((previous) =>
        previous === displayed ? previous : displayed
      );
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) update();
    };

    const handleFocus = () => {
      update();
    };

    const cleanupTimer = createAntiDriftTimer(
      Math.max(0, targetTime - Date.now()),
      () => {
        if (!document.hidden || Date.now() >= targetTime) {
          update();
        }
      }
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    window.addEventListener("focus", handleFocus);

    update();

    return () => {
      cleanupTimer();

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      window.removeEventListener(
        "focus",
        handleFocus
      );
    };
  }, [targetTime]);

  return {
    remainingMs,
    targetTime,
    isEnded: remainingMs === 0,
  };
}
