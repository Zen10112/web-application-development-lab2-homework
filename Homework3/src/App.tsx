import FlashSaleHeader from "./components/FlashSaleHeader";
import ProductGrid from "./components/ProductGrid";
import OrderStatus from "./components/OrderStatus";
import { products } from "./data/products";
import "./App.css";

export default function App() {
  return (
    <div className="app">
      <FlashSaleHeader />
      <main className="main-content">
        <ProductGrid products={products} />
        <OrderStatus status="idle" />
      </main>
      <footer className="site-footer">
        <p>FLASHVN – High-Concurrency Flash-Sale Engine</p>
        <small>Homework 3 · Educational Simulation</small>
      </footer>
    </div>
  );
}
