
import type { Product } from "../types/flash-sale";
import { formatCurrency } from "../utils/format";

interface ProductCardProps {
  product: Product;
  isSaleEnded: boolean;
  isReserving: boolean;
  onBuyNow: (product: Product) => void;
}

export default function ProductCard({
  product,
  isSaleEnded,
  isReserving,
  onBuyNow,
}: ProductCardProps) {
  const available =
    product.inventory.availableStock;

  const isOutOfStock = available <= 0;

  const isDisabled =
    isSaleEnded || isReserving || isOutOfStock;

  const stockPercent =
    (available /
      Math.max(1, product.inventory.totalStock)) *
    100;

  return (
    <article className="product-card">
      <div className="product-image-wrapper">
        <img
          src={product.image}
          alt={product.name}
          className="product-image"
          loading="lazy"
        />

        <span className="discount-badge">
          -{product.discountPercent}%
        </span>
      </div>

      <div className="product-content">
        <span className="product-category">
          {product.category}
        </span>

        <h3 className="product-name">
          {product.name}
        </h3>

        <div className="product-prices">
          <span className="sale-price">
            {formatCurrency(product.salePrice)}
          </span>

          <span className="original-price">
            {formatCurrency(product.originalPrice)}
          </span>
        </div>

        <div className="product-stock">
          <span>
            Còn lại: <strong>{available}</strong>
          </span>

          <div
            className="stock-progress"
            role="progressbar"
            aria-label={`Tồn kho ${product.name}`}
            aria-valuemin={0}
            aria-valuemax={product.inventory.totalStock}
            aria-valuenow={available}
          >
            <div
              className="stock-progress-fill"
              style={{
                width: `${Math.max(0, Math.min(100, stockPercent))}%`,
              }}
            />
          </div>
        </div>

        <button
          type="button"
          className={`buy-button ${
            isReserving ? "is-reserving" : ""
          }`}
          disabled={isDisabled}
          onClick={() => onBuyNow(product)}
        >
          {isSaleEnded
            ? "Sale đã kết thúc"
            : isReserving
              ? "Reserving..."
              : isOutOfStock
                ? "Hết hàng"
                : "Mua ngay"}
        </button>
      </div>
    </article>
  );
}
