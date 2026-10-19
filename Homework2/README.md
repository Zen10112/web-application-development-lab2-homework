# HW2 – FIFO Audio Queue Engine (Phase 1)

React + TypeScript + Vite. Implements a single-worker FIFO queue that fetches and decodes audio with AbortController, plus a simulated three-track queue demo and Vitest unit tests. This phase intentionally does **not** include a visualizer.

## Setup

From the Homework2 folder:

```bash
npm install
npm run dev
```

Open the local URL shown by Vite (typically http://localhost:5173).
Click **Run FIFO Test**; events must occur in A → B → C order even though B has a shorter delay.

## Tests and build

```bash
npm run test
npm run build
npm run preview
```

The demo URLs (`demo://...`) are deliberately mocked. To load real audio, instantiate `AudioTaskQueue` without a custom loader and enqueue real URLs that allow fetching through CORS.

## File map
- `src/controllers/audio-queue-controller.ts`: FIFO engine, single worker, cancellation.
- `src/controllers/audio-queue-controller.test.ts`: FIFO, concurrency, error, cancel unit tests.
- `src/data/demo-tracks.ts`: mock three-track data.
- `src/components/QueueDemo.tsx`: React demo of enqueue behavior.
- `src/App.tsx`, `src/App.css`, `src/index.css`: page and styling.

## Important scope
Audio playback and Canvas/SVG frequency visualization will be implemented in later phases. `decodeAudioData` cannot be aborted mid-decode; the queue checks AbortSignal afterward and discards cancelled results.
