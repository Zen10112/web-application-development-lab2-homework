# AI FAILURE AUDIT — Homework 1: Enterprise Data-Grid

**Audit date:** 2026-10-16  
**Project:** React 19 + TypeScript + Vite, `Homework1.zip` supplied for review  
**Scope:** Source-code audit of `src/` (especially `src/components/DataGrid.tsx`) against the “AI Failure Mode Audit: Detecting Hallucinations & Security Holes” assignment.  
**Important evidence status:** Three issues below were **identified by static code inspection**, not proven by a browser recording. Reproduction steps are provided for the student to collect DevTools proof. Fix snippets are **proposed**, not applied to the submitted source. Do not mark an issue as dynamically reproduced or fixed until the steps have been performed.

## 1. Audit of the three AI failure patterns on the slide

| Failure pattern on slide | Finding in the actual source | Evidence |
|---|---|---|
| **Security: unsafe `innerHTML` / XSS** | **Not found.** Values are rendered as React text using `{String(item[column.accessorKey] ?? "")}`; React escapes inserted strings by default. No `innerHTML` / `dangerouslySetInnerHTML` is used in the reviewed `src/`. | `src/components/DataGrid.tsx`, lines 375–412 (especially 409–411). |
| **Memory leak: attaching listeners during render without cleanup** | **Not found in the audited component.** Keyboard handlers are React `onKeyDown` props, not repeated `addEventListener` calls. The only `useEffect` performs a focus operation, not listener registration. | `DataGrid.tsx`, lines 127–135, 189–230 and 400–407. |
| **Phantom / unstable React keys** | **Found.** Grid rows use a page-position index as the React key, which can represent a different employee after sorting or filtering. This risks React reusing DOM nodes for different records. | `DataGrid.tsx`, line 360. |

**Conclusion:** It would be inaccurate to claim that this project contains all three example bugs from the slide. Instead, the three actual code risks documented below are: an unstable key, focus management after data changes, and selection identity tied to object references.

---

## Finding 01 — Unstable React row keys (confirmed by source)

**Category:** React correctness / “Phantom Keys”  
**Severity:** Medium  
**File and line:** `src/components/DataGrid.tsx:360`

### AI-generated code found

```tsx
<tr
  role="row"
  key={(safePage - 1) * PAGE_SIZE + rowIndex}
  aria-selected={isSelected}
>
```

### Why this is risky

The key is the item's **current location**, not its identity. When sorting or filtering changes the order, React may reuse the same row node for a different employee. It may appear harmless while each cell is plain text, but can cause stale component-local state or incorrect focus/animation when the row later contains interactive children. A position key is **not** proof of “total DOM destruction every render”; that wording on the slide is an overstatement for this particular code.

### How to detect / gather proof

1. Start the application and open **Chrome DevTools → Elements**.
2. Inspect the first `<tr>` of `<tbody>` and note its displayed employee.
3. Sort the **Name** or **Salary** column in reverse order and observe that the same row position now represents a different record.
4. For a stronger demonstration, temporarily add a stateful child component or instrument row mount/unmount; compare behavior with an ID-based key. Screenshot the code at line 360 and the before/after table. **Note:** A simple Elements screenshot does not by itself prove a visible bug.

### Proposed manual refactor

Because `DataGrid<T>` is generic and the contract cannot be changed, don't assume every `T` has an `ID` field inside the reusable component. Two practical options:

- **Minimal fix specific to the supplied employee dataset:** In `App.tsx`, wrap/extend a grid variant that uses `Employee.ID` for row keys, while keeping `DataGridProps<T>` unchanged.
- **Reusable fix:** Internally assign stable keys to records by object identity (e.g. persistent `WeakMap<object, number>`), and document that immutable replacement of an entire dataset can create new identities. For persistent server data, a stable ID is preferable; a future API change could add `getRowId`, but that would alter the specified contract and is **not** proposed for this homework.

Illustrative generic solution (for object records):

```tsx
const rowIdsRef = useRef(new WeakMap<object, number>());
const nextIdRef = useRef(0);

function getRowKey(item: T): number {
  if (typeof item !== "object" || item === null) {
    throw new Error("DataGrid rows must be non-null objects");
  }
  const existing = rowIdsRef.current.get(item);
  if (existing !== undefined) return existing;
  const id = ++nextIdRef.current;
  rowIdsRef.current.set(item, id);
  return id;
}
// In the map: <tr key={getRowKey(item)} ...>
```

This addresses the uploaded `Employee[]` use case. Before adopting it broadly, confirm the expected lifecycle of records and identity across data reloads.

**Fix status:** Proposed only; **not yet verified** in browser.

---

## Finding 02 — Keyboard focus can be lost/stale after sort, filter or pagination (confirmed risk from source)

**Category:** Accessibility / focus management / roving tabindex  
**Severity:** High  
**File and lines:** `src/components/DataGrid.tsx:127–135`, `232–257`, `354–407`

### AI-generated code found

```tsx
useEffect(() => {
  if (!focusPending.current) return;
  focusPending.current = false;
  const key = `${safeRow}-${safeColumn}`;
  cellRefs.current.get(key)?.focus();
}, [safeRow, safeColumn]);
```

The `handleSort`, `handleSearch` and `changePage` functions update the active cell to `{ row: 0, column: 0 }` but **do not set `focusPending.current`**. If focus was on a data cell that is removed or replaced, the effect may not restore focus. If row/column were already zero, the effect dependencies may not change at all. When filtering yields zero results, no data cell exists to receive focus.

### How to detect / gather proof

1. Focus a data cell with Tab, then navigate to another row with ArrowDown.
2. While changing sorting/filtering/page, observe the focused element via DevTools Console:
   ```js
   document.activeElement
   ```
3. Filter to zero results, then clear the filter. Check whether focus is visible and whether only one existing `<td>` has `tabindex="0"`.
4. In **Elements**, inspect `document.activeElement`, `tabindex`, and the related grid DOM after the change. Capture screenshots/video.

**Qualification:** Changing pages by clicking a native Next button normally leaves focus on that button; that is not automatically a bug. The concrete risk is a **stale or missing roving-tabindex target after content changes**, especially when cells are remounted or an empty result is restored.

### Proposed manual refactor

Define an explicit, consistent focus policy: when sorting from a header button, keep focus on the button; when filtering from the search input, keep focus in that input; when moving within grid, restore focus to a valid cell; when an empty grid is shown, let the user return through Tab to the search input or a focusable status message. Coordinate focus restoration with DOM commit using `useLayoutEffect` or a focused ref callback **only when a focus move was actually requested**. Do not forcibly steal focus from the search input or pagination buttons.

Example guard for the focus helper:

```tsx
const moveFocus = (row: number, column: number) => {
  if (paginatedData.length === 0 || columns.length === 0) return;
  const nextRow = Math.max(0, Math.min(row, paginatedData.length - 1));
  const nextCol = Math.max(0, Math.min(column, columns.length - 1));
  if (nextRow === safeRow && nextCol === safeColumn) return;
  focusPending.current = true;
  setActiveCell({ row: nextRow, column: nextCol });
};
```

This guard improves boundary handling but **does not alone complete the post-filter / post-page focus policy**; test it with NVDA and keyboard before marking the fix done.

**Fix status:** Proposed only; **requires keyboard and screen-reader verification**.

---

## Finding 03 — Selection uses object reference instead of stable employee identity (confirmed by source)

**Category:** React state / data integrity / UI selection  
**Severity:** Medium  
**File and lines:** `src/components/DataGrid.tsx:41–44`, `165–187`, `354–364`

### AI-generated code found

```tsx
const [selectedRows, setSelectedRows] = useState<Set<T>>(
  () => new Set<T>()
);

const isSelected = selectedRows.has(item);
```

### Why this is risky

`Set<T>` compares objects by reference. If an external parent reloads `data` with **new objects representing the same employee ID**, the selected employee no longer matches `selectedRows.has(item)`; the blue highlight and `aria-selected` state can disappear although the business record is unchanged. Old record references can also remain in state until cleared. With the supplied constant `employees` array, this problem is not necessarily visible during normal sorting and pagination.

Another usability detail: Enter **adds** a row to the selection and invokes `onRowSelect`, while Space **toggles** it. Verify that this matches the assignment and that selection announcements are understandable.

### How to detect / gather proof

1. Press Space to select an employee; confirm `aria-selected="true"` in DevTools.
2. For testing only, make a parent rerender with a **new array of cloned employee objects** (same `ID` values):
   ```tsx
   const refreshed = employees.map((employee) => ({ ...employee }));
   ```
3. Supply `refreshed` as the `data` prop and inspect the same employee's `aria-selected` and highlight.
4. Restore the original data source after the test; screenshot both the state change and the relevant `Set<T>` lines.

### Proposed manual refactor

For **this dataset**, select by `Employee.ID` instead of the object reference, for example `Set<number>`. Because the assignment contract's `DataGrid<T>` is generic, do not access `item.ID` directly inside an unconstrained `T`; either use an internal row identity strategy shared with Finding 01, or provide an Employee-specific wrapper outside the generic component.

Illustrative Employee-specific idea:

```tsx
const [selectedIds, setSelectedIds] = useState<Set<number>>(
  () => new Set()
);

// On selection:
setSelectedIds((previous) => {
  const next = new Set(previous);
  if (next.has(employee.ID)) next.delete(employee.ID);
  else next.add(employee.ID);
  return next;
});
```

Keep `aria-selected` synchronized with the same stable ID set and retain the specified `onRowSelect?: (item: T) => void` callback API.

**Fix status:** Proposed only; **not verified**.

---

## 2. Supplemental code-quality and accessibility observations

- **Positive:** `data-grid-contract.ts` matches the two assignment interfaces exactly. The component uses native `<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>` and `<button>` elements. User data is rendered as React text, which avoids the unsafe `innerHTML` pattern in the slide.
- **Sorting:** `[...filteredData].sort(...)` makes a copy rather than mutating `props.data`. Numeric and string comparisons are implemented.
- **ARIA:** `aria-sort` appears only on the currently sorted column; the table uses `role="grid"`, and rows use `aria-selected`. Further manual NVDA/VoiceOver verification is required.
- **Security:** Absence of unsafe `innerHTML` in reviewed source does not constitute a comprehensive security penetration test.
- **Focus and pagination:** There is no explicit `aria-rowindex` / `aria-rowcount` metadata for a paginated grid. Depending on screen-reader behavior, adding accurate total counts and global row indices may improve announcements; validate rather than guessing.
- **Contrast:** CSS uses high-contrast dark text and a visible outline, but **no programmatic color-contrast audit or browser zoom/reflow test** was completed here.
- **Build:** `node node_modules/typescript/bin/tsc -b` completed without diagnostics in this environment. `npm run build` could not be independently completed from the uploaded Windows `node_modules`: Unix reported `vite: Permission denied`; invoking Vite via Node then failed because Rollup's Linux-native optional dependency was missing (`MODULE_NOT_FOUND`). This is an **environment/platform mismatch**, not evidence of a source build failure. Run `npm install` and `npm run build` on the student's machine and capture the result.
- **Lighthouse:** **Not run**. Accessibility and Best Practices scores are **unverified**; do not claim 100/100.

## 3. Evidence checklist to attach before submission

- [ ] Screenshot of source lines for each of the three findings.
- [ ] Chrome DevTools **Elements** screenshot of row identity/order before and after sorting.
- [ ] DevTools `document.activeElement` / `tabindex` snapshots for keyboard focus before and after filter or page changes.
- [ ] Selection state and `aria-selected` screenshots before and after replacing data with cloned objects.
- [ ] `npm run build` terminal output from the student's own machine.
- [ ] Lighthouse **Accessibility** and **Best Practices** report (production preview), recording actual measured scores.
- [ ] NVDA or VoiceOver manual keyboard test notes: Arrow keys, Enter, Space, sorting, pagination, empty results.
- [ ] After changing code, repeat each reproduction test and record **before/after** behavior plus the Git diff or commit.

## 4. Suggested refactoring procedure (manual work, not falsely marked complete)

1. Commit the original source as an audit baseline.
2. Reproduce each issue and collect DevTools evidence.
3. Fix unstable React keys using stable record identity without altering the required `DataGridProps<T>` interface.
4. Define and implement a focus restoration policy after data changes, taking care not to steal focus from input or navigation buttons.
5. Replace object-reference selection with stable record identity for this employee dataset; synchronize `aria-selected`.
6. Run `npm run build`, functional tests, keyboard tests, NVDA, and Lighthouse. Record actual results rather than assumed scores.
7. Commit the fixes and link their Git diff in this report.

## 5. Final audit status

| Requirement | Status |
|---|---|
| Source reviewed | **Completed** |
| Three code risks identified and documented | **Completed (static analysis)** |
| Unsafe `innerHTML` in submitted source | **Not found** |
| Render-time uncleaned DOM listeners | **Not found** |
| Three reproduction tests on browser | **Pending student DevTools evidence** |
| Manual refactor applied to project | **Pending** |
| TypeScript static compile | **Completed in audit environment** |
| Full Vite production build | **Not verified (cross-platform dependency issue)** |
| Lighthouse 100/100 | **Not verified** |
| Full WCAG 2.2 AA compliance | **Not verified** |

> **Academic integrity note:** The example vulnerabilities in the assignment slide are examples, not a license to invent findings. This report records the source as found and separates confirmed code facts from possible user-visible outcomes and tests still required.
