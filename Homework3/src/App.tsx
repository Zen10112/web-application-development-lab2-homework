
import { useState } from "react";

import FlashSaleHeader from "./components/FlashSaleHeader";
import ProductGrid from "./components/ProductGrid";
import OrderStatus from "./components/OrderStatus";

import { products } from "./data/products";
import type { Product } from "./types/flash-sale";
import { useCountdown } from "./hooks/useCountdown";

import "./App.css";

// Demo duration: 10 minutes.
const FLASH_SALE_DURATION_MS = 10 * 60 * 1000;

function App() {
  const { remainingMs, isEnded } = useCountdown(
    FLASH_SALE_DURATION_MS
  );

  const [demoMessage, setDemoMessage] = useState("");

  const handleBuyNow = (product: Product) => {
    if (isEnded) {
      return;
    }

    // Stage 3: No reservation or checkout.
    setDemoMessage(
      `Bạn đã chọn ${product.name}. ` +
      "Chức năng giữ hàng và thanh toán " +
      "sẽ được triển khai ở giai đoạn sau."
    );
  };

  return (
    <div className="app">
      <FlashSaleHeader
        remainingMs={remainingMs}
        isEnded={isEnded}
      />

      <main className="main-content">
        <ProductGrid
          products={products}
          isSaleEnded={isEnded}
          onBuyNow={handleBuyNow}
        />

        {demoMessage && (
          <p className="demo-purchase-notice" role="status">
            {demoMessage}
          </p>
        )}

        <OrderStatus status="idle" />
      </main>

      <footer className="site-footer">
        <p>
          FLASHVN – High-Concurrency Flash-Sale Engine
        </p>

        <small>
          Homework 3 · Educational Simulation
        </small>
      </footer>
    </div>
  );
}

export default App;
