# TASK DECOMPOSITION — Homework 3

**Project:** High-Concurrency Flash-Sale E-Commerce Engine  
**Technology:** React, TypeScript, Vite, native CSS, Vitest  
**Scenario:** Vietnamese marketplace-style 11.11 flash sale  
**Document date:** 2026-10-19  
**Scope:** UI, zero-drift countdown, reservation finite state machine, optimistic inventory updates, simulated checkout, concurrency controls, audit, testing, and submission.

> **Evidence policy:** "Implemented in proposed code" refers to the implementation developed across the HW3 conversation. It is **not** confirmation that the latest local repository contains that implementation or that its tests/build pass. Verify the actual files and command outputs before marking tasks complete.

## 1. Project objective and system boundaries

Build a responsive Flash Sale simulation with at least eight products. A countdown must calculate the remaining time from a fixed absolute deadline using `Date.now()` and `requestAnimationFrame`. An in-memory inventory service must preserve stock invariants through reservation, expiration, and checkout. The React UI may optimistically display a pending reservation but the inventory service remains authoritative. Checkout is simulated; no money is charged and no shared server-side stock exists.

**Out of scope:** real payment gateways, user authentication, persistence across reloads, cross-tab/global transactions, and actual multi-server inventory consistency.

## 2. Task breakdown and acceptance criteria

| ID | Work package | Deliverable / key files | Acceptance criteria | Evidence status |
|---|---|---|---|---|
| T01 | Initialize Vite project | `package.json`, `vite.config.ts`, `index.html`, `src/main.tsx` | React + TypeScript starts locally | Proposed; verify |
| T02 | Organize modules | `src/components/`, `src/hooks/`, `src/services/`, `src/types/`, `src/utils/`, `src/data/` | Clear separation of display, business logic, types, and utilities | Proposed; verify |
| T03 | Define catalog contracts | `src/types/flash-sale.ts`, `src/data/products.ts` | At least 8 products; valid prices, IDs, inventory records | Proposed; verify |
| T04 | Build Flash Sale UI | `FlashSaleHeader.tsx`, `ProductCard.tsx`, `ProductGrid.tsx`, `App.css` | Product picture, original/sale price, discount, stock and Buy Now visible | Proposed; verify |
| T05 | Make layout responsive | `App.css`, `index.css` | Usable desktop/mobile grid, no critical overflow | Proposed; browser check pending |
| T06 | Implement pure anti-drift engine | `src/utils/anti-drift-timer.ts` | Absolute deadline, `Math.max(0, targetTime - Date.now())`, RAF, one completion, cancellation, invalid duration guard | Proposed; unit test pending |
| T07 | Integrate React countdown | `src/hooks/useCountdown.ts`, `CountdownTimer.tsx`, `FlashSaleHeader.tsx` | One timer per mount; stable deadline on re-render; sale end disables buying; visibility sync | Proposed; regression check pending |
| T08 | Define reservation FSM | `src/types/inventory.ts`, `src/services/inventory-state-machine.ts` | Valid/invalid transitions for AVAILABLE, RESERVING, RESERVED, CHECKOUT, COMPLETED, EXPIRED, FAILED | Proposed; unit test pending |
| T09 | Implement stock accounting | `src/services/inventory-service.ts` | `total = available + reserved + sold`; nonnegative stocks; immutable product sample data | Proposed; unit test pending |
| T10 | Implement reservation and expiry | `inventory-service.ts` | Unique reservation ID; valid quantity, TTL timestamps; expiry releases stock once | Proposed; unit test pending |
| T11 | Implement optimistic reservation UI | `src/hooks/useInventoryReservation.ts`, `ProductCard.tsx`, `ProductGrid.tsx`, `OrderStatus.tsx` | Immediate RESERVING; temporary display decrement; confirmed sync or rollback; prevent duplicate clicks | Proposed; UI check pending |
| T12 | Guard sale deadline | `useCountdown.ts`, `useInventoryReservation.ts`, `App.tsx` | Reservation compares `Date.now()` to original absolute deadline after async delay | AI audit patch proposed; regression pending |
| T13 | Implement checkout FSM flow | `inventory-service.ts` | Validate RESERVED and TTL; acquire CHECKOUT lock before awaiting; transition to COMPLETED or FAILED | Proposed; unit test pending |
| T14 | Protect checkout idempotency | `inventory-service.ts` | Concurrent calls share one in-flight result; sold counted exactly once; no release of sold stock | Proposed; `Promise.all` test pending |
| T15 | Handle checkout failure, timeout, disposal | `inventory-service.ts` | Failure releases once; hung simulated processor times out; late callbacks cannot mutate finalized stock | AI audit patch proposed; tests pending |
| T16 | Display multiple reservations and checkout actions | `OrderStatus.tsx`, `useInventoryReservation.ts`, `App.tsx` | Every eligible reservation can be selected independently; terminal status visible | AI audit patch proposed; UI check pending |
| T17 | Test inventory and async concurrency | `inventory-service.test.ts`, `inventory-audit.test.ts` | Last-item contention, expiry, repeated checkout, failure, late success, dispose, invariants | Test code proposed; run pending |
| T18 | Audit AI failure modes | `AI_FAILURE_AUDIT.md` | At least 3 actual code-backed findings; root cause, consequence, reproduction, fix, regression evidence | Draft provided; latest source verification pending |
| T19 | Performance and lifecycle checks | Chrome DevTools Console / Performance / Memory | RAF cleanup, visibility behavior, no unexplained growing detached nodes/listeners or runtime errors | Manual verification pending |
| T20 | Production build and packaging | `npm run build`, `npm run preview`, repository | Build exits 0; production preview loads and passes smoke test | Not independently verified |
| T21 | Git and submission | Git history, README, audit, screenshots | At least 8 **HW3-related** atomic Conventional Commits; clean status; all requested artifacts included | Not verified |

## 3. Dependency order and suggested work stages

| Stage | Tasks | Milestone |
|---|---|---|
| 1 — Foundation | T01–T05 | Responsive mock Flash Sale with 8 products |
| 2 — Timer engine | T06 | Pure zero-drift countdown with unit tests |
| 3 — Timer UI | T07 | Countdown integrated without re-render resets |
| 4 — Inventory model | T08–T10 | Reservation state machine and stock lifecycle |
| 5 — Optimistic locking UI | T11–T12 | Immediate pending UI, correct rollback, hard sale cutoff |
| 6 — Checkout/concurrency | T13–T16 | Exactly-once local checkout and bounded simulation |
| 7 — QA and submission | T17–T21 | Audit, regression tests, browser validation, Git evidence |

## 4. State-machine specification

Allowed transitions:

```text
AVAILABLE -> RESERVING
RESERVING -> RESERVED | FAILED
RESERVED -> EXPIRED | CHECKOUT
CHECKOUT -> COMPLETED | FAILED
COMPLETED, EXPIRED, FAILED -> no further transitions
```

`AVAILABLE` and `RESERVING` are workflow states; a successful `reserve()` commonly returns a persisted reservation at `RESERVED`. The status transition to `CHECKOUT` must be synchronous and precede the first `await`. A reservation being checked out is not released by reservation TTL. The simulated checkout timeout/failure policy releases stock exactly once. A real payment provider requires reconciliation of uncertain outcomes rather than treating every timeout as proven payment failure.

**Inventory invariant:**

```text
totalStock = availableStock + reservedStock + soldStock
availableStock >= 0
reservedStock >= 0
soldStock >= 0
```

### Example with totalStock = 10, quantity = 2

| Event | Available | Reserved | Sold |
|---|---:|---:|---:|
| Initial | 10 | 0 | 0 |
| RESERVED | 8 | 2 | 0 |
| CHECKOUT started | 8 | 2 | 0 |
| COMPLETED | 8 | 0 | 2 |
| Alternate FAILED outcome | 10 | 0 | 0 |
| Alternate EXPIRED before checkout | 10 | 0 | 0 |

## 5. Test plan

| Test ID | Scenario | Expected result | Method |
|---|---|---|---|
| AT01 | Duration `0`, negative, `NaN`, `Infinity` | Zero fires once; invalid values throw | Fake RAF/Date tests |
| AT02 | Jump clock ahead during countdown | Remaining derives from actual deadline, no accumulated tick drift | Fake clock |
| AT03 | Unmount countdown | Scheduled RAF cancelled, listeners cleaned up | React lifecycle test / DevTools |
| AT04 | Hide tab, wait, return | Remaining and ended state catch up from `Date.now()` | Browser visibility test |
| AT05 | Reserve valid quantity | Available decreases and Reserved increases by quantity | Unit test |
| AT06 | Reserve more than available | Rejection without negative stock | Unit test |
| AT07 | 20 simultaneous logical buyers, stock=1 | Exactly one success within a single service instance | `Promise.all` |
| AT08 | Expire reservation | Returns held stock once; status EXPIRED | Fake timers and `Date.now()` |
| AT09 | Click Buy Now rapidly | One pending request for that product | UI interaction test |
| AT10 | Force reservation rejection | Optimistic stock rolls back to confirmed snapshot | UI test |
| AT11 | Sale ends during simulated network wait | No reservation accepted after absolute deadline | Fake clock/UI integration test |
| AT12 | Multiple reservations | Each eligible reservation has its own checkout action | UI test |
| AT13 | 20 concurrent checkout requests, one reservation | Payment processor invoked once; sold count updated once | `Promise.all` |
| AT14 | Checkout success then repeat callback/request | COMPLETED remains; no second sold increment | Unit test |
| AT15 | TTL elapses while CHECKOUT | Stock remains held until checkout settles | Fake timers |
| AT16 | Checkout failure or rejection | FAILED; reserved stock released once | Unit test |
| AT17 | Payment Promise never settles | Checkout simulation times out; no indefinite local lock | Fake timers |
| AT18 | Dispose service mid-checkout | Late callback ignored; no post-dispose stock mutation | Deferred Promise |
| AT19 | Completed checkout after original TTL | Sold stock stays sold; never returned to Available | Fake clock |
| AT20 | Build + browser smoke | Build succeeds, preview works, no critical Console errors | CLI / browser |
| AT21 | Memory/performance | No unexplained retained RAF chains, timers, or listeners on repeated mount/unmount | DevTools snapshots/Performance |

**Test scope limit:** Tests with `Promise.all` provide single-runtime concurrency simulation. They do not prove distributed safety across tabs, processes, or servers.

## 6. AI failure audit mapping

The prior AI-assisted implementation and subsequent audit discussion identified these **source-code risks in the proposed versions**. They must be rechecked against the student's latest repository before claiming they remain present or that fixes are validated.

| Finding | Affected files | Why it matters | Proposed correction | Verification |
|---|---|---|---|---|
| HW3-01 — Checkout settles after service disposal | `inventory-service.ts` | Late callbacks can mutate a disposed service | Settle pending mock checkout safely, ignore late processor completion | Deferred Promise + dispose test |
| HW3-02 — Deadline reconstructed from rounded UI remaining time | `useCountdown.ts`, `useInventoryReservation.ts`, `App.tsx` | Reservation may be accepted marginally after true sale end | Propagate immutable absolute `targetTime`; check after async delay | Boundary-time test |
| HW3-03 — Only latest reservation displayed | `useInventoryReservation.ts`, `OrderStatus.tsx` | Earlier held reservations are not reachable for checkout from UI | Display all reservations with stable ID keys and per-item Checkout | Multi-reservation UI test |
| HW3-04 — Hanging checkout holds stock indefinitely | `inventory-service.ts` | Never-resolving processor keeps reservation locked | Bounded simulated checkout timeout, idempotent settlement | Never-resolving Promise test |

**Audit status:** proposed source findings and patches, not independently reproduced from the latest project artifact. Save actual terminal and browser evidence before reporting as fixed or verified. Do not invent screenshots, successful test output, or a memory-leak result.

## 7. Suggested Conventional Commit plan (at least 8 HW3 commits)

Commit messages must describe changes actually included in each commit. Example milestones:

1. `chore(hw3): initialize React TypeScript Vite project`
2. `feat(hw3): create flash sale catalog and responsive UI`
3. `feat(hw3): implement zero-drift timer engine`
4. `feat(hw3): integrate countdown with React UI`
5. `feat(hw3): add inventory reservation state machine`
6. `feat(hw3): implement optimistic inventory updates`
7. `feat(hw3): implement checkout concurrency protection`
8. `test(hw3): cover checkout races and expiry behavior`
9. `fix(hw3): address AI audit lifecycle and deadline issues`
10. `docs(hw3): add failure audit and task decomposition`

**Do not fabricate history or split an already completed implementation into artificial commits solely to change the count.** Verify actual repository history and explain any shortfall transparently.

Commands from repository root:

```bash
git log --oneline -- Homework3
git rev-list --count HEAD -- Homework3
git log --format="%h %s" -- Homework3
git status
```

## 8. Build, automated tests, and browser verification

From `web-hw-lab02/Homework3`:

```bash
npm install
npm run build
npx vitest run
npx vitest run src/services/inventory-audit.test.ts
npm run dev
```

For the built app:

```bash
npm run preview
```

Use Chrome DevTools:

- **Console:** inspect runtime errors, warnings, stale state updates.
- **Performance:** record timer activity and long tasks; evaluate hidden/visible tab transitions.
- **Memory:** compare heap snapshots after repeated reservation/checkout cycles and unmount/remount, using garbage collection where appropriate.
- **Network / Application:** confirm the demo does not claim a real payment, inspect unexpected requests, and note that inventory data is not persisted.

Collect screenshots or logs with test date, app version/commit hash, command, exit status, and any failures. Passing results must come from actual execution.

## 9. Submission checklist

- [ ] `Homework3/` contains all TypeScript, React, CSS, and asset files.
- [ ] At least eight sample products render with correct pricing/discounts/stock.
- [ ] Responsive layout tested on desktop and mobile.
- [ ] Anti-drift countdown tested for zero, lag, visibility, and cleanup.
- [ ] Sale end blocks new reservations; existing eligible checkout policy is documented.
- [ ] FSM transitions covered by tests, including invalid transitions.
- [ ] Reservation TTL and double-release protection verified.
- [ ] Optimistic UI and rollback verified.
- [ ] `Promise.all` reservation and checkout simulations verified.
- [ ] No overselling / double-checkout / double-sale in one service instance.
- [ ] Checkout timeout and disposal regression tests verified.
- [ ] `AI_FAILURE_AUDIT.md` documents >=3 real, evidence-backed findings with fixes/test plans.
- [ ] Browser Console / Performance / Memory results captured, not assumed.
- [ ] `npm run build` succeeds on the final source.
- [ ] `npx vitest run` succeeds on the final source.
- [ ] Production preview smoke test succeeds.
- [ ] At least 8 HW3-related commits and Conventional Commit subjects confirmed from Git history.
- [ ] `git status` clean; README/setup instructions and audit documentation included.
- [ ] Latest changes pushed to the intended branch/repository.

## 10. Definition of done

HW3 can be marked complete only after the current source matches the specification, the build and tests are executed successfully, the four audit concerns are rechecked against the latest code, browser lifecycle behavior is manually evaluated, and the submission artifacts and Git history meet the rubric. Until those checks are performed, implementation is **proposed / pending verification**, not certified complete.
