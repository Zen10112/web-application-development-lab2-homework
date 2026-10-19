
import type { Reservation } from "../types/inventory";

interface OrderStatusProps {
  reservation: Reservation | null;
  error: string | null;
  isReserving: boolean;
}

export default function OrderStatus({
  reservation,
  error,
  isReserving,
}: OrderStatusProps) {
  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  let message = "Chưa có đơn hàng nào.";
  let statusClass = "idle";

  if (isReserving) {
    message = "RESERVING – Đang giữ hàng...";
    statusClass = "reserving";
  } else if (error) {
    message = `FAILED – ${error}`;
    statusClass = "failed";
  } else if (reservation?.status === "RESERVED") {
    message = "RESERVED – Giữ hàng thành công!";
    statusClass = "reserved";
  } else if (reservation?.status === "EXPIRED") {
    message = "EXPIRED – Đã hết thời gian giữ hàng.";
    statusClass = "expired";
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
        <span>Reservation Status</span>
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
          {isReserving
            ? "⏳"
            : error
              ? "⚠️"
              : reservation?.status === "RESERVED"
                ? "✅"
                : reservation?.status === "EXPIRED"
                  ? "⌛"
                  : "🛒"}
        </div>

        <p>{message}</p>

        {reservation && !isReserving && !error && (
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
              <strong>Created:</strong>{" "}
              {formatTime(reservation.createdAt)}
            </div>

            <div>
              <strong>Expires:</strong>{" "}
              {formatTime(reservation.expiresAt)}
            </div>
          </div>
        )}

        <small>
          Đây là mô phỏng giữ hàng. Chưa thực hiện
          thanh toán hoặc tạo đơn hàng thật.
        </small>
      </div>
    </section>
  );
}
