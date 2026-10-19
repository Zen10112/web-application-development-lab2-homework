
import type { Reservation } from "../types/inventory";

interface OrderStatusProps {
  reservations: Reservation[];
  error: string | null;
  isReserving: boolean;
  checkoutPendingIds: string[];
  onCheckout: (reservationId: string) => void;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function statusMessage(status: Reservation["status"]): string {
  switch (status) {
    case "RESERVED":
      return "RESERVED – Giữ hàng thành công";
    case "CHECKOUT":
      return "CHECKOUT – Đang thanh toán";
    case "COMPLETED":
      return "COMPLETED – Thanh toán thành công";
    case "EXPIRED":
      return "EXPIRED – Hết thời gian giữ hàng";
    case "FAILED":
      return "FAILED – Đã trả hàng về kho";
    case "RESERVING":
      return "RESERVING – Đang giữ hàng";
    default:
      return status;
  }
}

export default function OrderStatus({
  reservations,
  error,
  isReserving,
  checkoutPendingIds,
  onCheckout,
}: OrderStatusProps) {
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

      {error && (
        <p
          role="alert"
          className="demo-purchase-notice"
        >
          {error}
        </p>
      )}

      {isReserving && (
        <div
          className="order-placeholder reservation-reserving"
          role="status"
        >
          <p>⏳ RESERVING – Đang giữ hàng...</p>
        </div>
      )}

      {reservations.length === 0 && !isReserving ? (
        <div className="order-placeholder">
          <div className="order-symbol" aria-hidden="true">
            🛒
          </div>

          <p>Chưa có reservation nào.</p>

          <small>
            Chọn Mua ngay để bắt đầu giữ hàng.
          </small>
        </div>
      ) : (
        <div className="reservation-list">
          {reservations.map((reservation) => {
            const isCheckingOut =
              checkoutPendingIds.includes(
                reservation.reservationId
              );

            const canCheckout =
              reservation.status === "RESERVED" &&
              !isCheckingOut &&
              Date.now() < reservation.expiresAt;

            const style =
              reservation.status === "COMPLETED" ||
              reservation.status === "RESERVED"
                ? "reservation-reserved"
                : reservation.status === "FAILED"
                  ? "reservation-failed"
                  : reservation.status === "EXPIRED"
                    ? "reservation-expired"
                    : reservation.status === "CHECKOUT"
                      ? "reservation-reserving"
                      : "";

            return (
              <article
                key={reservation.reservationId}
                className={`order-placeholder ${style}`}
              >
                <p role="status">
                  {statusMessage(reservation.status)}
                </p>

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
                    {reservation.status}
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

                {reservation.status === "RESERVED" && (
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
                    Checkout
                  </button>
                )}

                {reservation.status === "CHECKOUT" && (
                  <p>Đang xử lý checkout...</p>
                )}

                {reservation.status === "COMPLETED" && (
                  <small>
                    Sản phẩm đã được ghi nhận là đã bán.
                  </small>
                )}

                {reservation.status === "EXPIRED" && (
                  <small>
                    Hàng đã được trả về kho.
                  </small>
                )}

                {reservation.status === "FAILED" && (
                  <small>
                    Checkout không thành công. Hàng đã được
                    giải phóng.
                  </small>
                )}
              </article>
            );
          })}
        </div>
      )}

      <small>
        Thanh toán chỉ được mô phỏng trong trình duyệt.
        Không phát sinh giao dịch thật.
      </small>
    </section>
  );
}
