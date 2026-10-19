# TASK DECOMPOSITION — HOMEWORK 2

**Project:** Concurrent FIFO Audio Visualizer Queue Engine  
**Tech stack:** React, TypeScript, Vite, Web Audio API, HTML Canvas, Vitest  
**Suggested duration:** 1 week  
**Scope:** Queue engine, audio loading/decoding, playback, real-time frequency visualization, cancellation, concurrency, resource cleanup, and verification.

> **Evidence note:** This plan is tailored to the files present in `Homework2(1).zip` and the subsequent AI-audit fixes discussed in the project. Presence of code is not proof that a runtime test passed. The latest fixes discussed after the ZIP must be checked in the working copy. Do not mark FPS, leak-freedom, tests, or build as passed without a recorded result.

## 1. Project objective

Build an audio processing application that accepts multiple tracks, loads and decodes them in a **first-in-first-out (FIFO)** order without overlapping queue workers, plays tracks through Web Audio API, and visualizes frequency magnitudes on Canvas. The application must support cancellation, avoid unresolved application-level Promises, clean up audio sources and browser resources, and aim for smooth animation (~60 FPS on suitable hardware).

## 2. Work breakdown structure (WBS)

| ID | Task | Deliverable / files | Depends on | Acceptance criteria | Status |
|---|---|---|---|---|---|
| T01 | Initialize React + TypeScript with Vite | `package.json`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx` | — | Dev server launches | Implemented; final recheck pending |
| T02 | Organize modules and fixtures | `src/controllers/`, `src/components/`, `src/data/`, `public/audio/` | T01 | Clear ownership of engine, playback, UI and assets | Implemented |
| T03 | Define FIFO queue contracts and state | `src/controllers/audio-queue-controller.ts` | T02 | `queue`, `isProcessing`, `activeController` *as specified in original slide* or refactored equivalent with documented rationale; `enqueue(): Promise<AudioBuffer>` | Implemented; contract compliance recheck pending |
| T04 | Implement one asynchronous FIFO worker | `AudioTaskQueue.processNext()` | T03 | `push`/`shift`; only one worker active; B starts after A settles | Implemented; unit-test verification pending |
| T05 | Fetch and decode audio | `fetch`, `response.arrayBuffer()`, `decodeAudioData()` | T04 | Three real MP3 files decode into `AudioBuffer`; HTTP/decode errors reject | Implemented; browser test pending |
| T06 | Implement cancellation and Promise settlement | `AbortController`, per-task settlement guards, `cancelAll`, `dispose` | T04–T05 | Pending/active Promises reject on cancellation; decode limitations understood; no double settlement | Implemented; latest fix and tests pending |
| T07 | Isolate cancellation ownership | Queue `enqueue(url, signal?)` and player-scoped AbortController | T06 | Stopping a track does not cancel unrelated shared-queue tasks | **AI audit HW2-01: fix provided; regression pending** |
| T08 | Implement playback lifecycle | `src/controllers/audio-player.ts` | T05–T06 | New `AudioBufferSourceNode` for every Play; Stop and Next function; sources disconnect | Implemented; tests pending |
| T09 | Handle suspended AudioContext | `audioContext.resume()` on user-initiated Play | T08 | Playback starts after a user gesture; suspended/closed/error states handled | Implemented; browser test pending |
| T10 | Prevent stale UI updates | `src/components/QueueDemo.tsx` | T08 | Older `onended` callback cannot overwrite newer Play/Stop/FIFO test | **AI audit HW2-02: fix provided; regression pending** |
| T11 | Connect audio analysis node | `AudioPlayer.getAnalyser()`, FFT 256/512 | T08 | Source → Analyser → destination; 128/256 frequency bins | Implemented; runtime check pending |
| T12 | Draw Canvas frequency bars | `src/components/AudioVisualizer.tsx` | T11 | `getByteFrequencyData()` drives visible frequency bars | Implemented; browser check pending |
| T13 | Manage animation lifecycle and resize | `requestAnimationFrame`, `cancelAnimationFrame`, `ResizeObserver`, refs | T12 | One loop only; stop/unmount cancels frame; resize remains sharp | Implemented; regression pending |
| T14 | Address FPS/reduced-motion issues | Visualizer scheduling and `prefers-reduced-motion` | T13 | Throttle Canvas work near 60 draws/sec where appropriate; reduced-motion static view | **AI audit HW2-03: fix provided; measurement pending** |
| T15 | Build controls, queue status and logging | `QueueDemo.tsx`, `App.css` | T08–T14 | Track list, Play, Stop, Next, FFT selector, queue status, visualizer | Implemented; UI test pending |
| T16 | Unit-test concurrency/cancellation/playback | `audio-queue-controller.test.ts`, `audio-player.test.ts` | T06–T10 | FIFO, no overlap, fail/recover, cancel, dispose, once-only start, disconnect, stale callbacks | Test files present; latest suite results pending |
| T17 | Profile memory and frame performance | Chrome DevTools Memory, Performance | T13–T16 | Capture traces/snapshots; investigate surviving resources or dropped frames | Not verified |
| T18 | Verify build, report risks and submit | `AI_FAILURE_AUDIT.md`, this file, Git commits | T01–T17 | Tests/build successful on machine, evidence captured, repository pushed | Pending final verification |

## 3. Seven-day execution plan

| Day | Focus | Relevant tasks | Expected checkpoint |
|---|---|---|---|
| Day 1 | Project setup and modular structure | T01–T03 | Vite starts; controller contract exists |
| Day 2 | FIFO worker, Promise lifecycle, error recovery | T04, T06 | Mock concurrency proves strict FIFO |
| Day 3 | Audio fetching, decoding, playback | T05, T08–T09 | Three MP3s load; Play/Stop/Next work |
| Day 4 | FFT, AnalyserNode and Canvas | T11–T12 | Bars react to real audio; switch 256/512 |
| Day 5 | Animation cleanup, controls and responsiveness | T13, T15 | Canvas resizes; no duplicate animation loops |
| Day 6 | AI failure audit and refactoring | T07, T10, T14, T16 | Three audit issues addressed and regression-tested |
| Day 7 | Memory/FPS profiling, build and hand-in | T17–T18 | Evidence, docs, clean build and GitHub commit |

*The timetable is a planning decomposition; it does not assert the actual calendar date on which each task was completed.*

## 4. Module responsibilities

| Module | Responsibility | Important boundaries |
|---|---|---|
| `src/controllers/audio-queue-controller.ts` | FIFO task scheduling; fetch/decode; cancellation; Promise settlement | No React rendering; do not start multiple workers |
| `src/controllers/audio-player.ts` | AudioContext-backed playback; AnalyserNode connection; source lifecycle | A source node starts once; Stop should cancel only playback-owned work |
| `src/components/AudioVisualizer.tsx` | Canvas spectrum, FFT data reading, animation and resize cleanup | Avoid React `setState` on every frame; one RAF chain |
| `src/components/QueueDemo.tsx` | Track controls, queue status, log, state coordination | Ignore stale async callbacks; dispose engine on unmount |
| `src/data/demo-tracks.ts` | Track metadata and local URLs | Paths must point to valid audio assets |
| `public/audio/track-a.mp3` / `track-b.mp3` / `track-c.mp3` | Browser-readable MP3 test files | Verify Network HTTP 200 and decoding success |
| `src/controllers/*.test.ts` | Automated regression tests | Mocks do not replace real browser/audio/DevTools checks |

## 5. Acceptance tests and evidence

| Test ID | Scenario | Expected result | Recommended evidence |
|---|---|---|---|
| AT01 | Enqueue A, B, C at once, give A a longer simulated delay | Start A → finish A → start B → finish B → start C | Vitest event log |
| AT02 | Enqueue 10 tasks simultaneously | Maximum active loader count = 1 | Vitest assertion |
| AT03 | Make B fail to fetch/decode | A fulfilled, B rejected, C fulfilled; queue not stuck | Vitest + Network console |
| AT04 | Cancel queued B while A is running | B rejects promptly; unrelated tasks still complete | AbortSignal test |
| AT05 | Cancel active task during `decodeAudioData` | Caller Promise rejects promptly; queued worker does not overlap a still-active decoder | Deferred decoder mock |
| AT06 | Call `dispose()` then `enqueue()` | New enqueue rejects; existing tasks cancelled | Vitest |
| AT07 | Play an MP3 | New source node created, `start()` invoked once, audible output | Browser + mock spy |
| AT08 | Stop or switch tracks | Old node stops/disconnects; new track plays correctly | Browser + mock spy |
| AT09 | Stop playback while unrelated queue job waits | Other job is not globally cancelled | Regression test for HW2-01 |
| AT10 | Start a new operation while previous track-end callback is delayed | Old callback does not replace new status | Regression test for HW2-02 |
| AT11 | Change FFT from 256 to 512 | `frequencyBinCount`: 128 → 256 | Browser console |
| AT12 | Play/Stop multiple times | Canvas animation runs only during playback; unmount cancels RAF | Performance + instrumentation |
| AT13 | Resize browser | Canvas scales correctly, including device pixel ratio | Responsive browser test |
| AT14 | Enable reduced-motion OS/browser setting | Animation becomes static/limited per policy | Browser accessibility settings |
| AT15 | Record visualizer on device with 60 Hz display | Frame durations generally near 16.7 ms if hardware permits; record actual FPS | Chrome Performance trace |
| AT16 | Repeated Play/Stop/Next followed by GC | No unexplained retention trend in audio nodes, buffers or listeners | Heap snapshots and retained paths |
| AT17 | Run `npm run test` and `npm run build` | Exit code 0; no TypeScript or bundler errors | Saved terminal screenshot/output |

**Do not mark a test as PASS solely because its expected output is described here.**

## 6. AI failure mode audit and planned/manual refactors

| Audit ID | Source-derived concern | Engineering action | Proof needed |
|---|---|---|---|
| HW2-01 | Player called `queue.cancelAll()` on a shared queue, potentially aborting unrelated tasks | Per-task `AbortSignal` and player-scoped abort; reserve `cancelAll()` for global shutdown | Test unrelated task still fulfills after Stop |
| HW2-02 | Old audio `onended` could overwrite a newer UI operation | Use generation/operation ID and per-play `onEnded` callback guards | Simulate late callback after Next/Stop/FIFO test |
| HW2-03 | Canvas drawing frequency and reduced-motion support not fully controlled | Rate-limit drawing near 60 FPS where needed, respond to `prefers-reduced-motion`, clean up RAF/listeners | Performance trace and reduced-motion test |

**Security note:** The reviewed project code did not establish a raw `innerHTML` XSS issue. Do not report an invented security exploit merely to match a slide example. **Memory note:** Code review can identify lifecycle risks but cannot prove memory leak absence.

## 7. Local execution and verification

From the `web-hw-lab02` repository root:

```bash
cd Homework2
npm install       # only when dependencies are not already installed
npm run test
npm run build
npm run dev
```

For a production-like browser check:

```bash
npm run preview
```

Use Chrome DevTools **Network** to check MP3 responses, **Console** for unhandled rejections, **Performance** for RAF/frame timing and **Memory** for retained objects after GC. Capture results before stating that performance or cleanup targets were met.

## 8. Final hand-in checklist

- [ ] Project runs using Vite with all three MP3 assets.
- [ ] `AudioTaskQueue` maintains strict FIFO and single-worker processing.
- [ ] `enqueue()` resolves with `AudioBuffer` or rejects on errors/cancellation.
- [ ] AbortSignal scopes cancellation without stopping unrelated tasks.
- [ ] `decodeAudioData()` cancellation limitations are documented and covered by tests.
- [ ] Stop/Next safely clean up each `AudioBufferSourceNode`.
- [ ] `AudioContext` is reused and closed at component disposal.
- [ ] FFT 256 and 512 are supported, with expected bin counts.
- [ ] Canvas uses `getByteFrequencyData()` and one RAF chain.
- [ ] No React state update is performed on every animation frame.
- [ ] Stop/unmount cleanup and responsive Canvas resize are verified.
- [ ] Reduced-motion handling is tested.
- [ ] All automated tests pass in the actual project workspace.
- [ ] `npm run build` succeeds after the latest audit fixes.
- [ ] Memory and FPS evidence is collected; no unsupported claims are made.
- [ ] `AI_FAILURE_AUDIT.md` and `TASK_DECOMPOSITION.md` are included.
- [ ] Changes are committed and pushed to the intended repository.

## 9. Repository submission

Save this document as `Homework2/TASK_DECOMPOSITION.md`. After tests, build and manual verification:

```bash
cd ..
git add Homework2
git commit -m "docs: add HW2 task decomposition and verification plan"
git push origin main
```

> **Completion status:** Implementation is represented in the supplied source and later chat-based patches; final integration tests, FPS measurements, memory audit and build of the *latest local working copy* remain to be verified by the student.
