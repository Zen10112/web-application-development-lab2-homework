
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

function initialInventories(): InventoryMap {
  return Object.fromEntries(
    products.map((product) => [
      product.id,
      { ...product.inventory },
    ])
  );
}

function asInventoryMap(
  values: InventorySnapshot[]
): InventoryMap {
  return Object.fromEntries(
    values.map((item) => [
      item.productId,
      { ...item },
    ])
  );
}

export function useInventoryReservation() {
  const serviceRef = useRef<InventoryService | null>(null);

  const reservationLocks = useRef(new Set<string>());
  const checkoutLocks = useRef(new Set<string>());

  const [confirmedInventory, setConfirmedInventory] =
    useState<InventoryMap>(initialInventories);

  const [optimisticQuantities, setOptimisticQuantities] =
    useState<Record<string, number>>({});

  const [pendingProductIds, setPendingProductIds] =
    useState<string[]>([]);

  const [reservations, setReservations] =
    useState<Reservation[]>([]);

  const [checkoutPendingIds, setCheckoutPendingIds] =
    useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const synchronize = useCallback(() => {
    const service = serviceRef.current;
    if (service === null) return;

    const snapshots = service.getAllInventories();
    setConfirmedInventory(asInventoryMap(snapshots));

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
      asInventoryMap(service.getAllInventories())
    );
    setIsReady(true);

    const handleVisibility = () => {
      if (!document.hidden) synchronize();
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

      // Pending checkout promises are safely failed on dispose.
      service.dispose();

      if (serviceRef.current === service) {
        serviceRef.current = null;
      }

      reservationLocks.current.clear();
      checkoutLocks.current.clear();
    };
  }, [synchronize]);

  // Refresh the UI at the nearest reservation expiry.
  useEffect(() => {
    const active = reservations.filter(
      (reservation) => reservation.status === "RESERVED"
    );

    if (active.length === 0) return;

    const nearestExpiry = Math.min(
      ...active.map((reservation) => reservation.expiresAt)
    );

    const delay = Math.max(
      0,
      nearestExpiry - Date.now()
    );

    const timeout = window.setTimeout(
      synchronize,
      delay
    );

    return () => window.clearTimeout(timeout);
  }, [reservations, synchronize]);

  const reserveProduct = useCallback(
    async (
      productId: string,
      saleDeadline: number
    ): Promise<void> => {
      const currentService = serviceRef.current;

      if (
        currentService === null ||
        !Number.isFinite(saleDeadline) ||
        Date.now() >= saleDeadline
      ) {
        return;
      }

      const service: InventoryService = currentService;

      // Synchronous guard prevents repeated rapid clicks.
      if (reservationLocks.current.has(productId)) {
        return;
      }

      if (service.getAvailableStock(productId) < 1) {
        synchronize();
        setError("Sản phẩm đã hết hàng.");
        return;
      }

      reservationLocks.current.add(productId);

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

        if (serviceRef.current !== service) return;

        // Compare against the original absolute deadline.
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

        const current =
          service.getReservation(
            result.reservation.reservationId
          ) ?? result.reservation;

        setReservations((previous) => [
          ...previous,
          current,
        ]);
      } catch (caught) {
        if (serviceRef.current === service) {
          synchronize();
          setError(
            caught instanceof Error
              ? caught.message
              : "Không thể giữ sản phẩm."
          );
        }
      } finally {
        reservationLocks.current.delete(productId);

        if (serviceRef.current === service) {
          // Remove the temporary stock overlay.
          // Confirmed inventory remains owned by the service.
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

  const checkoutReservation = useCallback(
    async (reservationId: string): Promise<void> => {
      const currentService = serviceRef.current;
      if (currentService === null) return;

      const service: InventoryService = currentService;

      if (checkoutLocks.current.has(reservationId)) {
        return;
      }

      const reservation = service.getReservation(
        reservationId
      );

      if (!reservation || reservation.status !== "RESERVED") {
        setError(
          "Reservation không tồn tại hoặc không thể checkout."
        );
        synchronize();
        return;
      }

      if (Date.now() >= reservation.expiresAt) {
        synchronize();
        setError("Reservation đã hết hạn.");
        return;
      }

      checkoutLocks.current.add(reservationId);
      setError(null);

      setCheckoutPendingIds((previous) =>
        previous.includes(reservationId)
          ? previous
          : [...previous, reservationId]
      );

      try {
        // InventoryService performs the actual lock
        // synchronously before awaiting the processor.
        const promise = service.checkout(
          reservationId,
          async () => {
            await new Promise<void>((resolve) => {
              window.setTimeout(
                resolve,
                MOCK_CHECKOUT_DELAY_MS
              );
            });

            return true;
          }
        );

        synchronize();

        const result = await promise;

        if (serviceRef.current !== service) return;

        synchronize();

        if (!result.success) {
          setError(result.error ?? "Checkout thất bại.");
        }
      } catch (caught) {
        if (serviceRef.current === service) {
          synchronize();

          setError(
            caught instanceof Error
              ? caught.message
              : "Không thể checkout."
          );
        }
      } finally {
        checkoutLocks.current.delete(reservationId);

        if (serviceRef.current === service) {
          setCheckoutPendingIds((previous) =>
            previous.filter((id) => id !== reservationId)
          );
        }
      }
    },
    [synchronize]
  );

  const displayedProducts: Product[] = products.map(
    (product) => {
      const confirmed =
        confirmedInventory[product.id] ??
        product.inventory;

      const optimistic =
        optimisticQuantities[product.id] ?? 0;

      return {
        ...product,
        inventory: {
          ...confirmed,
          availableStock: Math.max(
            0,
            confirmed.availableStock - optimistic
          ),
        },
      };
    }
  );

  return {
    displayedProducts,
    confirmedInventory,
    pendingProductIds,
    reservations,
    checkoutPendingIds,
    error,
    isReady,
    reserveProduct,
    checkoutReservation,
    synchronize,
  };
}
