import type { DataGridProps } from "../types/data-grid-contract";
import "./DataGrid.css";

export default function DataGrid<T>({
  data,
  columns,
  ariaLabel,
}: DataGridProps<T>) {
  return (
    <div className="data-grid-container">
      <table className="data-grid" aria-label={ariaLabel}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={String(column.accessorKey)} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
                <td key={String(column.accessorKey)}>
                  {String(item[column.accessorKey] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
