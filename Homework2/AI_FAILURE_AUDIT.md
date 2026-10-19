# AI FAILURE AUDIT — Homework 2

**Project:** Concurrent FIFO Audio Visualizer Queue Engine  
**Stack:** React, TypeScript, Vite, Web Audio API, Canvas  
**Artifact reviewed:** `Homework2(1).zip` supplied by the student  
**Audit date:** 2026-10-19  
**Assessment:** Static source-code audit; **not** a completed browser/DevTools performance or memory test.

## 1. Audit scope and method

The following student files were reviewed:

- `src/controllers/audio-queue-controller.ts`
- `src/controllers/audio-player.ts`
- `src/components/AudioVisualizer.tsx`
- `src/components/QueueDemo.tsx`
- `src/controllers/audio-queue-controller.test.ts`
- `src/controllers/audio-player.test.ts`
- `src/data/demo-tracks.ts`

The review focused on the three classic AI failure categories from the assignment (unsafe rendering, unmanaged lifecycle/concurrency, and unstable keys), while reporting **actual project-specific findings** rather than inventing an `innerHTML` vulnerability or a missing event-listener cleanup.

**Evidence notation:** `SOURCE-CONFIRMED` means the specified code pattern exists in the submitted ZIP. `REPRODUCTION PENDING` means the user-visible failure still needs to be reproduced and recorded in Chrome DevTools. `FIX PROPOSED` means a change is documented, **not applied or re-tested** in this audit file.

## 2. Summary of the three detected issues

| ID | Classification | Severity | Source | Status |
|---|---|---|---|---|
| HW2-01 | Shared-queue cancellation / task isolation | High | `audio-player.ts:113–119`, `QueueDemo.tsx:215–225` | SOURCE-CONFIRMED; FIX PROPOSED |
| HW2-02 | Async UI lifecycle / stale `onended` event | Medium | `QueueDemo.tsx:91–97`, `QueueDemo.tsx:206–220` | SOURCE-CONFIRMED; REPRODUCTION PENDING; FIX PROPOSED |
| HW2-03 | Unbounded frame loop / reduced-motion handling | Medium | `AudioVisualizer.tsx:139–142`, `AudioVisualizer.tsx:203–221` | SOURCE-CONFIRMED; performance impact unmeasured; FIX PROPOSED |

---

## 3. Finding HW2-01 — Shared queue can cancel unrelated work

**Category:** Async concurrency / cancellation ownership  
**Severity:** High when the queue is shared  
**Location:** `src/controllers/audio-player.ts:113–119`; `src/components/QueueDemo.tsx:215–225`

### AI-assisted implementation / problematic code

```ts
public stop(): void {
  this.requestVersion++;
  this.queue.cancelAll();
  // ...
}
```

`QueueDemo` creates **one shared** `AudioTaskQueue` and passes it to `AudioPlayer`. Its FIFO test also enqueues directly onto that same queue. Therefore, `AudioPlayer.stop()` does not just cancel the current playback request: it rejects *every active and pending queue task*, including tasks not owned by the player.

### Impact / risk

A Stop/Next action can unexpectedly reject batch loading, testing, or future prefetch operations. This is a task-isolation flaw, not an XSS vulnerability. The current dashboard reduces some overlap by disabling controls while busy, but the queue/controller API itself has this coupling.

### Reproduction / DevTools proof required

1. In a controlled test, enqueue tracks A and B directly through a shared queue.
2. Start playback using an `AudioPlayer` bound to the same queue.
3. Call `player.stop()` while A/B remain pending (use a delayed mock loader or Network throttling).
4. Record whether the unrelated enqueues reject with `AbortError`; capture the Network panel and Console/test output.

**Actual DevTools screenshot:** _Not yet supplied. Do not label this step PASS until captured._

### Engineering refactor

Use task-scoped cancellation rather than `queue.cancelAll()` inside playback stop. For example, extend the queue to return a task handle `{ promise, cancel }`, or accept an `AbortSignal` supplied by the player per request. Keep `cancelAll()` for explicit global shutdown/dispose only. A simpler alternative is to instantiate separate queue instances for playback and batch-test/prefetch, if their cancellation domains must differ. Add a test asserting that `player.stop()` does **not** reject a separately enqueued task.

**Fix status:** Proposed; not applied to submitted ZIP.

---

## 4. Finding HW2-02 — Natural playback-end callback can overwrite a newer UI operation

**Category:** Async race condition / stale event  
**Severity:** Medium  
**Location:** `src/components/QueueDemo.tsx:91–97`, `:206–220`

### AI-assisted implementation / problematic code

```ts
player.onPlaybackEnded = () => {
  if (!mountedRef.current) return;
  setIsPlaying(false);
  setStatus("Playback finished");
  addLog("Playback ended naturally");
};
```

The main `playTrack()` and `runConcurrentTest()` flows track a generation number via `operationRef`, but this `onPlaybackEnded` callback does not validate the active operation. It can still update the display when a newer action is loading/testing. In particular, `runConcurrentTest()` starts by changing the UI to `Testing FIFO Queue...`, and only later calls `player.stop()` after `getEngine()`. The event handler has no operation guard of its own.

### Impact / risk

A late natural-end notification can show `Playback finished` while a FIFO test or new playback request is underway. It can also emit a confusing log. This is a plausible race based on the code paths; **the exact event ordering is not yet reproduced in a browser**.

### Reproduction / DevTools proof required

1. Play a short audio clip near its natural ending.
2. Just before the clip ends, start another track or the Concurrent FIFO Test.
3. Observe the Status and Execution Log for a stale `Playback finished` message after `Loading...` / `Testing...` has begun.
4. Use Chrome Console timestamps or breakpoints in `onPlaybackEnded`, `playTrack`, and `runConcurrentTest` to document ordering.

**Actual DevTools screenshot:** _Not yet supplied._

### Engineering refactor

Move playback lifecycle events to a versioned callback: each source/player request should carry a unique playback token. When the source ends, notify the UI only if that token still matches the active playback request and the dashboard is in playback mode. In `runConcurrentTest()`, stop the player and invalidate previous playback UI **before** setting test mode. Add a regression test that delivers an older `onended` callback after a newer action begins and confirms the newer status remains unchanged.

**Fix status:** Proposed; not applied to submitted ZIP.

---

## 5. Finding HW2-03 — Visualization loop is not capped and ignores reduced-motion preference

**Category:** Performance / animation lifecycle  
**Severity:** Medium  
**Location:** `src/components/AudioVisualizer.tsx:139–142`, `:203–221`

### AI-assisted implementation / problematic code

```ts
const draw = () => {
  if (disposed) return;
  node.getByteFrequencyData(frequencyData);
  // draw up to 64 bars
  animationRef.current = requestAnimationFrame(draw);
};
```

The component correctly cancels its pending frame and disconnects its `ResizeObserver` during effect cleanup; this audit does **not** claim an observed RAF leak. However, the current loop schedules the next draw as fast as the display's refresh rate permits (e.g., potentially 120/144 times per second) instead of the assignment's approximately 60 FPS target. The code also does not check `prefers-reduced-motion` before starting an animated spectrum.

### Impact / risk

On high-refresh-rate displays this can perform unnecessary Canvas redraws; for users requesting reduced motion, the continuous animation may be undesirable. The actual frame rate, CPU utilization, and memory trend **have not been measured**.

### Reproduction / DevTools proof required

1. Open Chrome DevTools → **Performance** and record playback for 15–30 seconds with FFT 256 and FFT 512.
2. Inspect frame rate, scripting time, `draw()` invocation frequency, and long tasks; note screen refresh rate.
3. Enable `prefers-reduced-motion: reduce` in DevTools Rendering emulation and verify the current loop still runs.
4. Record baseline results, apply the change, and compare under similar conditions.

**Actual DevTools screenshot / FPS measurement:** _Not yet supplied._

### Engineering refactor

Use RAF timestamps to avoid expensive redraws more often than approximately once per `1000 / 60` milliseconds; continue scheduling RAF to remain responsive. Handle `window.matchMedia('(prefers-reduced-motion: reduce)')`: show a static/simplified spectrum or provide an animation toggle for reduced-motion users. Preserve the current effect cleanup (`cancelAnimationFrame`, `ResizeObserver.disconnect()`). Add a mock-RAF lifecycle test asserting only one scheduled frame chain and cancellation on Stop/unmount.

**Fix status:** Proposed; not applied to submitted ZIP.

---

## 6. Security checks — do not fabricate sample vulnerabilities

| Check | Finding |
|---|---|
| Raw `innerHTML` / `dangerouslySetInnerHTML` in application source | No use identified in the reviewed application files |
| Direct `addEventListener()` in component render body without cleanup | No such pattern identified in the reviewed application files |
| `key={Math.random()}` or `key={index}` on track list | Track list uses `key={track.id}` (`QueueDemo.tsx:314–321`), which is stable for the supplied data |
| `key={index}` on append-only execution logs | Present (`QueueDemo.tsx:457–460`); acceptable for append-only logs within the current UI design, but reconsider if log lines are reordered/removed |
| `fetch()` user-provided URL | Queue fetches a URL passed to it; no HTML injection sink was identified in the React text display |

The assignment slide's XSS example illustrates a **possible AI failure mode**, not a vulnerability proven to exist in this particular project.

## 7. Positive controls already present in the source

- Queue dispatch uses `push()` and `shift()` with `isProcessing` set before the first `await` (`audio-queue-controller.ts:113–126`).
- The per-task `settled` guard prevents duplicate resolve/reject attempts (`audio-queue-controller.ts:73–91`).
- `fetch()` takes the task's `AbortSignal`; aborted tasks are checked after decoding because `decodeAudioData()` itself is not directly abortable (`audio-queue-controller.ts:37–70`).
- The worker catches task-level failures and continues to subsequent tasks (`audio-queue-controller.ts:128–160`).
- `AudioBufferSourceNode` is freshly created for each play, and `onended` / `stop()` disconnect it (`audio-player.ts:74–135`).
- Visualizer's effect cleanup calls `cancelAnimationFrame()` and `ResizeObserver.disconnect()` (`AudioVisualizer.tsx:211–220`).
- The source includes queue and player unit-test files. Passing results were **not independently established** for this audit.

These are source observations, not proof of zero memory leaks or guaranteed 60 FPS.

## 8. Evidence checklist (to complete on the student's machine)

- [ ] Run `npm run test` and attach the terminal output.
- [ ] Run `npm run build` and attach the terminal output.
- [ ] Capture Network/Console evidence for cancellation of an unrelated shared-queue task (HW2-01).
- [ ] Capture event-timing evidence of the stale-end race, or record a negative reproduction result (HW2-02).
- [ ] Capture Chrome Performance trace with FFT 256 and 512 before/after the drawing change (HW2-03).
- [ ] Capture a reduced-motion test and resulting UI behavior.
- [ ] Take Memory heap snapshots before and after repeated Play/Stop/Next cycles (with GC where practical).
- [ ] Apply and review the proposed patches in Git; attach a Git diff or commit hash.
- [ ] Re-run functional and regression tests after refactoring.

## 9. Final audit status

**Three project-specific risks were identified from source code.** This document includes their locations, impact, reproduction protocols, and manual refactor proposals. **No fixes were applied by generating this report.** Browser DevTools screenshots, measured FPS, memory-leak conclusions, and post-fix test evidence remain pending. The project must not be represented as proven leak-free or guaranteed 60 FPS until those checks are completed.
