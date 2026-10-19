
import type { Product } from "../types/flash-sale";

import type {
  CheckoutResult,
  InventorySnapshot,
  Reservation,
  ReservationRequest,
  ReservationResult,
} from "../types/inventory";

import { transitionState } from "./inventory-state-machine";

const DEFAULT_RESERVATION_TTL_MS = 30_000;
const DEFAULT_CHECKOUT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 2_147_483_647;

interface CheckoutJob {
  promise: Promise<CheckoutResult>;
  settle: (success: boolean, reason?: string) => void;
}

function validateTimeout(value: number, name: string): void {
  if (
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > MAX_TIMEOUT_MS
  ) {
    throw new RangeError(
      `${name} must be a positive integer within timer limits`
    );
  }
}

export class InventoryService {
  private readonly reservationTtlMs: number;
  private readonly checkoutTimeoutMs: number;

  private inventories = new Map<string, InventorySnapshot>();
  private reservations = new Map<string, Reservation>();

  private expirationTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  private checkoutJobs = new Map<string, CheckoutJob>();
  private disposed = false;

  constructor(
    products: Product[],
    reservationTtlMs: number = DEFAULT_RESERVATION_TTL_MS,
    checkoutTimeoutMs: number = DEFAULT_CHECKOUT_TIMEOUT_MS
  ) {
    validateTimeout(reservationTtlMs, "Reservation TTL");
    validateTimeout(checkoutTimeoutMs, "Checkout timeout");

    this.reservationTtlMs = reservationTtlMs;
    this.checkoutTimeoutMs = checkoutTimeoutMs;

    for (const product of products) {
      const source = product.inventory;

      if (this.inventories.has(product.id)) {
        throw new Error(`Duplicate product ID: ${product.id}`);
      }

      const values = [
        source.totalStock,
        source.availableStock,
        source.reservedStock,
        source.soldStock,
      ];

      if (
        source.productId !== product.id ||
        !values.every(
          (value) => Number.isSafeInteger(value) && value >= 0
        ) ||
        source.availableStock +
          source.reservedStock +
          source.soldStock !== source.totalStock
      ) {
        throw new Error(
          `Invalid inventory for product ${product.id}`
        );
      }

      this.inventories.set(product.id, { ...source });
    }
  }

  private assertActive(): void {
    if (this.disposed) {
      throw new Error("InventoryService has been disposed");
    }
  }

  public getInventory(productId: string): InventorySnapshot | null {
    this.assertActive();
    this.expireReservations();

    const inventory = this.inventories.get(productId);
    return inventory ? { ...inventory } : null;
  }

  public getAvailableStock(productId: string): number {
    return this.getInventory(productId)?.availableStock ?? 0;
  }

  public getReservation(reservationId: string): Reservation | null {
    this.assertActive();
    this.expireReservations();

    const reservation = this.reservations.get(reservationId);
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

  public reserve(request: ReservationRequest): ReservationResult {
    this.assertActive();
    this.expireReservations();

    const { productId, quantity } = request;

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return {
        success: false,
        error: "Quantity must be a positive integer",
      };
    }

    const inventory = this.inventories.get(productId);

    if (!inventory) {
      return { success: false, error: "Product not found" };
    }

    if (inventory.availableStock < quantity) {
      return { success: false, error: "Insufficient stock" };
    }

    const createdAt = Date.now();
    const reservationId = crypto.randomUUID();

    let status = transitionState("AVAILABLE", "RESERVING");

    // Atomic within this JavaScript service instance.
    // No await between checking and updating stock.
    inventory.availableStock -= quantity;
    inventory.reservedStock += quantity;

    status = transitionState(status, "RESERVED");

    const reservation: Reservation = {
      reservationId,
      productId,
      quantity,
      createdAt,
      expiresAt: createdAt + this.reservationTtlMs,
      status,
    };

    this.reservations.set(reservationId, reservation);

    const timer = setTimeout(() => {
      this.expirationTimers.delete(reservationId);

      if (!this.disposed) {
        this.expireReservations();
      }
    }, this.reservationTtlMs);

    this.expirationTimers.set(reservationId, timer);

    return {
      success: true,
      reservation: { ...reservation },
    };
  }

  public expireReservations(): number {
    this.assertActive();

    const now = Date.now();
    let count = 0;

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
        throw new Error("Inventory missing for reservation");
      }

      if (inventory.reservedStock < reservation.quantity) {
        throw new Error("Reserved stock invariant violated");
      }

      reservation.status = transitionState(
        reservation.status,
        "EXPIRED"
      );

      inventory.reservedStock -= reservation.quantity;
      inventory.availableStock += reservation.quantity;

      const timer = this.expirationTimers.get(
        reservation.reservationId
      );

      if (timer !== undefined) {
        clearTimeout(timer);
        this.expirationTimers.delete(
          reservation.reservationId
        );
      }

      count++;
    }

    return count;
  }

  private finishCheckout(
    reservationId: string,
    success: boolean,
    reason?: string
  ): CheckoutResult {
    const reservation = this.reservations.get(reservationId);

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
        error: `Cannot finish checkout from ${reservation.status}`,
      };
    }

    const inventory = this.inventories.get(
      reservation.productId
    );

    if (!inventory) {
      throw new Error("Inventory missing for reservation");
    }

    if (inventory.reservedStock < reservation.quantity) {
      throw new Error("Reserved stock invariant violated");
    }

    if (success) {
      reservation.status = transitionState(
        reservation.status,
        "COMPLETED"
      );

      inventory.reservedStock -= reservation.quantity;
      inventory.soldStock += reservation.quantity;

      return {
        success: true,
        reservation: { ...reservation },
      };
    }

    // Failure policy: release held stock exactly once.
    reservation.status = transitionState(
      reservation.status,
      "FAILED"
    );

    inventory.reservedStock -= reservation.quantity;
    inventory.availableStock += reservation.quantity;

    return {
      success: false,
      reservation: { ...reservation },
      error:
        reason ??
        "Checkout failed. Reserved stock was released.",
    };
  }

  public checkout(
    reservationId: string,
    processor: () => Promise<boolean>
  ): Promise<CheckoutResult> {
    this.assertActive();
    this.expireReservations();

    const existing = this.checkoutJobs.get(reservationId);

    if (existing) {
      return existing.promise;
    }

    const reservation = this.reservations.get(reservationId);

    if (!reservation) {
      return Promise.resolve({
        success: false,
        error: "Reservation not found",
      });
    }

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
        error: `Cannot checkout a ${reservation.status} reservation`,
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

    // Acquire the lock synchronously, before awaiting payment.
    reservation.status = transitionState(
      reservation.status,
      "CHECKOUT"
    );

    const expiryTimer = this.expirationTimers.get(reservationId);

    if (expiryTimer !== undefined) {
      clearTimeout(expiryTimer);
      this.expirationTimers.delete(reservationId);
    }

    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let resolveCheckout!: (result: CheckoutResult) => void;

    const promise = new Promise<CheckoutResult>((resolve) => {
      resolveCheckout = resolve;
    });

    const settle = (success: boolean, reason?: string) => {
      if (settled) return;
      settled = true;

      if (timeout !== undefined) {
        clearTimeout(timeout);
      }

      // Remove the pending operation before notifying callers.
      this.checkoutJobs.delete(reservationId);

      const result = this.finishCheckout(
        reservationId,
        success,
        reason
      );

      resolveCheckout(result);
    };

    // Register the checkout before invoking the processor.
    this.checkoutJobs.set(reservationId, {
      promise,
      settle,
    });

    timeout = setTimeout(() => {
      settle(
        false,
        "Checkout timed out. Reserved stock was released."
      );
    }, this.checkoutTimeoutMs);

    // A late processor result cannot change finalized stock.
    void Promise.resolve()
      .then(() => processor())
      .then(
        (result) => settle(result === true),
        () => settle(false, "Checkout processor failed.")
      );

    return promise;
  }

  public dispose(): void {
    if (this.disposed) return;

    // Finish pending checkouts before marking the service disposed.
    // Their late payment callbacks will be ignored.
    for (const job of [...this.checkoutJobs.values()]) {
      job.settle(
        false,
        "Inventory service disposed during checkout."
      );
    }

    for (const timer of this.expirationTimers.values()) {
      clearTimeout(timer);
    }

    this.expirationTimers.clear();
    this.disposed = true;
  }
}
