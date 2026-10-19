
import FlashSaleHeader from "./components/FlashSaleHeader";
import ProductGrid from "./components/ProductGrid";
import OrderStatus from "./components/OrderStatus";

import { useCountdown } from "./hooks/useCountdown";
import { useInventoryReservation } from "./hooks/useInventoryReservation";

import type { Product } from "./types/flash-sale";

import "./App.css";

const FLASH_SALE_DURATION_MS = 10 * 60 * 1000;

function App() {
  // Existing countdown remains unchanged.
  const { remainingMs, isEnded } = useCountdown(
    FLASH_SALE_DURATION_MS
  );

  const {
    displayedProducts,
    pendingProductIds,
    latestReservation,
    error,
    isReady,
    reserveProduct,
  } = useInventoryReservation();

  const handleBuyNow = (product: Product) => {
    if (isEnded || !isReady) {
      return;
    }

    void reserveProduct(product.id, isEnded, remainingMs);
  };

  return (
    <div className="app">
      <FlashSaleHeader
        remainingMs={remainingMs}
        isEnded={isEnded}
      />

      <main className="main-content">
        <ProductGrid
          products={displayedProducts}
          isSaleEnded={isEnded || !isReady}
          pendingProductIds={pendingProductIds}
          onBuyNow={handleBuyNow}
        />

        <OrderStatus
          reservation={latestReservation}
          error={error}
          isReserving={pendingProductIds.length > 0}
        />
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
