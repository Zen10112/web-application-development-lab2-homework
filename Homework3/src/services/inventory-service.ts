
import type { Product } from "../types/flash-sale";

import type {
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

  private disposed = false;

 constructor(
  products: Product[],
  reservationTtlMs: number = DEFAULT_RESERVATION_TTL_MS
) {
  this.reservationTtlMs = reservationTtlMs;
    if (
      !Number.isSafeInteger(reservationTtlMs) ||
      reservationTtlMs <= 0 ||
      reservationTtlMs > MAX_TIMEOUT_MS
    ) {
      throw new RangeError(
        "Reservation TTL must be a positive integer within the timer limit"
      );
    }

    for (const product of products) {
      const inventory = product.inventory;

      if (
        this.inventories.has(product.id)
      ) {
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

      // Clone inventory. Never mutate Product props.
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

  // Automatically expires overdue reservations
  // before returning any inventory information.
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
    return this.getInventory(productId)?.availableStock ?? 0;
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

  // Create a reservation synchronously.
  public reserve(
    request: ReservationRequest
  ): ReservationResult {
    this.assertActive();

    // Reclaim expired stock before checking availability.
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

    // AVAILABLE -> RESERVING -> RESERVED
    let status = transitionState(
      "AVAILABLE",
      "RESERVING"
    );

    // No await between stock check and stock update.
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

    // Schedule automatic release.
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

  // Find and release all overdue reservations.
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

      reservation.status = transitionState(
        reservation.status,
        "EXPIRED"
      );

      const inventory = this.inventories.get(
        reservation.productId
      );

      if (!inventory) {
        throw new Error(
          "Inventory missing for an existing reservation"
        );
      }

      // Release previously reserved stock.
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

  public getAllInventories(): InventorySnapshot[] {
    this.assertActive();
    this.expireReservations();

    return Array.from(
      this.inventories.values(),
      (inventory) => ({ ...inventory })
    );
  }

  // Release timers and close this demo service.
  public dispose(): void {
    if (this.disposed) return;

    for (const timeout of this.expirationTimers.values()) {
      clearTimeout(timeout);
    }

    this.expirationTimers.clear();
    this.disposed = true;
  }
}
