
import {
  useLayoutEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent } from "react";
import type { DataGridProps } from "../types/data-grid-contract";
import "./DataGrid.css";

const PAGE_SIZE = 10;

type SortDirection = "ascending" | "descending";

interface ActiveCell {
  row: number;
  column: number;
}

export default function DataGrid<T>({
  data,
  columns,
  onRowSelect,
  ariaLabel,
}: DataGridProps<T>) {
  // =========================
  // 1. STATE
  // =========================

  const [search, setSearch] = useState("");

  const [sortKey, setSortKey] = useState<keyof T | null>(null);

  const [sortDirection, setSortDirection] =
    useState<SortDirection>("ascending");

  const [currentPage, setCurrentPage] = useState(1);

  const [activeCell, setActiveCell] = useState<ActiveCell>({
    row: 0,
    column: 0,
  });

  const [activeRecordKey, setActiveRecordKey] =
    useState<string | null>(null);

  // FIX 1: Lưu selection theo ID thay vì object reference
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set<string>()
  );

  // =========================
  // 2. REFS & ACCESSIBILITY
  // =========================

  const cellRefs = useRef<
    Map<string, HTMLTableCellElement>
  >(new Map());

  const gridRef = useRef<HTMLTableElement>(null);

  const focusPending = useRef(false);

  const gridHadFocus = useRef(false);

  const searchId = useId();
  const statusId = useId();
  const instructionId = useId();

  // =========================
  // 3. STABLE RECORD KEY
  // =========================

  // FIX 2: Không dùng rowIndex làm React key.
  // Với Employee, ID là định danh ổn định.
  // Fallback dành cho dữ liệu không có ID.
  const recordKey = (item: T): string => {
    if (
      item !== null &&
      typeof item === "object" &&
      "ID" in item
    ) {
      const id = (item as { ID: unknown }).ID;

      if (
        typeof id === "number" ||
        typeof id === "string"
      ) {
        return `id:${String(id)}`;
      }
    }

    return `source:${data.indexOf(item)}`;
  };

  // =========================
  // 4. FILTERING
  // =========================

  const filteredData = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return data;
    }

    return data.filter((item) =>
      columns.some((column) => {
        const value = item[column.accessorKey];

        return String(value ?? "")
          .toLowerCase()
          .includes(keyword);
      })
    );
  }, [data, columns, search]);

  // =========================
  // 5. SORTING
  // =========================

  const sortedData = useMemo(() => {
    if (sortKey === null) {
      return filteredData;
    }

    // Tạo bản sao, không mutate props
    return [...filteredData].sort((a, b) => {
      const first = a[sortKey];
      const second = b[sortKey];

      let comparison = 0;

      if (
        typeof first === "number" &&
        typeof second === "number"
      ) {
        comparison = first - second;
      } else {
        comparison = String(first ?? "").localeCompare(
          String(second ?? ""),
          undefined,
          { sensitivity: "base" }
        );
      }

      return sortDirection === "ascending"
        ? comparison
        : -comparison;
    });
  }, [filteredData, sortKey, sortDirection]);

  // =========================
  // 6. PAGINATION
  // =========================

  const totalPages = Math.max(
    1,
    Math.ceil(sortedData.length / PAGE_SIZE)
  );

  const safePage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;

    return sortedData.slice(
      startIndex,
      startIndex + PAGE_SIZE
    );
  }, [sortedData, safePage]);

  // =========================
  // 7. FOCUS MANAGEMENT
  // =========================

  // FIX 3: Theo dõi hàng bằng record key,
  // thay vì chỉ dựa vào vị trí của hàng.
  const activeRecordIndex = paginatedData.findIndex(
    (item) => recordKey(item) === activeRecordKey
  );

  const safeRow =
    activeRecordIndex >= 0
      ? activeRecordIndex
      : Math.min(
          activeCell.row,
          Math.max(0, paginatedData.length - 1)
        );

  const safeColumn = Math.min(
    activeCell.column,
    Math.max(0, columns.length - 1)
  );

  // Khôi phục focus sau khi React render lại.
  useLayoutEffect(() => {
    if (
      paginatedData.length === 0 ||
      columns.length === 0
    ) {
      focusPending.current = false;
      return;
    }

    const grid = gridRef.current;

    if (!grid) return;

    const focused = document.activeElement;

    const mustRestore =
      focusPending.current ||
      (
        gridHadFocus.current &&
        !grid.contains(focused) &&
        focused === document.body
      );

    if (!mustRestore) return;

    focusPending.current = false;

    const key = `${safeRow}-${safeColumn}`;

    cellRefs.current.get(key)?.focus();
  }, [
    safeRow,
    safeColumn,
    paginatedData,
    columns,
  ]);

  const moveFocus = (row: number, column: number) => {
    if (
      paginatedData.length === 0 ||
      columns.length === 0
    ) {
      return;
    }

    // Không vượt giới hạn bảng
    const nextRow = Math.max(
      0,
      Math.min(row, paginatedData.length - 1)
    );

    const nextColumn = Math.max(
      0,
      Math.min(column, columns.length - 1)
    );

    if (
      nextRow === safeRow &&
      nextColumn === safeColumn
    ) {
      return;
    }

    focusPending.current = true;

    setActiveCell({
      row: nextRow,
      column: nextColumn,
    });

    setActiveRecordKey(
      recordKey(paginatedData[nextRow])
    );
  };

  // =========================
  // 8. ROW SELECTION
  // =========================

  // Enter: chọn hàng và gọi callback
  const selectRow = (item: T) => {
    const key = recordKey(item);

    setSelectedKeys((previous) => {
      const next = new Set(previous);
      next.add(key);
      return next;
    });

    onRowSelect?.(item);
  };

  // Space: bật/tắt trạng thái chọn
  const toggleRow = (item: T) => {
    const key = recordKey(item);

    setSelectedKeys((previous) => {
      const next = new Set(previous);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  };

  // =========================
  // 9. KEYBOARD NAVIGATION
  // =========================

  const handleCellKeyDown = (
    event: KeyboardEvent<HTMLTableCellElement>,
    row: number,
    column: number,
    item: T
  ) => {
    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        moveFocus(row - 1, column);
        break;

      case "ArrowDown":
        event.preventDefault();
        moveFocus(row + 1, column);
        break;

      case "ArrowLeft":
        event.preventDefault();
        moveFocus(row, column - 1);
        break;

      case "ArrowRight":
        event.preventDefault();
        moveFocus(row, column + 1);
        break;

      case "Enter":
        event.preventDefault();
        selectRow(item);
        break;

      case " ":
      case "Spacebar":
        event.preventDefault();
        toggleRow(item);
        break;

      default:
        break;
    }
  };

  // =========================
  // 10. EVENT HANDLERS
  // =========================

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDirection((previous) =>
        previous === "ascending"
          ? "descending"
          : "ascending"
      );
    } else {
      setSortKey(key);
      setSortDirection("ascending");
    }

    setCurrentPage(1);
    setActiveCell({ row: 0, column: 0 });
    setActiveRecordKey(null);
  };

  const handleSearch = (value: string) => {
    setSearch(value);

    setCurrentPage(1);
    setActiveCell({ row: 0, column: 0 });
    setActiveRecordKey(null);
  };

  const changePage = (page: number) => {
    setCurrentPage(page);

    setActiveCell({ row: 0, column: 0 });
    setActiveRecordKey(null);
  };

  // =========================
  // 11. RENDER
  // =========================

  return (
    <div className="data-grid-wrapper">

      {/* SEARCH */}

      <div className="data-grid-toolbar">
        <label htmlFor={searchId}>
          Search employees
        </label>

        <input
          id={searchId}
          type="search"
          value={search}
          onChange={(event) =>
            handleSearch(event.target.value)
          }
          placeholder="Search all columns..."
          aria-controls={statusId}
        />
      </div>

      {/* SCREEN READER INSTRUCTIONS */}

      <p
        id={instructionId}
        className="sr-only"
      >
        Use arrow keys to navigate data cells.
        Press Enter to select a row.
        Press Space to toggle row selection.
        Use Tab to leave the grid.
      </p>

      {/* DATA GRID */}

      <div className="data-grid-container">
        <table
          ref={gridRef}
          className="data-grid"
          role="grid"
          aria-label={ariaLabel}
          aria-describedby={instructionId}
          aria-multiselectable="true"
          onFocusCapture={() => {
            gridHadFocus.current = true;
          }}
          onBlurCapture={(event) => {
            if (
              !event.currentTarget.contains(
                event.relatedTarget as Node | null
              )
            ) {
              gridHadFocus.current = false;
            }
          }}
        >

          {/* TABLE HEADER */}

          <thead role="rowgroup">
            <tr role="row">
              {columns.map((column) => {
                const isSorted =
                  sortKey === column.accessorKey;

                return (
                  <th
                    key={String(column.accessorKey)}
                    role="columnheader"
                    scope="col"
                    aria-sort={
                      isSorted
                        ? sortDirection
                        : undefined
                    }
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        className="sort-button"
                        onClick={() =>
                          handleSort(column.accessorKey)
                        }
                        aria-label={
                          `Sort by ${column.header}` +
                          (isSorted
                            ? `, currently ${sortDirection}`
                            : "")
                        }
                      >
                        <span>{column.header}</span>

                        <span aria-hidden="true">
                          {isSorted
                            ? sortDirection === "ascending"
                              ? "↑"
                              : "↓"
                            : "↕"}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* TABLE BODY */}

          <tbody role="rowgroup">
            {paginatedData.length === 0 ? (

              <tr role="row">
                <td
                  role="gridcell"
                  colSpan={columns.length}
                  className="empty-message"
                >
                  No matching employees found.
                </td>
              </tr>

            ) : (

              paginatedData.map((item, rowIndex) => {
                const itemKey = recordKey(item);

                const isSelected =
                  selectedKeys.has(itemKey);

                return (
                  <tr
                    role="row"
                    key={itemKey}
                    aria-selected={isSelected}
                    className={
                      isSelected
                        ? "selected-row"
                        : ""
                    }
                  >
                    {columns.map(
                      (column, columnIndex) => {
                        const isActive =
                          rowIndex === safeRow &&
                          columnIndex === safeColumn;

                        const refKey =
                          `${rowIndex}-${columnIndex}`;

                        return (
                          <td
                            key={String(
                              column.accessorKey
                            )}
                            role="gridcell"
                            tabIndex={
                              isActive ? 0 : -1
                            }
                            ref={(element) => {
                              if (element) {
                                cellRefs.current.set(
                                  refKey,
                                  element
                                );
                              } else {
                                cellRefs.current.delete(
                                  refKey
                                );
                              }
                            }}
                            onFocus={() => {
                              setActiveCell({
                                row: rowIndex,
                                column: columnIndex,
                              });

                              setActiveRecordKey(
                                itemKey
                              );
                            }}
                            onClick={(event) => {
                              event.currentTarget.focus();
                            }}
                            onKeyDown={(event) =>
                              handleCellKeyDown(
                                event,
                                rowIndex,
                                columnIndex,
                                item
                              )
                            }
                          >
                            {String(
                              item[
                                column.accessorKey
                              ] ?? ""
                            )}
                          </td>
                        );
                      }
                    )}
                  </tr>
                );
              })

            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}

      <div className="data-grid-footer">

        <p
          id={statusId}
          role="status"
          aria-live="polite"
        >
          {sortedData.length} results
          {" · "}
          Page {safePage} of {totalPages}
        </p>

        <div
          className="pagination-controls"
          role="group"
          aria-label="Pagination controls"
        >
          <button
            type="button"
            disabled={safePage === 1}
            onClick={() =>
              changePage(safePage - 1)
            }
          >
            Previous
          </button>

          <button
            type="button"
            disabled={
              safePage === totalPages
            }
            onClick={() =>
              changePage(safePage + 1)
            }
          >
            Next
          </button>
        </div>

      </div>
    </div>
  );
}
