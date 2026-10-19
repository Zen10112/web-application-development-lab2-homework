
export type ReservationStatus =
  | "AVAILABLE"
  | "RESERVING"
  | "RESERVED"
  | "CHECKOUT"
  | "COMPLETED"
  | "EXPIRED"
  | "FAILED";

export interface Reservation {
  reservationId: string;
  productId: string;
  quantity: number;
  createdAt: number;
  expiresAt: number;
  status: ReservationStatus;
}

export interface ReservationRequest {
  productId: string;
  quantity: number;
}

export interface InventorySnapshot {
  productId: string;
  totalStock: number;
  availableStock: number;
  reservedStock: number;
  soldStock: number;
}

export interface ReservationResult {
  success: boolean;
  reservation?: Reservation;
  error?: string;
}

export interface CheckoutResult {
  success: boolean;
  reservation?: Reservation;
  error?: string;
}
