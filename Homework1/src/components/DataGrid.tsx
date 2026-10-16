
import {
  useEffect,
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
  // Sorting, filtering, pagination
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("ascending");
  const [currentPage, setCurrentPage] = useState(1);

  // Keyboard navigation
  const [activeCell, setActiveCell] = useState<ActiveCell>({
    row: 0,
    column: 0,
  });

  // Selection: lưu tham chiếu bản ghi, không dùng row index
  const [selectedRows, setSelectedRows] = useState<Set<T>>(
    () => new Set<T>()
  );

  // References tới các ô dữ liệu
  const cellRefs = useRef<
    Map<string, HTMLTableCellElement>
  >(new Map());

  const focusPending = useRef(false);

  // ID duy nhất, tránh trùng khi có nhiều DataGrid
  const searchId = useId();
  const statusId = useId();
  const instructionId = useId();

  // FILTERING
  const filteredData = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return data;

    return data.filter((item) =>
      columns.some((column) =>
        String(item[column.accessorKey] ?? "")
          .toLowerCase()
          .includes(keyword)
      )
    );
  }, [data, columns, search]);

  // SORTING
  const sortedData = useMemo(() => {
    if (sortKey === null) return filteredData;

    return [...filteredData].sort((a, b) => {
      const first = a[sortKey];
      const second = b[sortKey];

      let comparison: number;

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

  // PAGINATION
  const totalPages = Math.max(
    1,
    Math.ceil(sortedData.length / PAGE_SIZE)
  );

  const safePage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;

    return sortedData.slice(start, start + PAGE_SIZE);
  }, [sortedData, safePage]);

  // Giữ vị trí focus nằm trong số hàng/cột hiện có
  const safeRow = Math.min(
    activeCell.row,
    Math.max(0, paginatedData.length - 1)
  );

  const safeColumn = Math.min(
    activeCell.column,
    Math.max(0, columns.length - 1)
  );

  // Focus vào ô sau khi state thay đổi do phím mũi tên
  useEffect(() => {
    if (!focusPending.current) return;

    focusPending.current = false;

    const key = `${safeRow}-${safeColumn}`;
    cellRefs.current.get(key)?.focus();
  }, [safeRow, safeColumn]);

  const moveFocus = (row: number, column: number) => {
    const nextRow = Math.max(
      0,
      Math.min(row, paginatedData.length - 1)
    );

    const nextColumn = Math.max(
      0,
      Math.min(column, columns.length - 1)
    );

    const key = `${nextRow}-${nextColumn}`;

    // Không thay đổi focus nếu đã ở ranh giới
    if (nextRow === safeRow && nextColumn === safeColumn) {
      return;
    }

    focusPending.current = true;
    setActiveCell({
      row: nextRow,
      column: nextColumn,
    });

    // Ref sẽ được focus trong useEffect
    void key;
  };

  const selectRow = (item: T) => {
    setSelectedRows((previous) => {
      const next = new Set(previous);
      next.add(item);
      return next;
    });

    onRowSelect?.(item);
  };

  const toggleRow = (item: T) => {
    setSelectedRows((previous) => {
      const next = new Set(previous);

      if (next.has(item)) {
        next.delete(item);
      } else {
        next.add(item);
      }

      return next;
    });
  };

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
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
    setActiveCell({ row: 0, column: 0 });
  };

  const changePage = (page: number) => {
    setCurrentPage(page);
    setActiveCell({ row: 0, column: 0 });
  };

  return (
    <div className="data-grid-wrapper">
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
        />
      </div>

      <p id={instructionId} className="sr-only">
        Use arrow keys to navigate data cells.
        Press Enter to select a row.
        Press Space to toggle row selection.
        Use Tab to leave the grid.
      </p>

      <div className="data-grid-container">
        <table
          className="data-grid"
          role="grid"
          aria-label={ariaLabel}
          aria-describedby={instructionId}
          aria-multiselectable="true"
        >
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
                const isSelected = selectedRows.has(item);

                return (
                  <tr
                    role="row"
                    key={(safePage - 1) * PAGE_SIZE + rowIndex}
                    aria-selected={isSelected}
                    className={
                      isSelected ? "selected-row" : ""
                    }
                  >
                    {columns.map((column, columnIndex) => {
                      const isActive =
                        rowIndex === safeRow &&
                        columnIndex === safeColumn;

                      const refKey =
                        `${rowIndex}-${columnIndex}`;

                      return (
                        <td
                          key={String(column.accessorKey)}
                          role="gridcell"
                          tabIndex={isActive ? 0 : -1}
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
                          onFocus={() =>
                            setActiveCell({
                              row: rowIndex,
                              column: columnIndex,
                            })
                          }
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
                            item[column.accessorKey] ?? ""
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="data-grid-footer">
        <p id={statusId} role="status" aria-live="polite">
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
            onClick={() => changePage(safePage - 1)}
          >
            Previous
          </button>

          <button
            type="button"
            disabled={safePage === totalPages}
            onClick={() => changePage(safePage + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
