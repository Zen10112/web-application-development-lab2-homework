
import type { Reservation } from "../types/inventory";

interface OrderStatusProps {
  reservation: Reservation | null;
  error: string | null;
  isReserving: boolean;
  isCheckingOut: boolean;
  onCheckout: (reservationId: string) => void;
}

export default function OrderStatus({
  reservation,
  error,
  isReserving,
  isCheckingOut,
  onCheckout,
}: OrderStatusProps) {
  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const canCheckout =
    reservation?.status === "RESERVED" &&
    !isReserving &&
    !isCheckingOut &&
    Date.now() < reservation.expiresAt;

  let message = "Chưa có đơn hàng nào.";
  let statusClass = "idle";
  let symbol = "🛒";

  if (isCheckingOut) {
    message = "CHECKOUT – Đang xử lý thanh toán...";
    statusClass = "reserving";
    symbol = "⏳";
  } else if (isReserving) {
    message = "RESERVING – Đang giữ hàng...";
    statusClass = "reserving";
    symbol = "⏳";
  } else if (error) {
    message = `FAILED – ${error}`;
    statusClass = "failed";
    symbol = "⚠️";
  } else if (reservation?.status === "RESERVED") {
    message = "RESERVED – Giữ hàng thành công!";
    statusClass = "reserved";
    symbol = "✅";
  } else if (reservation?.status === "CHECKOUT") {
    message = "CHECKOUT – Đang xử lý thanh toán...";
    statusClass = "reserving";
    symbol = "⏳";
  } else if (reservation?.status === "COMPLETED") {
    message = "COMPLETED – Thanh toán thành công!";
    statusClass = "reserved";
    symbol = "✅";
  } else if (reservation?.status === "EXPIRED") {
    message = "EXPIRED – Đã hết thời gian giữ hàng.";
    statusClass = "expired";
    symbol = "⌛";
  } else if (reservation?.status === "FAILED") {
    message = "FAILED – Thanh toán thất bại, đã trả hàng.";
    statusClass = "failed";
    symbol = "❌";
  }

  return (
    <section
      className="order-panel"
      aria-labelledby="order-heading"
    >
      <div className="section-heading">
        <h2 id="order-heading">
          Trạng thái đặt hàng
        </h2>

        <span>Reservation & Checkout</span>
      </div>

      <div
        className={`order-placeholder reservation-${statusClass}`}
        role="status"
        aria-live="polite"
      >
        <div
          className="order-symbol"
          aria-hidden="true"
        >
          {symbol}
        </div>

        <p>{message}</p>

        {reservation && (
          <div className="reservation-details">
            <div>
              <strong>Reservation ID:</strong>{" "}
              <code>{reservation.reservationId}</code>
            </div>

            <div>
              <strong>Product:</strong>{" "}
              {reservation.productId}
            </div>

            <div>
              <strong>Quantity:</strong>{" "}
              {reservation.quantity}
            </div>

            <div>
              <strong>Status:</strong>{" "}
              {isCheckingOut
                ? "CHECKOUT"
                : reservation.status}
            </div>

            <div>
              <strong>Created:</strong>{" "}
              {formatTime(reservation.createdAt)}
            </div>

            <div>
              <strong>Expires:</strong>{" "}
              {formatTime(reservation.expiresAt)}
            </div>
          </div>
        )}

        {reservation?.status === "RESERVED" && (
          <button
            type="button"
            className="buy-button"
            style={{
              maxWidth: 260,
              margin: "16px auto",
            }}
            disabled={!canCheckout}
            onClick={() =>
              onCheckout(reservation.reservationId)
            }
          >
            {isCheckingOut
              ? "Processing..."
              : "Checkout"}
          </button>
        )}

        {isCheckingOut && (
          <p>
            Đang xác nhận đơn hàng, vui lòng chờ...
          </p>
        )}

        <small>
          Thanh toán hiện được mô phỏng bằng Promise.
          Không có giao dịch tiền thật.
        </small>
      </div>
    </section>
  );
}
