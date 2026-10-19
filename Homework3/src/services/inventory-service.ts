
import type { Product } from "../types/flash-sale";

import type {
  CheckoutResult,
  InventorySnapshot,
  Reservation,
  ReservationRequest,
  ReservationResult,
} from "../types/inventory";

import {
  transitionState,
} from "./inventory-state-machine";

const DEFAULT_RESERVATION_TTL_MS = 30_000;
const MAX_TIMEOUT_MS = 2_147_483_647;

export class InventoryService {
  private readonly reservationTtlMs: number;

  private inventories = new Map<
    string,
    InventorySnapshot
  >();

  private reservations = new Map<
    string,
    Reservation
  >();

  private expirationTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  // One in-flight checkout per reservation ID.
  private checkoutPromises = new Map<
    string,
    Promise<CheckoutResult>
  >();

  private disposed = false;

  constructor(
    products: Product[],
    reservationTtlMs: number =
      DEFAULT_RESERVATION_TTL_MS
  ) {
    if (
      !Number.isSafeInteger(reservationTtlMs) ||
      reservationTtlMs <= 0 ||
      reservationTtlMs > MAX_TIMEOUT_MS
    ) {
      throw new RangeError(
        "Reservation TTL must be a positive integer within the timer limit"
      );
    }

    this.reservationTtlMs = reservationTtlMs;

    for (const product of products) {
      const inventory = product.inventory;

      if (this.inventories.has(product.id)) {
        throw new Error(
          `Duplicate product ID: ${product.id}`
        );
      }

      const values = [
        inventory.totalStock,
        inventory.availableStock,
        inventory.reservedStock,
        inventory.soldStock,
      ];

      if (
        inventory.productId !== product.id ||
        !values.every(
          (value) =>
            Number.isSafeInteger(value) && value >= 0
        ) ||
        inventory.availableStock +
          inventory.reservedStock +
          inventory.soldStock !==
          inventory.totalStock
      ) {
        throw new Error(
          `Invalid inventory for product ${product.id}`
        );
      }

      // Never mutate the original product data.
      this.inventories.set(product.id, {
        productId: product.id,
        totalStock: inventory.totalStock,
        availableStock: inventory.availableStock,
        reservedStock: inventory.reservedStock,
        soldStock: inventory.soldStock,
      });
    }
  }

  private assertActive(): void {
    if (this.disposed) {
      throw new Error(
        "InventoryService has been disposed"
      );
    }
  }

  public getInventory(
    productId: string
  ): InventorySnapshot | null {
    this.assertActive();
    this.expireReservations();

    const inventory = this.inventories.get(productId);

    return inventory ? { ...inventory } : null;
  }

  public getAvailableStock(
    productId: string
  ): number {
    return (
      this.getInventory(productId)?.availableStock ?? 0
    );
  }

  public getReservation(
    reservationId: string
  ): Reservation | null {
    this.assertActive();
    this.expireReservations();

    const reservation =
      this.reservations.get(reservationId);

    return reservation ? { ...reservation } : null;
  }

  public getAllInventories(): InventorySnapshot[] {
    this.assertActive();
    this.expireReservations();

    return Array.from(
      this.inventories.values(),
      (inventory) => ({ ...inventory })
    );
  }

  /**
   * Atomically reserves stock within this service instance.
   * There is no await between checking and updating stock.
   */
  public reserve(
    request: ReservationRequest
  ): ReservationResult {
    this.assertActive();
    this.expireReservations();

    const { productId, quantity } = request;

    if (
      !Number.isSafeInteger(quantity) ||
      quantity <= 0
    ) {
      return {
        success: false,
        error: "Quantity must be a positive integer",
      };
    }

    const inventory = this.inventories.get(productId);

    if (!inventory) {
      return {
        success: false,
        error: "Product not found",
      };
    }

    if (inventory.availableStock < quantity) {
      return {
        success: false,
        error: "Insufficient stock",
      };
    }

    const createdAt = Date.now();
    const expiresAt =
      createdAt + this.reservationTtlMs;

    const reservationId = crypto.randomUUID();

    let status = transitionState(
      "AVAILABLE",
      "RESERVING"
    );

    // Synchronous stock mutation prevents local overselling.
    inventory.availableStock -= quantity;
    inventory.reservedStock += quantity;

    status = transitionState(
      status,
      "RESERVED"
    );

    const reservation: Reservation = {
      reservationId,
      productId,
      quantity,
      createdAt,
      expiresAt,
      status,
    };

    this.reservations.set(
      reservationId,
      reservation
    );

    const timeout = setTimeout(() => {
      this.expirationTimers.delete(reservationId);

      if (!this.disposed) {
        this.expireReservations();
      }
    }, this.reservationTtlMs);

    this.expirationTimers.set(
      reservationId,
      timeout
    );

    return {
      success: true,
      reservation: { ...reservation },
    };
  }

  /**
   * Releases stock for overdue RESERVED reservations.
   * CHECKOUT and COMPLETED reservations are never expired.
   */
  public expireReservations(): number {
    this.assertActive();

    const now = Date.now();
    let expiredCount = 0;

    for (const reservation of this.reservations.values()) {
      if (
        reservation.status !== "RESERVED" ||
        now < reservation.expiresAt
      ) {
        continue;
      }

      const inventory = this.inventories.get(
        reservation.productId
      );

      if (!inventory) {
        throw new Error(
          "Inventory missing for an existing reservation"
        );
      }

      if (inventory.reservedStock < reservation.quantity) {
        throw new Error(
          "Inventory invariant violation: insufficient reserved stock"
        );
      }

      reservation.status = transitionState(
        reservation.status,
        "EXPIRED"
      );

      inventory.reservedStock -= reservation.quantity;
      inventory.availableStock += reservation.quantity;

      const timeout = this.expirationTimers.get(
        reservation.reservationId
      );

      if (timeout !== undefined) {
        clearTimeout(timeout);

        this.expirationTimers.delete(
          reservation.reservationId
        );
      }

      expiredCount++;
    }

    return expiredCount;
  }

  /**
   * Finalizes a checkout exactly once.
   *
   * Success: CHECKOUT -> COMPLETED
   * Failure: CHECKOUT -> FAILED
   */
  private finishCheckout(
    reservationId: string,
    paymentSucceeded: boolean
  ): CheckoutResult {
    const reservation =
      this.reservations.get(reservationId);

    if (!reservation) {
      return {
        success: false,
        error: "Reservation not found",
      };
    }

    if (reservation.status === "COMPLETED") {
      return {
        success: true,
        reservation: { ...reservation },
      };
    }

    if (reservation.status !== "CHECKOUT") {
      return {
        success: false,
        reservation: { ...reservation },
        error:
          `Cannot finish checkout from ${reservation.status}`,
      };
    }

    const inventory = this.inventories.get(
      reservation.productId
    );

    if (!inventory) {
      throw new Error(
        "Inventory missing for an existing reservation"
      );
    }

    if (
      inventory.reservedStock < reservation.quantity
    ) {
      throw new Error(
        "Inventory invariant violation: insufficient reserved stock"
      );
    }

    if (paymentSucceeded) {
      reservation.status = transitionState(
        reservation.status,
        "COMPLETED"
      );

      // Transfer held stock into sold stock only once.
      inventory.reservedStock -= reservation.quantity;
      inventory.soldStock += reservation.quantity;

      return {
        success: true,
        reservation: { ...reservation },
      };
    }

    reservation.status = transitionState(
      reservation.status,
      "FAILED"
    );

    // Explicit failure policy: release held stock.
    inventory.reservedStock -= reservation.quantity;
    inventory.availableStock += reservation.quantity;

    return {
      success: false,
      reservation: { ...reservation },
      error:
        "Checkout failed. Reserved stock was released.",
    };
  }

  /**
   * Locks a valid RESERVED reservation synchronously,
   * then invokes a simulated asynchronous payment processor.
   *
   * Concurrent calls for the same reservation share
   * the same in-flight Promise.
   */
  public checkout(
    reservationId: string,
    processor: () => Promise<boolean>
  ): Promise<CheckoutResult> {
    this.assertActive();

    // Reclaim overdue reservations before attempting checkout.
    this.expireReservations();

    const existingPromise =
      this.checkoutPromises.get(reservationId);

    if (existingPromise) {
      return existingPromise;
    }

    const reservation =
      this.reservations.get(reservationId);

    if (!reservation) {
      return Promise.resolve({
        success: false,
        error: "Reservation not found",
      });
    }

    // Idempotent success: never count sold stock twice.
    if (reservation.status === "COMPLETED") {
      return Promise.resolve({
        success: true,
        reservation: { ...reservation },
      });
    }

    if (reservation.status !== "RESERVED") {
      return Promise.resolve({
        success: false,
        reservation: { ...reservation },
        error:
          `Cannot checkout a ${reservation.status} reservation`,
      });
    }

    if (Date.now() >= reservation.expiresAt) {
      this.expireReservations();

      return Promise.resolve({
        success: false,
        reservation: { ...reservation },
        error: "Reservation has expired",
      });
    }

    // Local atomic lock: no await before state transition.
    reservation.status = transitionState(
      reservation.status,
      "CHECKOUT"
    );

    // Once checkout starts, reservation TTL no longer
    // releases the stock.
    const expirationTimer =
      this.expirationTimers.get(reservationId);

    if (expirationTimer !== undefined) {
      clearTimeout(expirationTimer);
      this.expirationTimers.delete(reservationId);
    }

    const checkoutPromise = Promise.resolve()
      .then(() => processor())
      .then(
        (result) =>
          this.finishCheckout(
            reservationId,
            result === true
          ),
        () =>
          this.finishCheckout(
            reservationId,
            false
          )
      )
      .finally(() => {
        this.checkoutPromises.delete(reservationId);
      });

    this.checkoutPromises.set(
      reservationId,
      checkoutPromise
    );

    return checkoutPromise;
  }

  /**
   * Cleans up reservation expiry timers.
   * This does not cancel an external checkout processor.
   */
  public dispose(): void {
    if (this.disposed) return;

    for (const timeout of this.expirationTimers.values()) {
      clearTimeout(timeout);
    }

    this.expirationTimers.clear();
    this.disposed = true;
  }
}
