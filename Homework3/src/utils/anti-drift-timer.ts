
/**
 * Creates a zero-drift countdown timer.
 *
 * The remaining time is calculated using an absolute
 * target timestamp instead of decrementing a counter.
 *
 * @param durationMs - Countdown duration in milliseconds.
 * @param onTick - Callback receiving the remaining time.
 * @returns Cleanup function that stops the timer.
 */
export function createAntiDriftTimer(
  durationMs: number,
  onTick: (remaining: number) => void
): () => void {
  // Validate input
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new RangeError(
      "durationMs must be a finite, non-negative number"
    );
  }

  if (typeof onTick !== "function") {
    throw new TypeError("onTick must be a function");
  }

  // Calculate the absolute end time
  const targetTime = Date.now() + durationMs;

  let rafId: number | null = null;
  let isStopped = false;

  // Update countdown based on real elapsed time
  const tick = () => {
    if (isStopped) return;

    const remaining = Math.max(
      0,
      targetTime - Date.now()
    );

    // Notify the caller
    onTick(remaining);

    // Callback may have called cleanup synchronously
    if (isStopped) return;

    // Stop when time reaches zero
    if (remaining === 0) {
      isStopped = true;
      rafId = null;
      return;
    }

    // Schedule the next animation frame
    rafId = requestAnimationFrame(tick);
  };

  // Handle zero-duration countdown immediately
  if (durationMs === 0) {
    isStopped = true;
    onTick(0);

    return () => {};
  }

  // Start countdown immediately with the initial value
  tick();

  // Cleanup function
  return () => {
    if (isStopped) return;

    isStopped = true;

    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}
