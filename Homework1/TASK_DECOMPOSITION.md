# TASK DECOMPOSITION — HOMEWORK 1

**Project:** Production Enterprise Data-Grid (WCAG 2.2 Level AA)  
**Technology stack:** React, TypeScript, Vite, CSS  
**Estimated duration:** 1 week  
**Scope:** Generic data grid, sorting, filtering, pagination, keyboard interaction, ARIA, accessibility validation, and AI-failure audit.

> **Evidence note:** This task breakdown is based on the homework specification, the supplied `Homework1.zip` source, and the development steps described in the project conversation. The ZIP may predate the latest local edits. Tasks marked *Implemented / requires re-test* must not be interpreted as verified passing in the latest version. Lighthouse 100/100 and WCAG conformance remain **unverified** until supported by actual audit evidence.

## 1. Objective

Build a reusable `DataGrid<T>` component that preserves the exact TypeScript interface contract, uses semantic HTML table elements, supports sorting/filtering/pagination and keyboard-based row selection, and can be validated against WCAG 2.2 AA and Lighthouse Accessibility / Best Practices targets.

## 2. Requirements decomposition

| ID | Task | Subtasks / implementation plan | Main files | Completion criteria | Status |
|---|---|---|---|---|---|
| T01 | Project setup | Initialize React + TypeScript with Vite; install dependencies; create folder structure | `package.json`, `vite.config.ts`, `src/` | `npm install` and Vite dev server work | Implemented; re-check locally |
| T02 | TypeScript contract | Define `ColumnDef<T>` and `DataGridProps<T>` exactly as given; preserve optional `sortable` and `onRowSelect` | `src/types/data-grid-contract.ts` | Interfaces match assignment without added required props | Implemented; verify exact source |
| T03 | Generic semantic table | Render `table`, `thead`, `tbody`, `th scope="col"`, `td`; map configured columns and records | `src/components/DataGrid.tsx` | Any compatible object collection displays in a readable table | Implemented; re-test |
| T04 | Sample dataset and page | Create 30 employees with ID, Name, Department, Position, Salary; wire columns from App | `src/data/employees.ts`, `src/App.tsx` | 30 employees; 5 correct columns | Implemented; re-test |
| T05 | Sorting | Click sortable header; toggle ascending/descending; compare strings and numbers; avoid mutating props; expose `aria-sort` | `DataGrid.tsx` | Both directions work; non-sortable columns inactive | Implemented; re-test |
| T06 | Filtering | Accessible search label; case-insensitive matching; empty-state message; reset page on input change | `DataGrid.tsx` | Search works across configured columns; zero matches handled | Implemented; re-test |
| T07 | Pagination | Page size = 10; Previous/Next native buttons; disabled boundaries; page counter | `DataGrid.tsx` | 30 rows -> 3 pages; correct pages after filtering | Implemented; re-test |
| T08 | Keyboard grid | Arrow Up/Down/Left/Right; Enter invokes `onRowSelect`; Space toggles selection; boundary checks | `DataGrid.tsx` | All keys work at first/last row/column and after data changes | Implemented; needs manual regression |
| T09 | Focus management | Roving `tabIndex`; store active location/record; restore valid focus after grid changes; avoid focus trapping | `DataGrid.tsx` | Exactly one reachable active data cell per non-empty page; Tab exits normally | Revised after audit; needs browser test |
| T10 | Accessible semantics | Native HTML structure plus appropriate `grid`, `row`, `gridcell`, `columnheader`; `aria-label`, `aria-selected`, `aria-sort` | `DataGrid.tsx` | Accessibility tree reflects content, labels, sort, and selection | Implemented; needs screen-reader test |
| T11 | CSS accessibility | Visible focus, separate hover/selection states, readable contrast, horizontal scroll, responsive layout | `DataGrid.css`, `App.css`, `index.css` | Normal text meets 4.5:1; keyboard focus visible; 200%/400% zoom usable | Implemented; contrast/zoom not yet verified |
| T12 | AI failure audit and refactoring | Review XSS, memory leaks, unstable keys; record 3 actual risks; fix unstable keys, stale focus, selection identity | `AI_FAILURE_AUDIT.md`, `DataGrid.tsx` | Findings are truthful, fixes match actual code, before/after evidence available | Audit drafted; fixes reported; re-test needed |
| T13 | Technical verification | Run `npm run build`; inspect browser Console; verify sorting+filtering+pagination+selection together | Entire project | No TypeScript/build errors or interaction regressions | Pending latest-build evidence |
| T14 | Accessibility verification | Test with keyboard, NVDA/VoiceOver, contrast checker, zoom; run Lighthouse on production preview | Browser/DevTools; report screenshots | No unresolved major issues; 100 Accessibility and 100 Best Practices **documented if achieved** | Pending evidence |
| T15 | Documentation & delivery | Update README, include audit and test evidence, check Git status, commit/push | `README.md`, `AI_FAILURE_AUDIT.md`, screenshots, repository | Reproducible setup; working code and evidence committed | Pending final confirmation |

## 3. One-week implementation plan

| Day | Task IDs | Deliverable |
|---|---|---|
| Day 1 | T01–T04 | Vite project, contracts, semantic table, 30 employees |
| Day 2 | T05–T06 | Working sorting and search |
| Day 3 | T07–T08 | Pagination and keyboard commands |
| Day 4 | T09–T11 | Focus management, ARIA semantics, accessible styling |
| Day 5 | T12 | AI-failure audit report and source refactoring |
| Day 6 | T13–T14 | Build, functional tests, screen-reader and Lighthouse evidence |
| Day 7 | T14–T15 | Fix verified issues, documentation, final push |

## 4. Dependencies and processing order

```text
Project setup (T01)
  -> Type contract (T02)
  -> Semantic grid + sample data (T03, T04)
  -> Sorting, filtering, pagination (T05, T06, T07)
  -> Keyboard interaction + roving focus (T08, T09)
  -> ARIA + CSS accessibility (T10, T11)
  -> AI audit and refactor (T12)
  -> Build + interaction tests (T13)
  -> Screen-reader / Lighthouse audit (T14)
  -> Documentation + GitHub delivery (T15)
```

**Data pipeline:** `props.data -> filtering -> sorting -> pagination -> table rendering`. Keep computations immutable. Reset to page 1 when a search query changes.

## 5. Test cases and required evidence

| Test ID | Feature | Procedure | Expected result | Evidence |
|---|---|---|---|---|
| TC01 | Generic/semantic HTML | Inspect DOM and contract | Native table structure; `scope="col"`; contract unchanged | Code / Elements screenshot |
| TC02 | String sort | Click Name twice | A–Z, then Z–A | Screenshots of both orders |
| TC03 | Number sort | Click Salary twice | Correct numeric ascending/descending | Screenshots |
| TC04 | Filtering | Search `ENGINEERING`, then an impossible term | Case-insensitive results; empty-state message | Screenshots |
| TC05 | Pagination | Use Next/Previous with 30 employees | Pages 1–3; no out-of-range page | Screenshots |
| TC06 | Combined behavior | Filter, sort, change page | Correct order, count and page boundaries | Screenshot / manual log |
| TC07 | Arrow navigation | Move in all four directions and at corners | Focus moves one cell; remains within boundary | Manual keyboard recording |
| TC08 | Row selection | Enter, then Space twice | Callback executes on Enter; Space toggles selected state | Console + Elements screenshots |
| TC09 | Focus resilience | Sort/filter/change page while interacting | No unexpected focus loss or trapping | Manual keyboard recording |
| TC10 | Screen reader | Test with NVDA or VoiceOver | Header/value/selection/sort meaning conveyed | Device/browser/test notes |
| TC11 | Contrast + zoom | Check text colors; zoom 200% and 400% | >=4.5:1 regular text; no unusable controls/content | Contrast output + screenshots |
| TC12 | Production build | `npm run build`; `npm run preview` | Successful compile and usable production page | Terminal output |
| TC13 | Lighthouse | Audit production page, Desktop (and Mobile if required) | Record actual Accessibility and Best Practices scores; fix flagged issues | Exported Lighthouse report |
| TC14 | AI audit | Confirm fixes for 3 documented issues | Stable keys, resilient focus, stable selection identities | Code diff + reproduction evidence |

## 6. AI failure mode audit mapping

The assignment slide lists three classic failure modes; the provided source audit did **not** find all three exact examples:

| Failure mode on slide | Source-based observation | Response |
|---|---|---|
| Unsafe `innerHTML` / stored XSS | Not found in reviewed source; React renders values as text | Keep text rendering safe; avoid `dangerouslySetInnerHTML`; document the negative finding |
| Render-time event listeners / memory leaks | Not found in reviewed grid; React event handlers are used | Continue using React handlers; cleanup any future native listeners |
| Phantom/unstable React keys | Index-based row keys were found in supplied source | Use a stable record identity; verify after sorting/filtering |

The audit also documented real focus-management and object-reference-selection risks. Refer to `AI_FAILURE_AUDIT.md` for their reproduction procedures and proposed fixes. If local source has since changed, re-check it rather than assuming the previous findings still apply.

## 7. Final definition of done

- [ ] Exact `ColumnDef<T>` / `DataGridProps<T>` interfaces confirmed.
- [ ] Semantic table and ARIA grid structure validated.
- [ ] 30 sample employees displayed; 10 records per page.
- [ ] Sorting, filtering and pagination pass independently and together.
- [ ] Arrow keys, Enter, Space, focus boundaries and Tab behavior pass.
- [ ] Row selection remains correct after sort/filter/page changes.
- [ ] Accessibility labels, `aria-sort`, `aria-selected` and announcements verified using a screen reader.
- [ ] Contrast and zoom/reflow checked with evidence.
- [ ] `npm run build` succeeds for the latest source.
- [ ] Lighthouse Accessibility **100/100** verified by saved report, or actual lower score documented with unresolved items.
- [ ] Lighthouse Best Practices **100/100** verified by saved report, or actual lower score documented with unresolved items.
- [ ] All known WCAG 2.2 AA failures resolved or explicitly disclosed.
- [ ] `AI_FAILURE_AUDIT.md` truthfully documents findings, fixes and proof.
- [ ] Source, report and evidence pushed to GitHub.

## 8. Build and verification commands

From repository root `web-hw-lab02`:

```bash
cd Homework1
npm install
npm run build
npm run preview
```

Open the preview URL printed by Vite (commonly `http://localhost:4173/`), run Chrome DevTools Lighthouse, and save the report. Perform keyboard and screen-reader tests manually.

From the Git repository root, after verification:

```bash
git add Homework1
git commit -m "docs: add HW1 task decomposition and verification plan"
git push origin main
```

**Submission note:** Do not present unchecked checklist items as completed or claim Lighthouse 100/100 without a real audit report.
