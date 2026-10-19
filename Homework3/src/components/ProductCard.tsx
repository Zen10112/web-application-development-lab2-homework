import type { Product } from "../types/flash-sale";
import { formatCurrency } from "../utils/format";

interface ProductCardProps { product: Product }

export default function ProductCard({ product }: ProductCardProps) {
  const { inventory } = product;
  const outOfStock = inventory.availableStock === 0;
  const stockPercent = 100 * inventory.availableStock / Math.max(1, inventory.totalStock);

  return (
    <article className="product-card">
      <div className="product-image-wrapper">
        <img src={product.image} alt={product.name} className="product-image" loading="lazy" />
        <span className="discount-badge">-{product.discountPercent}%</span>
      </div>
      <div className="product-content">
        <span className="product-category">{product.category}</span>
        <h3 className="product-name">{product.name}</h3>
        <div className="product-prices">
          <span className="sale-price">{formatCurrency(product.salePrice)}</span>
          <span className="original-price">{formatCurrency(product.originalPrice)}</span>
        </div>
        <div className="product-stock">
          <span>Còn lại: <strong>{inventory.availableStock}</strong></span>
          <div className="stock-progress" role="progressbar"
            aria-label={`Tồn kho ${product.name}`} aria-valuemin={0}
            aria-valuemax={inventory.totalStock} aria-valuenow={inventory.availableStock}>
            <div className="stock-progress-fill" style={{ width: `${stockPercent}%` }} />
          </div>
        </div>
        <button type="button" className="buy-button" disabled
          title="Chức năng mua hàng sẽ được triển khai ở giai đoạn sau">
          {outOfStock ? "Hết hàng" : "Mua ngay"}
        </button>
      </div>
    </article>
  );
}
