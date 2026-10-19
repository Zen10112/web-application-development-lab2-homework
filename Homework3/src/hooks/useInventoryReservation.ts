
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { products } from "../data/products";
import { InventoryService } from "../services/inventory-service";

import type { Product } from "../types/flash-sale";
import type {
  InventorySnapshot,
  Reservation,
} from "../types/inventory";

const RESERVATION_TTL_MS = 30_000;
const MOCK_NETWORK_DELAY_MS = 350;

type InventoryMap = Record<string, InventorySnapshot>;

function initialInventoryMap(): InventoryMap {
  return Object.fromEntries(
    products.map((product) => [
      product.id,
      { ...product.inventory },
    ])
  );
}

function toInventoryMap(
  inventories: InventorySnapshot[]
): InventoryMap {
  return Object.fromEntries(
    inventories.map((inventory) => [
      inventory.productId,
      inventory,
    ])
  );
}

export function useInventoryReservation() {
  const serviceRef = useRef<InventoryService | null>(null);

  // Synchronous guard against repeated rapid clicks.
  const inFlightRef = useRef<Set<string>>(new Set());

  const [confirmedInventory, setConfirmedInventory] =
    useState<InventoryMap>(initialInventoryMap);

  const [optimisticQuantities, setOptimisticQuantities] =
    useState<Record<string, number>>({});

  const [pendingProductIds, setPendingProductIds] =
    useState<string[]>([]);

  const [reservations, setReservations] =
    useState<Reservation[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Reads authoritative values from InventoryService.
  const synchronize = useCallback(() => {
    const service = serviceRef.current;
    if (!service) return;

    const snapshots = service.getAllInventories();
    setConfirmedInventory(toInventoryMap(snapshots));

    setReservations((previous) =>
      previous.map((reservation) => {
        return (
          service.getReservation(reservation.reservationId) ??
          reservation
        );
      })
    );
  }, []);

  useEffect(() => {
    const service = new InventoryService(
      products,
      RESERVATION_TTL_MS
    );

    serviceRef.current = service;
    setConfirmedInventory(
      toInventoryMap(service.getAllInventories())
    );
    setIsReady(true);

    const handleVisibility = () => {
      if (!document.hidden) {
        synchronize();
      }
    };

    const handleFocus = () => {
      synchronize();
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );

      window.removeEventListener("focus", handleFocus);

      service.dispose();

      if (serviceRef.current === service) {
        serviceRef.current = null;
      }

      inFlightRef.current.clear();
    };
  }, [synchronize]);

  // Keep the UI synchronized at the next expiry deadline.
  useEffect(() => {
    const active = reservations.filter(
      (reservation) => reservation.status === "RESERVED"
    );

    if (active.length === 0) return;

    const nearestExpiration = Math.min(
      ...active.map((reservation) => reservation.expiresAt)
    );

    const remaining = Math.max(
      0,
      nearestExpiration - Date.now()
    );

    const timeout = window.setTimeout(() => {
      synchronize();
    }, remaining);

    return () => window.clearTimeout(timeout);
  }, [reservations, synchronize]);

  const reserveProduct = useCallback(
  async (
    productId: string,
    isSaleEnded: boolean,
    remainingSaleMs: number
  ) => {
    const currentService = serviceRef.current;

    if (currentService === null || isSaleEnded) {
      return;
    }

    const service: InventoryService = currentService;
    const saleDeadline = Date.now() + remainingSaleMs;

    // Keep all existing reservation logic below.
      // Prevent duplicate requests before React re-renders.
      if (inFlightRef.current.has(productId)) {
        return;
      }

      // Check actual stock, not optimistic UI values.
      const stock = service.getAvailableStock(productId);

      if (stock < 1) {
        synchronize();
        setError("Sản phẩm đã hết hàng.");
        return;
      }

      inFlightRef.current.add(productId);

      setError(null);
      setPendingProductIds((previous) => [
        ...previous,
        productId,
      ]);

      // UI-only reservation. No service stock mutation yet.
      setOptimisticQuantities((previous) => ({
        ...previous,
        [productId]: 1,
      }));

      try {
        // Simulate an asynchronous network response.
        await new Promise<void>((resolve) => {
  window.setTimeout(resolve, MOCK_NETWORK_DELAY_MS);
});

// Stop if the service has been disposed or replaced.
if (serviceRef.current !== service) {
  return;
}

// Reject reservation if Flash Sale has ended.
if (Date.now() >= saleDeadline) {
  setError("Flash Sale đã kết thúc. Không thể giữ hàng.");
  synchronize();
  return;
}

        const result = service.reserve({
          productId,
          quantity: 1,
        });

        // Always re-read confirmed inventory after response.
        synchronize();

        if (!result.success || !result.reservation) {
          setError(
            result.error ?? "Không thể giữ sản phẩm."
          );
          return;
        }

        const confirmedReservation =
          service.getReservation(
            result.reservation.reservationId
          ) ?? result.reservation;

        setReservations((previous) => [
          ...previous,
          confirmedReservation,
        ]);
      } catch (caught) {
        if (serviceRef.current === service) {
          synchronize();

          setError(
            caught instanceof Error
              ? caught.message
              : "Đã xảy ra lỗi khi giữ hàng."
          );
        }
      } finally {
        // Remove the optimistic overlay regardless of outcome.
        inFlightRef.current.delete(productId);

        if (serviceRef.current === service) {
          setOptimisticQuantities((previous) => {
            const next = { ...previous };
            delete next[productId];
            return next;
          });

          setPendingProductIds((previous) =>
            previous.filter((id) => id !== productId)
          );
        }
      }
    },
    [synchronize]
  );

  // UI projection: confirmed inventory minus pending overlays.
  // This does not mutate InventoryService or products.ts.
  const displayedProducts: Product[] = products.map(
    (product) => {
      const confirmed =
        confirmedInventory[product.id] ?? product.inventory;

      const optimistic =
        optimisticQuantities[product.id] ?? 0;

      const displayedAvailable = Math.max(
        0,
        confirmed.availableStock - optimistic
      );

      return {
        ...product,
        inventory: {
          ...confirmed,
          availableStock: displayedAvailable,
        },
      };
    }
  );

  const latestReservation =
    reservations.length > 0
      ? reservations[reservations.length - 1]
      : null;

  return {
    displayedProducts,
    confirmedInventory,
    pendingProductIds,
    latestReservation,
    error,
    isReady,
    reserveProduct,
    synchronize,
  };
}
