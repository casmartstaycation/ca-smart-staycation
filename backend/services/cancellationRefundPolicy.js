const PH_TIME_ZONE = "Asia/Manila";
const DAY_MS = 24 * 60 * 60 * 1000;

const phDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PH_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function phDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = phDateFormatter.formatToParts(date);
  const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  if (!values.year || !values.month || !values.day) return null;
  return `${values.year}-${values.month}-${values.day}`;
}

function keyToOrdinal(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key || ""))) return null;
  const [year, month, day] = key.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function daysUntilCheckIn(checkIn, now = new Date()) {
  const checkInOrdinal = keyToOrdinal(phDateKey(checkIn));
  const todayOrdinal = keyToOrdinal(phDateKey(now));
  if (!Number.isFinite(checkInOrdinal) || !Number.isFinite(todayOrdinal)) return null;
  return checkInOrdinal - todayOrdinal;
}

function calculateCancellationRefund(booking, now = new Date()) {
  const total = Math.max(0, Number(booking?.totalAmount || 0));
  const dayDifference = daysUntilCheckIn(booking?.checkIn, now);
  const createdAt = new Date(booking?.createdAt || now);
  const minutesSinceBooking = Number.isNaN(createdAt.getTime())
    ? Infinity
    : Math.max(0, (now.getTime() - createdAt.getTime()) / 60000);

  if (dayDifference === null) {
    return {
      rule: "Unable to determine cancellation window",
      fee: total,
      refund: 0,
      refundable: false,
      type: "nonrefundable",
      daysUntilCheckIn: null,
      minutesSinceBooking
    };
  }

  if (dayDifference <= 0) {
    return {
      rule: "Cancellation on the check-in date is non-refundable",
      fee: total,
      refund: 0,
      refundable: false,
      type: "nonrefundable",
      daysUntilCheckIn: dayDifference,
      minutesSinceBooking
    };
  }

  if (dayDifference <= 2) {
    const refund = Math.round(total * 0.5);
    return {
      rule: "Cancellation 1–2 days before check-in — 50% refund",
      fee: Math.max(0, total - refund),
      refund,
      refundable: refund > 0,
      type: "percentage",
      daysUntilCheckIn: dayDifference,
      minutesSinceBooking
    };
  }

  if (minutesSinceBooking <= 30) {
    const fee = Math.min(500, total);
    return {
      rule: "Cancellation within 30 minutes after booking — ₱500 convenience fee",
      fee,
      refund: Math.max(0, total - fee),
      refundable: total - fee > 0,
      type: "fee",
      daysUntilCheckIn: dayDifference,
      minutesSinceBooking
    };
  }

  const fee = Math.min(1000, total);
  return {
    rule: minutesSinceBooking <= 24 * 60
      ? "Cancellation 30 minutes to 24 hours after booking — ₱1,000 convenience fee"
      : "Cancellation more than 24 hours after booking and more than 2 days before check-in — ₱1,000 convenience fee",
    fee,
    refund: Math.max(0, total - fee),
    refundable: total - fee > 0,
    type: "fee",
    daysUntilCheckIn: dayDifference,
    minutesSinceBooking
  };
}

module.exports = {
  PH_TIME_ZONE,
  phDateKey,
  daysUntilCheckIn,
  calculateCancellationRefund
};
