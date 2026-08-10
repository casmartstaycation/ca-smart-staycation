const VOUCHER_API = "https://ca-smart-staycation-muqd.onrender.com/api";
let appliedVoucher = null;
let voucherReady = false;

function voucherMoney(value) { return "₱" + Number(value || 0).toLocaleString("en-PH"); }

async function validateGuestVoucher(showMessage = true) {
  const input = document.getElementById("voucherCode");
  const status = document.getElementById("voucherStatus");
  const code = String(input?.value || "").trim().toUpperCase();
  if (!code) { appliedVoucher = null; voucherReady = false; if (status) status.textContent = ""; calculateTotal(); return false; }
  try {
    if (status) status.textContent = "Checking voucher...";
    const res = await fetch(`${VOUCHER_API}/vouchers/validate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Invalid voucher.");
    appliedVoucher = json.data;
    voucherReady = true;
    if (status) status.textContent = `${appliedVoucher.code} applied — ${appliedVoucher.discountPercent}% discount.`;
    calculateTotal();
    return true;
  } catch (err) {
    appliedVoucher = null; voucherReady = false;
    if (status) status.textContent = err.message || "Invalid voucher.";
    calculateTotal();
    if (showMessage) alert(err.message || "Invalid voucher.");
    return false;
  }
}

function renderVoucherSummary(roomAmount, extraAmount, parkingAmount, depositAmount, originalTotal) {
  const box = document.getElementById("voucherSummary");
  const discountRow = document.getElementById("voucherDiscountRow");
  const discountAmount = document.getElementById("voucherDiscountAmount");
  if (!box || !discountRow || !discountAmount) return;
  const base = Number(roomAmount || 0) + Number(extraAmount || 0) + Number(parkingAmount || 0);
  const discount = appliedVoucher && voucherReady ? Math.min(base, base * Number(appliedVoucher.discountPercent || 0) / 100) : 0;
  const finalTotal = base - discount + Number(depositAmount || 0);
  discountRow.style.display = discount > 0 ? "flex" : "none";
  discountAmount.textContent = `-${voucherMoney(discount)}`;
  if (document.getElementById("totalAmount")) document.getElementById("totalAmount").innerText = voucherMoney(finalTotal);
  if (box) box.dataset.discount = String(discount);
  return { discount, finalTotal, subtotal: base };
}

function installVoucherSummaryHook() {
  if (typeof window.updateSummary !== "function" || window.updateSummary.__voucherWrapped) return;
  const original = window.updateSummary;
  function wrapped(roomAmount, extraAmount, parkingAmount, depositAmount, total) {
    original(roomAmount, extraAmount, parkingAmount, depositAmount, total);
    renderVoucherSummary(roomAmount, extraAmount, parkingAmount, depositAmount, total);
  }
  wrapped.__voucherWrapped = true;
  window.updateSummary = wrapped;
}

document.addEventListener("DOMContentLoaded", () => {
  installVoucherSummaryHook();
  const apply = document.getElementById("applyVoucher");
  if (apply) apply.addEventListener("click", () => validateGuestVoucher(true));
  const input = document.getElementById("voucherCode");
  if (input) input.addEventListener("input", () => { appliedVoucher = null; voucherReady = false; const s = document.getElementById("voucherStatus"); if (s) s.textContent = ""; calculateTotal(); });

  const form = document.getElementById("guestBookingForm");
  if (form) {
    let bypass = false;
    form.addEventListener("submit", async (event) => {
      if (bypass) { bypass = false; return; }
      const code = String(input?.value || "").trim().toUpperCase();
      if (!code || (appliedVoucher && voucherReady && appliedVoucher.code === code)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const valid = await validateGuestVoucher(true);
      if (valid) { bypass = true; form.requestSubmit(); }
    }, true);
  }
});

const originalGuestFetch = window.fetch.bind(window);
window.fetch = async function(input, init = {}) {
  try {
    const url = typeof input === "string" ? input : input.url;
    if (String(url).endsWith("/api/bookings") && String(init.method || "GET").toUpperCase() === "POST" && init.body && appliedVoucher && voucherReady) {
      const body = JSON.parse(init.body);
      const roomAmount = Number(document.getElementById("roomAmount")?.innerText.replace("₱", "").replace(/,/g, "") || 0);
      const extraAmount = Number(document.getElementById("extraGuestAmount")?.innerText.replace("₱", "").replace(/,/g, "") || 0);
      const parkingAmount = Number(document.getElementById("parkingAmount")?.innerText.replace("₱", "").replace(/,/g, "") || 0);
      const depositAmount = Number(document.getElementById("securityDepositAmount")?.innerText.replace("₱", "").replace(/,/g, "") || 0);
      const base = roomAmount + extraAmount + parkingAmount;
      const discount = Math.min(base, base * Number(appliedVoucher.discountPercent || 0) / 100);
      body.subtotalAmount = base;
      body.voucherCode = appliedVoucher.code;
      body.voucherDiscountPercent = Number(appliedVoucher.discountPercent || 0);
      body.voucherDiscountAmount = discount;
      body.totalAmount = base - discount + depositAmount;
      init = { ...init, body: JSON.stringify(body) };
    }
  } catch (err) { console.error("Voucher booking preparation error:", err); }
  return originalGuestFetch(input, init);
};
