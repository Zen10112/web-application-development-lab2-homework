
import CountdownTimer from "./CountdownTimer";

interface FlashSaleHeaderProps {
  remainingMs: number;
  isEnded: boolean;
}

export default function FlashSaleHeader({
  remainingMs,
  isEnded,
}: FlashSaleHeaderProps) {
  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <a className="brand" href="#home">
            FLASH<span>VN</span>
          </a>

          <span className="header-label">
            11.11 MEGA SALE
          </span>
        </div>
      </header>

      <section
        className="sale-hero"
        id="home"
        aria-labelledby="sale-title"
      >
        <div className="hero-content">
          <span className="hero-kicker">
            SIÊU SALE VIỆT NAM
          </span>

          <h1 id="sale-title">
            FLASH SALE 11.11
          </h1>

          <p>
            Săn deal cực sốc – Giá tốt trong thời gian giới hạn!
          </p>

          <div className="sale-highlights">
            <span>Giảm đến 70%</span>
            <span>Hàng số lượng giới hạn</span>
            <span>Ưu đãi đặc biệt</span>
          </div>
        </div>
      </section>

      <CountdownTimer
        remainingMs={remainingMs}
        isEnded={isEnded}
      />
    </>
  );
}
