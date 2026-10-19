
import type { Product } from "../types/flash-sale";
import { formatCurrency } from "../utils/format";

interface ProductCardProps {
  product: Product;
  isSaleEnded: boolean;
  onBuyNow: (product: Product) => void;
}

export default function ProductCard({
  product,
  isSaleEnded,
  onBuyNow,
}: ProductCardProps) {
  const isOutOfStock =
    product.inventory.availableStock <= 0;

  const isDisabled = isSaleEnded || isOutOfStock;

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
            Còn lại:{" "}
            <strong>
              {product.inventory.availableStock}
            </strong>
          </span>

          <div
            className="stock-progress"
            role="progressbar"
            aria-label={`Tồn kho ${product.name}`}
            aria-valuemin={0}
            aria-valuemax={product.inventory.totalStock}
            aria-valuenow={product.inventory.availableStock}
          >
            <div
              className="stock-progress-fill"
              style={{
                width: `${
                  (product.inventory.availableStock /
                    Math.max(1, product.inventory.totalStock)) *
                  100
                }%`,
              }}
            />
          </div>
        </div>

        <button
          type="button"
          className="buy-button"
          disabled={isDisabled}
          onClick={() => onBuyNow(product)}
        >
          {isSaleEnded
            ? "Sale đã kết thúc"
            : isOutOfStock
              ? "Hết hàng"
              : "Mua ngay"}
        </button>
      </div>
    </article>
  );
}
