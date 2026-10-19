
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

function createProduct(stock: number): Product {
  return {
    id: "P001",
    name: "Audit Test Product",
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

describe("HW3 AI Failure Audit Regression Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(
      new Date("2026-11-11T00:00:00Z")
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("HW3-01: prevents late checkout success after dispose", async () => {
    const service = new InventoryService(
      [createProduct(3)],
      30_000,
      5_000
    );

    const reservation = service.reserve({
      productId: "P001",
      quantity: 1,
    }).reservation!;

    let completePayment!: (value: boolean) => void;

    const payment = new Promise<boolean>((resolve) => {
      completePayment = resolve;
    });

    const resultPromise = service.checkout(
      reservation.reservationId,
      () => payment
    );

    service.dispose();

    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.reservation?.status).toBe("FAILED");

    // Payment returns after the service was disposed.
    completePayment(true);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(result.reservation?.status).toBe("FAILED");
  });

  it("HW3-04: fails a checkout that never resolves", async () => {
    const service = new InventoryService(
      [createProduct(2)],
      30_000,
      1_000
    );

    try {
      const reservation = service.reserve({
        productId: "P001",
        quantity: 1,
      }).reservation!;

      const neverCompletes = new Promise<boolean>(
        () => {}
      );

      const resultPromise = service.checkout(
        reservation.reservationId,
        () => neverCompletes
      );

      await vi.advanceTimersByTimeAsync(1_000);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.reservation?.status).toBe("FAILED");

      const inventory = service.getInventory("P001");

      expect(inventory?.availableStock).toBe(2);
      expect(inventory?.reservedStock).toBe(0);
      expect(inventory?.soldStock).toBe(0);
    } finally {
      service.dispose();
    }
  });

  it("ignores a late payment success after timeout", async () => {
    const service = new InventoryService(
      [createProduct(2)],
      30_000,
      1_000
    );

    try {
      const reservation = service.reserve({
        productId: "P001",
        quantity: 1,
      }).reservation!;

      let completePayment!: (value: boolean) => void;

      const payment = new Promise<boolean>((resolve) => {
        completePayment = resolve;
      });

      const resultPromise = service.checkout(
        reservation.reservationId,
        () => payment
      );

      await vi.advanceTimersByTimeAsync(1_000);

      expect((await resultPromise).success).toBe(false);

      completePayment(true);

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const inventory = service.getInventory("P001");

      expect(inventory?.availableStock).toBe(2);
      expect(inventory?.reservedStock).toBe(0);
      expect(inventory?.soldStock).toBe(0);

      expect(
        service.getReservation(
          reservation.reservationId
        )?.status
      ).toBe("FAILED");
    } finally {
      service.dispose();
    }
  });

  it("prevents double checkout with Promise.all", async () => {
    const service = new InventoryService(
      [createProduct(5)],
      30_000,
      5_000
    );

    try {
      const reservation = service.reserve({
        productId: "P001",
        quantity: 2,
      }).reservation!;

      const processor = vi.fn(async () => true);

      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          service.checkout(
            reservation.reservationId,
            processor
          )
        )
      );

      expect(results.every((item) => item.success)).toBe(
        true
      );

      expect(processor).toHaveBeenCalledTimes(1);

      const inventory = service.getInventory("P001");

      expect(inventory?.availableStock).toBe(3);
      expect(inventory?.reservedStock).toBe(0);
      expect(inventory?.soldStock).toBe(2);
    } finally {
      service.dispose();
    }
  });

  it("prevents overselling the final item", async () => {
    const service = new InventoryService(
      [createProduct(1)]
    );

    try {
      const results = await Promise.all(
        Array.from({ length: 25 }, () =>
          Promise.resolve().then(() =>
            service.reserve({
              productId: "P001",
              quantity: 1,
            })
          )
        )
      );

      expect(
        results.filter((item) => item.success)
      ).toHaveLength(1);

      const inventory = service.getInventory("P001");

      expect(inventory?.availableStock).toBe(0);
      expect(inventory?.reservedStock).toBe(1);
      expect(inventory?.soldStock).toBe(0);
    } finally {
      service.dispose();
    }
  });

  it("does not release sold stock when TTL passes", async () => {
    const service = new InventoryService(
      [createProduct(2)],
      1_000,
      5_000
    );

    try {
      const reservation = service.reserve({
        productId: "P001",
        quantity: 1,
      }).reservation!;

      const result = await service.checkout(
        reservation.reservationId,
        async () => true
      );

      expect(result.success).toBe(true);

      await vi.advanceTimersByTimeAsync(2_000);

      expect(
        service.getReservation(
          reservation.reservationId
        )?.status
      ).toBe("COMPLETED");

      const inventory = service.getInventory("P001");

      expect(inventory?.availableStock).toBe(1);
      expect(inventory?.reservedStock).toBe(0);
      expect(inventory?.soldStock).toBe(1);
    } finally {
      service.dispose();
    }
  });

  it("preserves stock during checkout across reservation expiry", async () => {
    const service = new InventoryService(
      [createProduct(2)],
      1_000,
      5_000
    );

    try {
      const reservation = service.reserve({
        productId: "P001",
        quantity: 1,
      }).reservation!;

      let completePayment!: (value: boolean) => void;

      const payment = new Promise<boolean>((resolve) => {
        completePayment = resolve;
      });

      const resultPromise = service.checkout(
        reservation.reservationId,
        () => payment
      );

      await vi.advanceTimersByTimeAsync(2_000);

      expect(
        service.getReservation(
          reservation.reservationId
        )?.status
      ).toBe("CHECKOUT");

      expect(
        service.getInventory("P001")?.reservedStock
      ).toBe(1);

      completePayment(true);
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.reservation?.status).toBe("COMPLETED");
    } finally {
      service.dispose();
    }
  });

  it("rejects expired reservations before checkout", async () => {
    const service = new InventoryService(
      [createProduct(2)],
      1_000
    );

    try {
      const reservation = service.reserve({
        productId: "P001",
        quantity: 1,
      }).reservation!;

      await vi.advanceTimersByTimeAsync(1_500);

      const processor = vi.fn(async () => true);

      const result = await service.checkout(
        reservation.reservationId,
        processor
      );

      expect(result.success).toBe(false);
      expect(processor).not.toHaveBeenCalled();

      expect(
        service.getInventory("P001")?.availableStock
      ).toBe(2);
    } finally {
      service.dispose();
    }
  });
});
