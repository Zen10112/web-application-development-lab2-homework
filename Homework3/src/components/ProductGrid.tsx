import type { Product } from "../types/flash-sale";
import ProductCard from "./ProductCard";

export default function ProductGrid({ products }: { products: Product[] }) {
  return (
    <section className="products-section" aria-labelledby="products-heading">
      <div className="section-heading">
        <h2 id="products-heading">Sản phẩm Flash Sale</h2>
        <span>{products.length} sản phẩm</span>
      </div>
      <div className="product-grid">
        {products.map(product => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>
  );
}
