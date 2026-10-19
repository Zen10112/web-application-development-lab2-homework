
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

    expect(
      canTransition("RESERVED", "CHECKOUT")
    ).toBe(true);

    expect(
      canTransition("CHECKOUT", "COMPLETED")
    ).toBe(true);

    expect(
      canTransition("CHECKOUT", "FAILED")
    ).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(
      canTransition("EXPIRED", "RESERVED")
    ).toBe(false);

    expect(
      canTransition("COMPLETED", "AVAILABLE")
    ).toBe(false);

    expect(() =>
      transitionState("COMPLETED", "AVAILABLE")
    ).toThrow("Invalid state transition");
  });
});

describe("InventoryService Reservation", () => {
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
    for (const quantity of [0, -1, 1.5, NaN]) {
      const result = service.reserve({
        productId: "P001",
        quantity,
      });

      expect(result.success).toBe(false);
    }
  });

  it("expires reservation after TTL", () => {
    const result = service.reserve({
      productId: "P001",
      quantity: 4,
    });

    const id = result.reservation!.reservationId;

    vi.advanceTimersByTime(5000);

    expect(
      service.getReservation(id)?.status
    ).toBe("EXPIRED");

    const inventory = service.getInventory("P001");

    expect(inventory?.availableStock).toBe(10);
    expect(inventory?.reservedStock).toBe(0);
  });

  it("handles delayed timeout callbacks", () => {
    const result = service.reserve({
      productId: "P001",
      quantity: 6,
    });

    const id = result.reservation!.reservationId;

    vi.setSystemTime(Date.now() + 10000);

    expect(
      service.getReservation(id)?.status
    ).toBe("EXPIRED");

    expect(
      service.getAvailableStock("P001")
    ).toBe(10);
  });

  it("handles many reservation requests safely", () => {
    const results = Array.from(
      { length: 20 },
      () =>
        service.reserve({
          productId: "P001",
          quantity: 1,
        })
    );

    expect(
      results.filter((result) => result.success)
    ).toHaveLength(10);

    const inventory = service.getInventory("P001");

    expect(inventory?.availableStock).toBe(0);
    expect(inventory?.reservedStock).toBe(10);
  });

  it("does not release expired stock twice", () => {
    service.reserve({
      productId: "P001",
      quantity: 3,
    });

    vi.setSystemTime(Date.now() + 6000);

    expect(service.expireReservations()).toBe(1);
    expect(service.expireReservations()).toBe(0);

    expect(
      service.getAvailableStock("P001")
    ).toBe(10);
  });

  it("does not mutate original Product data", () => {
    const product = createProduct(10);

    const localService = new InventoryService(
      [product],
      5000
    );

    try {
      localService.reserve({
        productId: "P001",
        quantity: 5,
      });

      expect(
        product.inventory.availableStock
      ).toBe(10);

      expect(
        product.inventory.reservedStock
      ).toBe(0);
    } finally {
      localService.dispose();
    }
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

describe("Checkout & Concurrency Protection", () => {
  beforeEach(() => {
    vi.useFakeTimers();

    vi.setSystemTime(
      new Date("2026-11-11T00:00:00Z")
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows only one customer to reserve the last item", async () => {
    const service = new InventoryService(
      [createProduct(1)],
      5000
    );

    try {
      const attempts = await Promise.all(
        Array.from({ length: 20 }, () =>
          Promise.resolve().then(() =>
            service.reserve({
              productId: "P001",
              quantity: 1,
            })
          )
        )
      );

      expect(
        attempts.filter((result) => result.success)
      ).toHaveLength(1);

      const inventory = service.getInventory("P001");

      expect(inventory?.availableStock).toBe(0);
      expect(inventory?.reservedStock).toBe(1);
      expect(inventory?.soldStock).toBe(0);
    } finally {
      service.dispose();
    }
  });

  it("processes concurrent checkout only once", async () => {
    const service = new InventoryService(
      [createProduct(5)],
      5000
    );

    try {
      const reservation = service.reserve({
        productId: "P001",
        quantity: 2,
      }).reservation!;

      const processor = vi.fn(async () => true);

      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          service.checkout(
            reservation.reservationId,
            processor
          )
        )
      );

      expect(
        results.every((result) => result.success)
      ).toBe(true);

      expect(processor).toHaveBeenCalledTimes(1);

      const inventory = service.getInventory("P001");

      expect(inventory?.availableStock).toBe(3);
      expect(inventory?.reservedStock).toBe(0);
      expect(inventory?.soldStock).toBe(2);
    } finally {
      service.dispose();
    }
  });

  it("does not count an already completed checkout twice", async () => {
    const service = new InventoryService(
      [createProduct(10)],
      5000
    );

    try {
      const reservation = service.reserve({
        productId: "P001",
        quantity: 3,
      }).reservation!;

      const processor = vi.fn(async () => true);

      await service.checkout(
        reservation.reservationId,
        processor
      );

      const results = await Promise.all([
        service.checkout(
          reservation.reservationId,
          processor
        ),
        service.checkout(
          reservation.reservationId,
          processor
        ),
      ]);

      expect(
        results.every((result) => result.success)
      ).toBe(true);

      expect(processor).toHaveBeenCalledTimes(1);

      const inventory = service.getInventory("P001");

      expect(inventory?.availableStock).toBe(7);
      expect(inventory?.reservedStock).toBe(0);
      expect(inventory?.soldStock).toBe(3);
    } finally {
      service.dispose();
    }
  });

  it("does not release stock when TTL passes during checkout", async () => {
    const service = new InventoryService(
      [createProduct(2)],
      1000
    );

    try {
      const reservation = service.reserve({
        productId: "P001",
        quantity: 1,
      }).reservation!;

      let resolvePayment!: (success: boolean) => void;

      const payment = new Promise<boolean>((resolve) => {
        resolvePayment = resolve;
      });

      const checkoutPromise = service.checkout(
        reservation.reservationId,
        () => payment
      );

      vi.advanceTimersByTime(2000);

      expect(
        service.getReservation(
          reservation.reservationId
        )?.status
      ).toBe("CHECKOUT");

      expect(
        service.getInventory("P001")?.reservedStock
      ).toBe(1);

      resolvePayment(true);

      const result = await checkoutPromise;

      expect(result.success).toBe(true);
      expect(result.reservation?.status).toBe("COMPLETED");

      const inventory = service.getInventory("P001");

      expect(inventory?.availableStock).toBe(1);
      expect(inventory?.reservedStock).toBe(0);
      expect(inventory?.soldStock).toBe(1);
    } finally {
      service.dispose();
    }
  });

  it("releases stock once after checkout failure", async () => {
    const service = new InventoryService(
      [createProduct(5)],
      5000
    );

    try {
      const reservation = service.reserve({
        productId: "P001",
        quantity: 2,
      }).reservation!;

      const first = await service.checkout(
        reservation.reservationId,
        async () => false
      );

      expect(first.success).toBe(false);
      expect(first.reservation?.status).toBe("FAILED");

      const inventory = service.getInventory("P001");

      expect(inventory?.availableStock).toBe(5);
      expect(inventory?.reservedStock).toBe(0);
      expect(inventory?.soldStock).toBe(0);

      const second = await service.checkout(
        reservation.reservationId,
        async () => true
      );

      expect(second.success).toBe(false);

      expect(
        service.getInventory("P001")?.availableStock
      ).toBe(5);
    } finally {
      service.dispose();
    }
  });

  it("rejects checkout after reservation expiry", async () => {
    const service = new InventoryService(
      [createProduct(3)],
      1000
    );

    try {
      const reservation = service.reserve({
        productId: "P001",
        quantity: 1,
      }).reservation!;

      vi.advanceTimersByTime(1500);

      const processor = vi.fn(async () => true);

      const result = await service.checkout(
        reservation.reservationId,
        processor
      );

      expect(result.success).toBe(false);
      expect(processor).not.toHaveBeenCalled();

      expect(
        service.getReservation(
          reservation.reservationId
        )?.status
      ).toBe("EXPIRED");

      expect(
        service.getAvailableStock("P001")
      ).toBe(3);
    } finally {
      service.dispose();
    }
  });

  it("handles rejected payment and restores inventory", async () => {
    const service = new InventoryService(
      [createProduct(4)],
      5000
    );

    try {
      const reservation = service.reserve({
        productId: "P001",
        quantity: 2,
      }).reservation!;

      const result = await service.checkout(
        reservation.reservationId,
        async () => {
          throw new Error(
            "Payment provider unavailable"
          );
        }
      );

      expect(result.success).toBe(false);
      expect(result.reservation?.status).toBe("FAILED");

      const inventory = service.getInventory("P001");

      expect(inventory?.availableStock).toBe(4);
      expect(inventory?.reservedStock).toBe(0);
      expect(inventory?.soldStock).toBe(0);
    } finally {
      service.dispose();
    }
  });
});
