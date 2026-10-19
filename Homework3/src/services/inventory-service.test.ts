
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { Product } from "../types/flash-sale";
import { InventoryService } from "./inventory-service";

import {
  canTransition,
  transitionState,
} from "./inventory-state-machine";

function createProduct(stock: number): Product {
  return {
    id: "P001",
    name: "Test Product",
    image: "/test.png",
    category: "Electronics",
    originalPrice: 1000000,
    salePrice: 500000,
    discountPercent: 50,
    inventory: {
      productId: "P001",
      totalStock: stock,
      availableStock: stock,
      reservedStock: 0,
      soldStock: 0,
    },
  };
}

describe("Inventory State Machine", () => {
  it("allows valid transitions", () => {
    expect(
      canTransition("AVAILABLE", "RESERVING")
    ).toBe(true);

    expect(
      canTransition("RESERVING", "RESERVED")
    ).toBe(true);

    expect(
      canTransition("RESERVED", "EXPIRED")
    ).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(
      canTransition("EXPIRED", "RESERVED")
    ).toBe(false);

    expect(() =>
      transitionState("COMPLETED", "AVAILABLE")
    ).toThrow("Invalid state transition");
  });
});

describe("InventoryService", () => {
  let service: InventoryService;

  beforeEach(() => {
    vi.useFakeTimers();

    vi.setSystemTime(
      new Date("2026-11-11T00:00:00Z")
    );

    service = new InventoryService(
      [createProduct(10)],
      5000
    );
  });

  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
  });

  it("creates a reservation successfully", () => {
    const result = service.reserve({
      productId: "P001",
      quantity: 3,
    });

    expect(result.success).toBe(true);
    expect(result.reservation?.status).toBe("RESERVED");
    expect(result.reservation?.quantity).toBe(3);

    const inventory = service.getInventory("P001");

    expect(inventory?.availableStock).toBe(7);
    expect(inventory?.reservedStock).toBe(3);
    expect(inventory?.soldStock).toBe(0);
  });

  it("rejects reservation with insufficient stock", () => {
    const result = service.reserve({
      productId: "P001",
      quantity: 11,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Insufficient stock");

    expect(
      service.getInventory("P001")?.availableStock
    ).toBe(10);
  });

  it("prevents inventory from becoming negative", () => {
    const first = service.reserve({
      productId: "P001",
      quantity: 8,
    });

    const second = service.reserve({
      productId: "P001",
      quantity: 5,
    });

    expect(first.success).toBe(true);
    expect(second.success).toBe(false);

    const inventory = service.getInventory("P001");

    expect(inventory?.availableStock).toBe(2);
    expect(inventory?.reservedStock).toBe(8);
  });

  it("rejects invalid quantities", () => {
    expect(
      service.reserve({
        productId: "P001",
        quantity: 0,
      }).success
    ).toBe(false);

    expect(
      service.reserve({
        productId: "P001",
        quantity: -1,
      }).success
    ).toBe(false);

    expect(
      service.reserve({
        productId: "P001",
        quantity: 1.5,
      }).success
    ).toBe(false);
  });

  it("expires reservation after the TTL", () => {
    const result = service.reserve({
      productId: "P001",
      quantity: 4,
    });

    const id = result.reservation!.reservationId;

    vi.advanceTimersByTime(5000);

    const reservation = service.getReservation(id);

    expect(reservation?.status).toBe("EXPIRED");

    const inventory = service.getInventory("P001");

    expect(inventory?.availableStock).toBe(10);
    expect(inventory?.reservedStock).toBe(0);
  });

  it("uses Date.now when timer callbacks are delayed", () => {
    const result = service.reserve({
      productId: "P001",
      quantity: 6,
    });

    const id = result.reservation!.reservationId;

    // Move wall clock forward without executing timers.
    vi.setSystemTime(Date.now() + 10000);

    expect(
      service.getReservation(id)?.status
    ).toBe("EXPIRED");

    expect(
      service.getAvailableStock("P001")
    ).toBe(10);
  });

  it("handles simultaneous reservation requests safely", () => {
    const results = Array.from(
      { length: 20 },
      () =>
        service.reserve({
          productId: "P001",
          quantity: 1,
        })
    );

    const successCount = results.filter(
      (result) => result.success
    ).length;

    expect(successCount).toBe(10);

    const inventory = service.getInventory("P001");

    expect(inventory?.availableStock).toBe(0);
    expect(inventory?.reservedStock).toBe(10);
  });

  it("does not release an expired reservation twice", () => {
    service.reserve({
      productId: "P001",
      quantity: 3,
    });

    vi.setSystemTime(Date.now() + 6000);

    const firstSweep = service.expireReservations();
    const secondSweep = service.expireReservations();

    expect(firstSweep).toBe(1);
    expect(secondSweep).toBe(0);

    expect(
      service.getAvailableStock("P001")
    ).toBe(10);
  });

  it("does not mutate the original product", () => {
    const product = createProduct(10);

    const localService = new InventoryService(
      [product],
      5000
    );

    localService.reserve({
      productId: "P001",
      quantity: 5,
    });

    expect(product.inventory.availableStock).toBe(10);
    expect(product.inventory.reservedStock).toBe(0);

    localService.dispose();
  });

  it("rejects operations after disposal", () => {
    service.dispose();

    expect(() =>
      service.reserve({
        productId: "P001",
        quantity: 1,
      })
    ).toThrow("disposed");
  });
});
