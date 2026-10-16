import DataGrid from "./components/DataGrid";
import { employees } from "./data/employees";
import type { Employee } from "./data/employees";
import type { ColumnDef } from "./types/data-grid-contract";
import "./App.css";

const columns: ColumnDef<Employee>[] = [
  { header: "ID", accessorKey: "ID", sortable: true },
  { header: "Name", accessorKey: "Name", sortable: true },
  { header: "Department", accessorKey: "Department", sortable: true },
  { header: "Position", accessorKey: "Position", sortable: false },
  { header: "Salary (VND)", accessorKey: "Salary", sortable: true },
];

function App() {
  return (
    <main className="app-container">
      <header className="app-header">
        <h1>Enterprise Employee Data-Grid</h1>
        <p>Employee Management System</p>
      </header>

      <section aria-labelledby="employee-heading">
        <div className="section-header">
          <h2 id="employee-heading">Employee Directory</h2>
          <span>Total Employees: {employees.length}</span>
        </div>

        <DataGrid<Employee>
          data={employees}
          columns={columns}
          ariaLabel="Employee Directory Data Grid"
          onRowSelect={(employee) => {
            console.log("Selected employee:", employee);
  }}
        />
      </section>
    </main>
  );
}

export default App;
