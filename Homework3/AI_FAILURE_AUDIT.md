# AI FAILURE AUDIT — HW3: High-Concurrency Flash-Sale E-Commerce Engine

**Audit date:** 2026-10-19  
**Stack:** React, TypeScript, Vite, Vitest  
**Evidence scope:** Static review of the complete TypeScript/React implementation supplied by the assistant in this conversation (Stages 2–6). Only the **Stage 1 archive** was available as a project file here; the student's current post-checkout source was **not supplied**. Therefore all findings below are **confirmed in the AI-proposed implementation** but **not independently confirmed in the student's latest local checkout**. No current-project build, automated test, browser runtime, heap profiling, or HW3-only Git-history verification was performed.

## 1. Evidence and status notation

- **AI-CODE-CONFIRMED:** Directly present in the previously supplied implementation in this conversation.
- **CURRENT-PROJECT-UNVERIFIED:** Must compare against the latest local files before claiming this is still present.
- **REPRODUCTION PENDING:** No executable browser/test evidence has yet been collected.
- **FIX PROPOSED:** A concrete refactor is described, not applied by this report.

**Examined AI-generated modules:** `src/utils/anti-drift-timer.ts`, `src/hooks/useCountdown.ts`, `src/types/inventory.ts`, `src/services/inventory-state-machine.ts`, `src/services/inventory-service.ts`, `src/hooks/useInventoryReservation.ts`, `src/components/OrderStatus.tsx`, `src/components/ProductCard.tsx`, `src/components/ProductGrid.tsx`, `src/App.tsx`, `src/services/inventory-service.test.ts`.

## 2. Findings summary

| ID | Area | Severity | Evidence status | Current fix status |
|---|---|---|---|---|
| HW3-01 | Checkout finalizes after service disposal | High | AI-CODE-CONFIRMED; CURRENT-PROJECT-UNVERIFIED | FIX PROPOSED |
| HW3-02 | Sale deadline reconstructed from rounded display duration | Medium | AI-CODE-CONFIRMED; CURRENT-PROJECT-UNVERIFIED | FIX PROPOSED |
| HW3-03 | UI exposes only latest reservation; previous ones cannot be checked out through UI | Medium | AI-CODE-CONFIRMED; CURRENT-PROJECT-UNVERIFIED | FIX PROPOSED |
| HW3-04 | Checkout Promise can remain pending indefinitely | High for real checkout; medium for simulated processor | AI-CODE-CONFIRMED; CURRENT-PROJECT-UNVERIFIED | FIX PROPOSED |

These are **four source-grounded deficiencies/risks in the earlier AI output**, not claims of four observed production incidents or browser-reproduced failures. The assignment requires at least three AI issues, and the first three alone satisfy the *source-analysis* portion; actual before/after reproduction must still be attached.

## 3. HW3-01 — Async checkout can mutate disposed InventoryService

**Location:** `src/services/inventory-service.ts` — `checkout()`, `finishCheckout()`, `dispose()`.

**AI-proposed behavior:** `checkout()` starts the Promise processor and later calls `finishCheckout()`; `dispose()` clears expiration timers and sets `this.disposed = true`, but it neither cancels the pending processor nor guards `finishCheckout()` against disposal.

```ts
const checkoutPromise = Promise.resolve()
  .then(() => processor())
  .then(result => this.finishCheckout(reservationId, result === true),
        () => this.finishCheckout(reservationId, false));

public dispose(): void {
  if (this.disposed) return;
  // clear expiration timers...
  this.disposed = true;
}
```

**Consequences:** Late success/failure changes internal stock/reservation even after lifecycle disposal. A late callback can continue to perform work after unmount; the React hook attempts to ignore a stale service, so a React state-after-unmount error is **not** proven. This is a service-lifecycle ambiguity and a source-observable weakness, not proof of a memory leak.

**Suggested test:** Create a reservation, start checkout with a deferred payment Promise, call `service.dispose()`, then resolve payment. Assert the documented shutdown policy: either allow an explicitly tracked settlement and wait for it on shutdown, or cancel checkout with an `AbortSignal` and return a defined cancellation/unknown-payment result. Capture terminal assertions.

**Fix:** Choose a documented lifecycle contract. For this in-memory demo, preferably expose a `shutdown()` that waits for pending checkout settlement before disposal, or abort supported simulated processors and mark the result non-committal only if no payment side effect occurred. Do not silently treat a real payment timeout as payment failure.

## 4. HW3-02 — Rounded display value extends sale admission deadline

**Location:** `src/hooks/useCountdown.ts` (`displayRemaining` uses `Math.ceil(remainingMs / 50) * 50`) and `src/App.tsx` → `reserveProduct(product.id, isEnded, remainingMs)`; `src/hooks/useInventoryReservation.ts` creates `saleDeadline = Date.now() + remainingSaleMs`.

**AI-proposed behavior:** A 50ms-quantized value intended only for rendering is used to reconstruct a new sale deadline when the user clicks Buy Now. If the latest state says 50ms remaining while the true deadline is 1ms away, `Date.now() + 50` can permit a service reservation after the true deadline. It can be even more stale when rendering/visibility updates are delayed.

**Consequences:** Frontend admission is not guaranteed to close at the exact original sale deadline. The countdown uses `Date.now()` correctly internally, but the reservation admission path does not share its authoritative absolute target.

**Suggested test:** Use fake time. Create a sale ending at T=1000, force displayed `remainingMs=50` at T=999, begin a 350ms deferred reservation request, and assert no reservation may be committed after T=1000. Compare with current behavior and record failing/passing assertions.

**Fix:** Have `useCountdown` expose `targetTime` (fixed timestamp, not the rounded display value); pass that absolute timestamp through the callback to `reserveProduct`. Before calling `service.reserve`, check `Date.now() >= targetTime`. A real backend must independently validate the sale window against server time.

## 5. HW3-03 — Only latest reservation can be reached from UI

**Location:** `src/hooks/useInventoryReservation.ts` (`latestReservation = reservations[reservations.length - 1]`); `src/App.tsx` passes only `latestReservation`; `src/components/OrderStatus.tsx` displays checkout for that one reservation.

**AI-proposed behavior:** The user can reserve item A, then reserve item B before checking out A. The UI shows B as latest and offers no way to select A. A remains reserved until expiry even though the user has a valid `reservationId`.

**Consequences:** Legitimate held stock can be stranded until TTL; buyer cannot checkout an earlier reservation using the current UI. The service can still handle the checkout if called by ID, so this is a UI reachability defect, not an overselling bug.

**Suggested test:** Reserve A and B with distinct IDs; verify both are `RESERVED` in service but only B has a Checkout button. In a React Testing Library test, assert that both active reservations should have reachable actions.

**Fix:** Return active reservations array from the hook and render a list in `OrderStatus`, with per-reservation Checkout buttons and pending status keyed by `reservationId`. Keep service as authoritative stock source. Do not change the Countdown logic.

## 6. HW3-04 — No upper bound for a hung CHECKOUT processor

**Location:** `src/services/inventory-service.ts`, `checkout()`; `src/services/inventory-service.test.ts` covers delayed payment but not a Promise that never settles.

**AI-proposed behavior:** On entry to `CHECKOUT`, reservation-expiry timeout is cleared. The service awaits the payment processor without a checkout timeout or recovery state; `CHECKOUT` is skipped by `expireReservations()`.

**Consequences:** A pending Promise that never resolves can lock `reservedStock` indefinitely. Preventing expiry during checkout is intentional and correct for normal latency, but without an independent recovery policy it can cause stock starvation. Automatically releasing on an *unknown* external payment outcome would be unsafe; this demo uses fake payments, while production requires provider reconciliation.

**Suggested test:** Return `new Promise<boolean>(() => {})` from the payment processor; advance fake time well beyond both reservation TTL and a proposed checkout timeout. Document that the original code remains `CHECKOUT` and stock stays reserved.

**Fix:** For simulated processors, add a bounded checkout timeout with a well-defined abort/fail behavior; distinguish known failure from unknown settlement. For real providers, use persistent checkout operation IDs, payment provider idempotency, reconciliation, and a durable recovery worker before stock release.

## 7. Positive source findings (not test results)

- `createAntiDriftTimer` calculates `targetTime = Date.now() + durationMs`, then `Math.max(0, targetTime - Date.now())` on each animation frame. This avoids cumulative callback-delay error; it does not guarantee callbacks fire precisely on time or immunity to changes to the computer clock.
- The timer's cleanup calls `cancelAnimationFrame` and checks `isStopped`. The UI hook removes its `visibilitychange` listener. Actual cleanup/memory behavior still needs browser evidence.
- Reservation stock check/decrement and `RESERVED -> CHECKOUT` state transition execute without `await`, preventing interleaving **within one InventoryService on one JS event loop**.
- Completion tests check `soldStock` increments once. `finishCheckout` checks the current state and returns without a second mutation if already `COMPLETED`.
- `expireReservations` only expires `RESERVED`, protecting active `CHECKOUT` and `COMPLETED` from stock release. A hung processor is the separate risk HW3-04.
- React product rows use `key={product.id}`; no unstable-product-key bug is inferred from the reviewed AI output.
- React text rendering in the reviewed snippets uses interpolation, not a demonstrated unsafe HTML injection sink. Do not invent an XSS finding.

## 8. Tests to run and evidence to capture

### Automated commands (run from `Homework3/`)

```bash
npm install
npx vitest run
npx vitest run src/services/inventory-service.test.ts
npm run build
npm run preview
```

**All results PENDING** for the student's current source. `npm run build` must exit 0, then confirm the preview URL opens and UI works. Do not equate TypeScript compilation with complete runtime correctness.

### Required regression scenarios

| Area | Test | Expected result |
|---|---|---|
| Timer | Fake `Date.now`, lag/long pause | Remaining computed from absolute deadline, never negative |
| Timer | Zero duration / invalid duration | Single `onTick(0)`; invalid values rejected |
| Timer | Unmount / remount | RAF is canceled; no duplicate active loops |
| Timer | Background tab and return | Timestamp-based remaining reconciles immediately |
| FSM | Invalid EXPIRED -> RESERVED, COMPLETED -> AVAILABLE | Rejected |
| Reservation | Stock 1, 20 Promise.all callers | Exactly 1 success in a single service instance |
| Reservation | TTL expiry | RESERVED -> EXPIRED; reserved stock released exactly once |
| Optimistic UI | Forced service rejection | Pending overlay removed, confirmed stock restored |
| Checkout | 10 Promise.all calls same ID | Processor runs once, sold stock increments once |
| Checkout | TTL passes during CHECKOUT | No stock release; processor can complete |
| Checkout | Payment false / throws | FAILED; released exactly once |
| Checkout | Repeat after COMPLETED | Idempotent success, no double decrement |
| Lifecycle | Unmount while checkout pending | Contract explicit; no unexpected update or leaked listeners |
| Multi-reservation | Reserve A then B | Both active checkout actions reachable (after fix) |
| Admission | Request started just before sale end, completes after | No reservation after true sale deadline (after fix) |
| Hung processor | Never-settling Promise | Defined checkout recovery/timeout policy (after fix) |

### Browser runtime and memory

1. Chrome DevTools **Console**: interact with Buy Now, checkout success/failure, expiration and navigation; capture errors/warnings.
2. DevTools **Performance**: record countdown before/after background tab; check scripting/RAF callback activity, not a claimed FPS number.
3. DevTools **Memory**: take baseline heap snapshot, repeatedly mount/unmount the app and run reservations, force GC if available, take a second snapshot. Inspect retained callbacks/listeners/instances. Heap growth alone is not proof of a leak because of GC/heap caching.
4. DevTools **Elements**: confirm all Buy Now buttons disable after sale expiration; inspect reservation details and accessible status text.
5. Keep terminal output and screenshots for audit appendices.

## 9. Git history / Conventional Commits

The public repository landing page was visible and reported **16 total repository commits** at the time of inspection. This number includes Homework1/2/3 and does **not establish eight HW3-specific commits**. No local `.git` repository of the student's latest project was available in the audit environment.

From the repository root, run:

```bash
git fetch origin
git log --oneline -- Homework3
git rev-list --count HEAD -- Homework3
git log --format="%h %s" -- Homework3
git status --short
```

Check that the **HW3-specific count is at least 8** and subjects use Conventional Commits (`feat(hw3): ...`, `fix(hw3): ...`, `test(hw3): ...`, `docs(hw3): ...`). Do not invent, fabricate, or split retroactive commits to claim an authentic history. If fewer than eight real commits exist, document the actual count and make legitimate additional changes in separately scoped commits only.

## 10. Homework 3 acceptance checklist

- [ ] React + TypeScript + Vite flash sale UI, responsive, >=8 products
- [ ] Product name/image/original price/sale price/discount/available stock/Buy Now
- [ ] `createAntiDriftTimer` uses absolute `Date.now` deadline and RAF
- [ ] Timer stops at zero; invalid durations and duplicate terminal tick handled
- [ ] RAF cleanup on unmount and correct background-tab return behavior
- [ ] 7 reservation states and valid/invalid transition tests
- [ ] Reservation IDs, expiry, available/reserved/sold invariants
- [ ] Reservation expiry releases stock exactly once
- [ ] Optimistic UI rollback uses service snapshot, not React state as source of truth
- [ ] Concurrency: last item, duplicated clicks, duplicate checkout IDs
- [ ] CHECKOUT -> COMPLETED / FAILED inventory accounting and idempotency
- [ ] Payment pending/expiry race and hung processor explicitly handled
- [ ] Fix/prove HW3-01 through HW3-04 against latest local code
- [ ] `npx vitest run` passing output saved
- [ ] `npm run build` passing output saved
- [ ] `npm run preview` and Chrome Console inspected
- [ ] Memory snapshots and cleanup evidence saved
- [ ] >=8 HW3-specific Git commits checked (not just total repo commits)
- [ ] Conventional Commit messages verified
- [ ] `Homework3/AI_FAILURE_AUDIT.md` committed with code references and proof
- [ ] `README.md` documents setup, constraints and tests

## 11. Submission and fix tracking

**Files to inspect/change when the actual current source is available:**

1. `src/services/inventory-service.ts`: disposal policy and hung checkout recovery.
2. `src/hooks/useCountdown.ts`, `src/App.tsx`, `src/hooks/useInventoryReservation.ts`: share immutable *absolute sale deadline* with reservation admission.
3. `src/hooks/useInventoryReservation.ts`, `src/components/OrderStatus.tsx`, `src/App.tsx`: expose and render all active reservations.
4. Add specific Vitest coverage (`src/services/inventory-service.test.ts`, `src/utils/anti-drift-timer.test.ts`, React Testing Library tests where installed).

**Current evidence verdict:** The report supplies >=3 concrete, source-based issues in the AI-produced code and exact reproduction plans. The student's actual current files, post-fix automated tests, production build, browser heap profile and HW3-only Git history **remain unverified**. Update this report with real outcomes before submission; never change unchecked items to checked without evidence.
