
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
const MOCK_CHECKOUT_DELAY_MS = 600;

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
      { ...inventory },
    ])
  );
}

export function useInventoryReservation() {
  const serviceRef = useRef<InventoryService | null>(null);

  // Synchronous guards for rapid clicks.
  const inFlightRef = useRef<Set<string>>(new Set());
  const checkoutInFlightRef = useRef<Set<string>>(
    new Set()
  );

  const [confirmedInventory, setConfirmedInventory] =
    useState<InventoryMap>(initialInventoryMap);

  const [
    optimisticQuantities,
    setOptimisticQuantities,
  ] = useState<Record<string, number>>({});

  const [pendingProductIds, setPendingProductIds] =
    useState<string[]>([]);

  const [reservations, setReservations] =
    useState<Reservation[]>([]);

  const [checkoutPendingId, setCheckoutPendingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [isReady, setIsReady] = useState(false);

  // Read authoritative inventory and reservation states.
  const synchronize = useCallback(() => {
    const service = serviceRef.current;

    if (service === null) {
      return;
    }

    const snapshots = service.getAllInventories();

    setConfirmedInventory(
      toInventoryMap(snapshots)
    );

    setReservations((previous) =>
      previous.map(
        (reservation) =>
          service.getReservation(
            reservation.reservationId
          ) ?? reservation
      )
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

    window.addEventListener(
      "focus",
      handleFocus
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );

      window.removeEventListener(
        "focus",
        handleFocus
      );

      service.dispose();

      if (serviceRef.current === service) {
        serviceRef.current = null;
      }

      inFlightRef.current.clear();
      checkoutInFlightRef.current.clear();
    };
  }, [synchronize]);

  // Schedule UI refresh at the nearest expiry deadline.
  useEffect(() => {
    const activeReservations = reservations.filter(
      (reservation) =>
        reservation.status === "RESERVED"
    );

    if (activeReservations.length === 0) {
      return;
    }

    const nearestExpiration = Math.min(
      ...activeReservations.map(
        (reservation) => reservation.expiresAt
      )
    );

    const remainingMs = Math.max(
      0,
      nearestExpiration - Date.now()
    );

    const timeout = window.setTimeout(() => {
      synchronize();
    }, remainingMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [reservations, synchronize]);

  /**
   * Performs optimistic reservation.
   *
   * UI stock is decreased immediately. The service
   * still owns the actual inventory.
   */
  const reserveProduct = useCallback(
    async (
      productId: string,
      isSaleEnded: boolean,
      remainingSaleMs: number
    ): Promise<void> => {
      const currentService = serviceRef.current;

      if (
        currentService === null ||
        isSaleEnded ||
        remainingSaleMs <= 0
      ) {
        return;
      }

      const service: InventoryService = currentService;
      const saleDeadline = Date.now() + remainingSaleMs;

      if (inFlightRef.current.has(productId)) {
        return;
      }

      const stock =
        service.getAvailableStock(productId);

      if (stock < 1) {
        synchronize();
        setError("Sản phẩm đã hết hàng.");
        return;
      }

      inFlightRef.current.add(productId);

      setError(null);

      setPendingProductIds((previous) =>
        previous.includes(productId)
          ? previous
          : [...previous, productId]
      );

      setOptimisticQuantities((previous) => ({
        ...previous,
        [productId]: 1,
      }));

      try {
        await new Promise<void>((resolve) => {
          window.setTimeout(
            resolve,
            MOCK_NETWORK_DELAY_MS
          );
        });

        // Stop when the component's service was replaced.
        if (serviceRef.current !== service) {
          return;
        }

        // Reject if the sale ended while waiting.
        if (Date.now() >= saleDeadline) {
          setError(
            "Flash Sale đã kết thúc. Không thể giữ hàng."
          );

          synchronize();
          return;
        }

        const result = service.reserve({
          productId,
          quantity: 1,
        });

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
        inFlightRef.current.delete(productId);

        if (serviceRef.current === service) {
          // Rollback optimistic overlay on both
          // success and failure.
          setOptimisticQuantities((previous) => {
            const next = { ...previous };
            delete next[productId];
            return next;
          });

          setPendingProductIds((previous) =>
            previous.filter(
              (id) => id !== productId
            )
          );
        }
      }
    },
    [synchronize]
  );

  /**
   * Starts checkout for one reservation.
   *
   * The actual lock and stock transfer happen inside
   * InventoryService, not React state.
   */
  const checkoutReservation = useCallback(
    async (reservationId: string): Promise<void> => {
      const currentService = serviceRef.current;

      if (currentService === null) {
        return;
      }

      const service: InventoryService = currentService;

      if (
        checkoutInFlightRef.current.has(reservationId)
      ) {
        return;
      }

      const reservation =
        service.getReservation(reservationId);

      if (!reservation) {
        setError("Reservation không tồn tại.");
        synchronize();
        return;
      }

      if (reservation.status !== "RESERVED") {
        setError(
          `Không thể checkout reservation ${reservation.status}.`
        );

        synchronize();
        return;
      }

      if (Date.now() >= reservation.expiresAt) {
        setError("Reservation đã hết hạn.");
        synchronize();
        return;
      }

      checkoutInFlightRef.current.add(reservationId);

      setCheckoutPendingId(reservationId);
      setError(null);

      setReservations((previous) =>
        previous.map((item) =>
          item.reservationId === reservationId
            ? { ...item, status: "CHECKOUT" }
            : item
        )
      );

      try {
        const result = await service.checkout(
          reservationId,
          async () => {
            // Simulated payment only.
            await new Promise<void>((resolve) => {
              window.setTimeout(
                resolve,
                MOCK_CHECKOUT_DELAY_MS
              );
            });

            // Change to false to test failed checkout.
            return true;
          }
        );

        if (serviceRef.current !== service) {
          return;
        }

        synchronize();

        if (!result.success) {
          setError(
            result.error ?? "Checkout thất bại."
          );
        }
      } catch (caught) {
        if (serviceRef.current === service) {
          synchronize();

          setError(
            caught instanceof Error
              ? caught.message
              : "Không thể xử lý checkout."
          );
        }
      } finally {
        checkoutInFlightRef.current.delete(
          reservationId
        );

        if (serviceRef.current === service) {
          setCheckoutPendingId((previous) =>
            previous === reservationId
              ? null
              : previous
          );
        }
      }
    },
    [synchronize]
  );

  // UI projection only; products.ts is never mutated.
  const displayedProducts: Product[] = products.map(
    (product) => {
      const confirmed =
        confirmedInventory[product.id] ??
        product.inventory;

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
    checkoutReservation,
    checkoutPendingId,
    synchronize,
  };
}
