import type { OrderStatusType } from "../types/flash-sale";

const messages: Record<OrderStatusType, string> = {
  idle: "Chưa có đơn hàng nào.",
  reserving: "Đang giữ hàng...",
  reserved: "Đã giữ hàng thành công.",
  expired: "Thời gian giữ hàng đã hết.",
  "checking-out": "Đang thanh toán...",
  success: "Đặt hàng thành công!",
  failed: "Đặt hàng thất bại.",
};

export default function OrderStatus({ status }: { status: OrderStatusType }) {
  return (
    <section className="order-panel" aria-labelledby="order-heading">
      <div className="section-heading"><h2 id="order-heading">Trạng thái đặt hàng</h2><span>Order Status</span></div>
      <div className="order-placeholder">
        <div className="order-symbol" aria-hidden="true">🛒</div>
        <p role="status">{messages[status]}</p>
        <small>Chức năng giữ hàng và checkout sẽ được bổ sung ở các giai đoạn tiếp theo.</small>
      </div>
    </section>
  );
}
