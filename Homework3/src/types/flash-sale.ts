export interface Inventory {
  productId: string;
  totalStock: number;
  availableStock: number;
  reservedStock: number;
  soldStock: number;
}

export interface Product {
  id: string;
  name: string;
  image: string;
  category: string;
  originalPrice: number;
  salePrice: number;
  discountPercent: number;
  inventory: Inventory;
}

export type OrderStatusType =
  | "idle" | "reserving" | "reserved" | "expired"
  | "checking-out" | "success" | "failed";
