export default function FlashSaleHeader() {
  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <a className="brand" href="#home">FLASH<span>VN</span></a>
          <span className="header-label">11.11 MEGA SALE</span>
        </div>
      </header>
      <section className="sale-hero" id="home" aria-labelledby="sale-title">
        <div className="hero-content">
          <span className="hero-kicker">SIÊU SALE VIỆT NAM</span>
          <h1 id="sale-title">FLASH SALE 11.11</h1>
          <p>Săn deal cực sốc – Giá tốt trong thời gian giới hạn!</p>
          <div className="sale-highlights">
            <span>Giảm đến 70%</span><span>Hàng số lượng giới hạn</span><span>Ưu đãi đặc biệt</span>
          </div>
        </div>
      </section>
      <section className="countdown-panel" aria-labelledby="countdown-title">
        <div><h2 id="countdown-title">Flash Sale Countdown</h2><p>Thời gian còn lại</p></div>
        <div className="countdown-clock" aria-label="Countdown chưa được kích hoạt">
          <span>00</span><b>:</b><span>00</span><b>:</b><span>00</span><b>.</b><span>000</span>
        </div>
        <p className="countdown-notice">Demo giao diện – Timer chưa hoạt động</p>
      </section>
    </>
  );
}
