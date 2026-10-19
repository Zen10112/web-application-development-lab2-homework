import QueueDemo from "./components/QueueDemo";
import "./App.css";
export default function App() {
  return <main className="app-container">
    <header className="app-header">
      <h1>Concurrent FIFO Audio Queue Engine</h1>
      <p>Homework 2 – React + TypeScript + Web Audio API</p>
    </header>
    <QueueDemo />
  </main>;
}
