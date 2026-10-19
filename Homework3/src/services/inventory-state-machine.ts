
import type {
  ReservationStatus,
} from "../types/inventory";

const VALID_TRANSITIONS: Record<
  ReservationStatus,
  readonly ReservationStatus[]
> = {
  AVAILABLE: ["RESERVING"],

  RESERVING: [
    "RESERVED",
    "FAILED",
  ],

  RESERVED: [
    "EXPIRED",
    "CHECKOUT",
  ],

  CHECKOUT: [
    "COMPLETED",
    "FAILED",
  ],

  COMPLETED: [],
  EXPIRED: [],
  FAILED: [],
};

export function canTransition(
  current: ReservationStatus,
  next: ReservationStatus
): boolean {
  return VALID_TRANSITIONS[current].includes(next);
}

export function transitionState(
  current: ReservationStatus,
  next: ReservationStatus
): ReservationStatus {
  if (!canTransition(current, next)) {
    throw new Error(
      `Invalid state transition: ${current} -> ${next}`
    );
  }

  return next;
}

export function isTerminalState(
  status: ReservationStatus
): boolean {
  return (
    status === "COMPLETED" ||
    status === "EXPIRED" ||
    status === "FAILED"
  );
}
