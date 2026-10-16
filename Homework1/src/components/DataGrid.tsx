
import { useMemo, useState } from "react";
import type { DataGridProps } from "../types/data-grid-contract";
import "./DataGrid.css";

const PAGE_SIZE = 10;

type SortDirection = "ascending" | "descending";

export default function DataGrid<T>({
  data,
  columns,
  ariaLabel,
}: DataGridProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("ascending");
  const [currentPage, setCurrentPage] = useState(1);

  // 1. Filtering
  const filteredData = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return data;

    return data.filter((item) =>
      columns.some((column) => {
        const value = item[column.accessorKey];

        return String(value ?? "")
          .toLowerCase()
          .includes(keyword);
      })
    );
  }, [data, columns, search]);

  // 2. Sorting
  const sortedData = useMemo(() => {
    if (sortKey === null) {
      return filteredData;
    }

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      let comparison = 0;

      if (
        typeof aValue === "number" &&
        typeof bValue === "number"
      ) {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue ?? "").localeCompare(
          String(bValue ?? ""),
          undefined,
          { sensitivity: "base" }
        );
      }

      return sortDirection === "ascending"
        ? comparison
        : -comparison;
    });
  }, [filteredData, sortKey, sortDirection]);

  // 3. Pagination
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

  // Xử lý click vào cột sortable
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
  };

  // Xử lý tìm kiếm
  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const searchId = "data-grid-search";
  const statusId = "data-grid-status";

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
          aria-controls={statusId}
        />
      </div>

      <div className="data-grid-container">
        <table
          className="data-grid"
          aria-label={ariaLabel}
          aria-describedby={statusId}
        >
          <thead>
            <tr>
              {columns.map((column) => {
                const isSorted =
                  sortKey === column.accessorKey;

                const ariaSort = isSorted
                  ? sortDirection
                  : "none";

                return (
                  <th
                    key={String(column.accessorKey)}
                    scope="col"
                    aria-sort={ariaSort}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        className="sort-button"
                        onClick={() =>
                          handleSort(column.accessorKey)
                        }
                        aria-label={`Sort by ${column.header}${
                          isSorted
                            ? sortDirection === "ascending"
                              ? ", currently ascending"
                              : ", currently descending"
                            : ""
                        }`}
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

          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="empty-message"
                >
                  No matching employees found.
                </td>
              </tr>
            ) : (
              paginatedData.map((item, rowIndex) => (
                <tr key={(safePage - 1) * PAGE_SIZE + rowIndex}>
                  {columns.map((column) => (
                    <td key={String(column.accessorKey)}>
                      {String(
                        item[column.accessorKey] ?? ""
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="data-grid-footer">
        <p id={statusId} role="status">
          {sortedData.length} results
          {" · "}
          Page {safePage} of {totalPages}
        </p>

        <div className="pagination-controls">
          <button
            type="button"
            disabled={safePage === 1}
            onClick={() =>
              setCurrentPage((page) =>
                Math.max(1, page - 1)
              )
            }
          >
            Previous
          </button>

          <button
            type="button"
            disabled={safePage === totalPages}
            onClick={() =>
              setCurrentPage((page) =>
                Math.min(totalPages, page + 1)
              )
            }
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
