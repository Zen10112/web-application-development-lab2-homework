
interface CountdownTimerProps {
  remainingMs: number;
  isEnded: boolean;
}

function formatTime(remainingMs: number) {
  const totalMs = Math.max(
    0,
    Math.floor(remainingMs)
  );

  const hours = Math.floor(totalMs / 3600000);

  const minutes = Math.floor(
    (totalMs % 3600000) / 60000
  );

  const seconds = Math.floor(
    (totalMs % 60000) / 1000
  );

  const milliseconds = totalMs % 1000;

  return {
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
    milliseconds: String(milliseconds).padStart(3, "0"),
  };
}

export default function CountdownTimer({
  remainingMs,
  isEnded,
}: CountdownTimerProps) {
  const time = formatTime(remainingMs);

  return (
    <section
      className="countdown-panel"
      aria-labelledby="countdown-title"
    >
      <div>
        <h2 id="countdown-title">
          Flash Sale Countdown
        </h2>

        <p>
          {isEnded
            ? "Chương trình đã kết thúc"
            : "Thời gian còn lại"}
        </p>
      </div>

      {isEnded ? (
        <div
          className="countdown-ended"
          role="status"
        >
          Flash Sale Ended
        </div>
      ) : (
        <div
          className="countdown-clock"
          role="timer"
          aria-label="Thời gian Flash Sale còn lại"
          aria-live="off"
        >
          <span>{time.hours}</span>
          <b>:</b>
          <span>{time.minutes}</span>
          <b>:</b>
          <span>{time.seconds}</span>
          <b>.</b>
          <span>{time.milliseconds}</span>
        </div>
      )}

      <p className="countdown-notice">
        {isEnded
          ? "Các sản phẩm hiện không thể mua."
          : "Flash Sale đang diễn ra"}
      </p>
    </section>
  );
}
