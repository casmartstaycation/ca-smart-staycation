const GUEST_BOOKING_DOC_API = window.CA_SMART_API || "/api";
let appliedBookingVoucher = null;

function getVoucherCode() {
  return String(document.getElementById("voucherCode")?.value || "").trim().toUpperCase();
}

function voucherScope(voucher) {
  return String(voucher?.discountScope || "").toLowerCase() === "parking" ? "parking" : "booking";
}

function selectedParkingValue() {
  return String(document.getElementById("parking")?.value || "");
}

function bookingHasParking() {
  const type = document.getElementById("bookingType")?.value || "both";
  const parking = selectedParkingValue();
  return type === "parking" || (type === "both" && parking && parking !== "none");
}

function moneyNumber(id) {
  return Number((document.getElementById(id)?.innerText || "0").replace(/[^0-9.-]/g, "")) || 0;
}

async function validateBookingVoucher(code, showStatus = false) {
  if (!code) return null;
  const checkIn = document.getElementById("checkIn")?.value || "";
  const checkOut = document.getElementById("checkOut")?.value || "";
  const response = await fetch(`${GUEST_BOOKING_DOC_API}/vouchers/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ code, checkIn, checkOut, hasParking: bookingHasParking() })
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message || "Invalid voucher code.");
  if (showStatus) appliedBookingVoucher = json.data;
  return json.data;
}

function calculateVoucherAmounts(voucher = appliedBookingVoucher) {
  const room = moneyNumber("roomAmount");
  const extra = moneyNumber("extraGuestAmount");
  const parking = moneyNumber("parkingAmount");
  const deposit = moneyNumber("securityDepositAmount");
  const subtotal = room + extra + parking;
  const percent = Number(voucher?.discountPercent || 0);
  const eligibleAmount = voucherScope(voucher) === "parking" ? parking : subtotal;
  const discount = voucher ? Math.min(eligibleAmount, eligibleAmount * percent / 100) : 0;
  const total = subtotal - discount + deposit;
  return { room, extra, parking, deposit, subtotal, discount, total };
}

function voucherStatusText(voucher) {
  const pct = Number(voucher?.discountPercent || 0);
  if (voucherScope(voucher) === "parking") {
    return pct === 100
      ? `${voucher.code} applied — FREE PARKING.`
      : `${voucher.code} applied — ${pct}% parking discount.`;
  }
  return `${voucher.code} applied — ${pct}% booking discount${voucher.maxNights ? ` · Maximum ${voucher.maxNights} night${voucher.maxNights === 1 ? "" : "s"}` : ""}.`;
}

function renderVoucherSummary() {
  const row = document.getElementById("voucherDiscountRow");
  const label = document.getElementById("voucherDiscountLabel");
  const amount = document.getElementById("voucherDiscountAmount");
  const totalAmount = document.getElementById("totalAmount");
  if (!row || !label || !amount || !totalAmount) return;

  const amounts = calculateVoucherAmounts(appliedBookingVoucher);
  if (!appliedBookingVoucher || amounts.discount <= 0) {
    row.style.display = "none";
    return;
  }

  label.textContent = voucherScope(appliedBookingVoucher) === "parking" ? "Parking Voucher Discount" : "Voucher Discount";
  amount.textContent = `-₱${amounts.discount.toLocaleString("en-PH")}`;
  row.style.display = "flex";
  totalAmount.innerText = `₱${amounts.total.toLocaleString("en-PH")}`;
}

function installVoucherSummaryHook() {
  if (typeof window.updateSummary !== "function" || window.updateSummary.__parkingVoucherWrapped) return;
  const original = window.updateSummary;
  function wrapped(...args) {
    original(...args);
    if (appliedBookingVoucher) renderVoucherSummary();
  }
  wrapped.__parkingVoucherWrapped = true;
  window.updateSummary = wrapped;
}

function ensureVoucherUI() {
  const summary = document.getElementById("bookingSummary");
  if (!summary) return;

  if (!document.getElementById("voucherDiscountRow")) {
    const totalRow = document.getElementById("totalAmount")?.closest(".summary-row");
    const discountRow = document.createElement("div");
    discountRow.id = "voucherDiscountRow";
    discountRow.className = "summary-row";
    discountRow.style.display = "none";
    discountRow.innerHTML = '<span id="voucherDiscountLabel">Voucher Discount</span><strong id="voucherDiscountAmount">-₱0</strong>';
    if (totalRow?.parentNode) totalRow.parentNode.insertBefore(discountRow, totalRow);
    else summary.appendChild(discountRow);
  }

  if (document.getElementById("voucherCode")) return;
  const wrap = document.createElement("div");
  wrap.id = "voucherEntryBox";
  wrap.style.cssText = "margin-top:20px;padding-top:18px;border-top:1px solid #ddd";
  wrap.innerHTML = `<label for="voucherCode"><strong>Voucher Code</strong></label><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><input id="voucherCode" type="text" placeholder="Enter voucher code" style="flex:1;min-width:180px;padding:11px;border:1px solid #ccc;border-radius:6px;text-transform:uppercase"><button id="applyVoucher" type="button" style="padding:11px 18px;border:0;border-radius:6px;background:#0b5d4d;color:#fff;cursor:pointer">Apply Voucher</button></div><p id="voucherStatus" style="margin:8px 0 0;font-size:13px;color:#666"></p><small>Booking and parking vouchers are issued by CA Smart Staycation management.</small>`;
  summary.appendChild(wrap);

  document.getElementById("applyVoucher")?.addEventListener("click", async () => {
    const status = document.getElementById("voucherStatus");
    try {
      const code = getVoucherCode();
      if (!code) {
        appliedBookingVoucher = null;
        if (status) status.textContent = "Please enter a voucher code.";
        if (typeof calculateTotal === "function") calculateTotal();
        return;
      }
      if (status) status.textContent = "Checking voucher...";
      appliedBookingVoucher = await validateBookingVoucher(code, true);
      if (status) {
        status.textContent = voucherStatusText(appliedBookingVoucher);
        status.dataset.valid = appliedBookingVoucher.code;
      }
      renderVoucherSummary();
    } catch (err) {
      appliedBookingVoucher = null;
      if (status) {
        status.textContent = err.message || "Invalid voucher.";
        status.dataset.valid = "";
      }
      if (typeof calculateTotal === "function") calculateTotal();
    }
  });

  document.getElementById("voucherCode")?.addEventListener("input", () => {
    appliedBookingVoucher = null;
    const status = document.getElementById("voucherStatus");
    if (status) {
      status.textContent = "";
      status.dataset.valid = "";
    }
    if (typeof calculateTotal === "function") calculateTotal();
  });
}

async function redeemVoucherAfterBooking(voucher, checkIn, checkOut) {
  if (!voucher?.code) return;
  try {
    const response = await fetch(`${GUEST_BOOKING_DOC_API}/vouchers/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ code: voucher.code, checkIn, checkOut, hasParking: bookingHasParking() })
    });
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      console.warn("Voucher redemption tracking failed:", json.message || response.status);
    }
  } catch (err) {
    console.warn("Voucher redemption tracking failed:", err);
  }
}

async function submitGuestBookingWithDocuments(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  const form = event.currentTarget;
  const bookingType = document.getElementById("bookingType")?.value || "both";
  const room = document.getElementById("room")?.value || "";
  const parkingChoice = selectedParkingValue();
  const useParking = bookingType === "parking" || (bookingType === "both" && parkingChoice && parkingChoice !== "none");
  const checkIn = document.getElementById("checkIn")?.value || "";
  const checkOut = document.getElementById("checkOut")?.value || "";
  const adults = Math.max(0, Number(document.getElementById("guests")?.value || 0));
  const children = Math.max(0, Number(document.getElementById("children")?.value || 0));
  const firstName = document.getElementById("firstName")?.value.trim() || "";
  const lastName = document.getElementById("lastName")?.value.trim() || "";
  const email = document.getElementById("email")?.value.trim() || "";
  const mobile = document.getElementById("mobile")?.value.trim() || "";
  const address = document.getElementById("address")?.value.trim() || "";
  const governmentId = document.getElementById("governmentId")?.files?.[0];
  const driversLicense = document.getElementById("driversLicense")?.files?.[0];
  const vehicleBrand = document.getElementById("vehicleBrand")?.value.trim() || "";
  const vehicleModel = document.getElementById("vehicleModel")?.value.trim() || "";
  const vehicleColor = document.getElementById("vehicleColor")?.value.trim() || "";
  const plateNumber = document.getElementById("plateNumber")?.value.trim() || "";

  if (!checkIn || !checkOut || !firstName || !lastName || !email || !mobile || !address) return alert("Please complete all required fields.");
  if (bookingType !== "parking" && !room) return alert("Please select an accommodation.");
  if (adults === 0 && bookingType !== "parking") return alert("Number of guests must be at least 1.");
  if (bookingType !== "parking" && !governmentId) return alert("Please upload a clear government-issued ID.");
  if (bookingType === "both" && !parkingChoice) return alert("Please select a parking lot or choose No parking required.");
  if (bookingType === "parking" && (!parkingChoice || parkingChoice === "none")) return alert("Please select a parking lot.");
  if (useParking && !driversLicense) return alert("Please upload the driver's license required for parking.");
  if (useParking && (!vehicleBrand || !vehicleModel || !vehicleColor || !plateNumber)) return alert("Please complete all vehicle information.");

  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  for (const file of [governmentId, driversLicense].filter(Boolean)) {
    if (!allowed.includes(file.type)) return alert("Documents must be JPG, PNG, WEBP, or PDF.");
    if (file.size > 10 * 1024 * 1024) return alert("Each uploaded document must be smaller than 10 MB.");
  }

  const voucherCode = getVoucherCode();
  let voucher = null;
  if (voucherCode) {
    try {
      voucher = await validateBookingVoucher(voucherCode, true);
      appliedBookingVoucher = voucher;
      renderVoucherSummary();
    } catch (err) {
      alert(err.message || "Invalid voucher.");
      return;
    }
  }

  const amounts = calculateVoucherAmounts(voucher);
  const submitButton = form.querySelector("button[type=submit]");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Submitting…";
  }

  try {
    const parking = useParking ? parkingChoice : null;
    const bookingData = {
      firstName, lastName, email, mobile, address,
      room: bookingType === "parking" ? null : room,
      parking,
      parkingOnly: bookingType === "parking",
      checkIn, checkOut, adults, children,
      subtotalAmount: amounts.subtotal,
      voucherCode: voucher?.code || "",
      voucherDiscountPercent: voucher?.discountPercent || 0,
      voucherDiscountScope: voucherScope(voucher),
      voucherDiscountAmount: amounts.discount,
      voucherMaxNights: voucher?.maxNights || null,
      totalAmount: amounts.total,
      vehicleBrand: useParking ? vehicleBrand : "",
      vehicleModel: useParking ? vehicleModel : "",
      vehicleColor: useParking ? vehicleColor : "",
      plateNumber: useParking ? plateNumber : ""
    };

    const bookingResponse = await fetch(`${GUEST_BOOKING_DOC_API}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(bookingData)
    });
    const bookingJson = await bookingResponse.json();
    if (!bookingResponse.ok) throw new Error(bookingJson.message || "Booking failed.");

    const booking = bookingJson.data;
    const documents = new FormData();
    if (governmentId) documents.append("governmentId", governmentId);
    if (useParking && driversLicense) documents.append("driversLicense", driversLicense);
    documents.append("vehicleBrand", useParking ? vehicleBrand : "");
    documents.append("vehicleModel", useParking ? vehicleModel : "");
    documents.append("vehicleColor", useParking ? vehicleColor : "");
    documents.append("plateNumber", useParking ? plateNumber : "");

    const documentResponse = await fetch(`${GUEST_BOOKING_DOC_API}/bookings/${encodeURIComponent(booking._id)}/documents`, {
      method: "POST",
      body: documents
    });
    const documentJson = await documentResponse.json();
    if (!documentResponse.ok) throw new Error(documentJson.message || "Guest document upload failed.");

    await redeemVoucherAfterBooking(voucher, checkIn, checkOut);

    const savedBooking = {
      ...booking,
      ...documentJson.data,
      bookingType,
      voucherCode: voucher?.code || "",
      voucherDiscountPercent: voucher?.discountPercent || 0,
      voucherDiscountScope: voucherScope(voucher),
      voucherDiscountAmount: amounts.discount,
      subtotalAmount: amounts.subtotal,
      roomAmount: amounts.room,
      extraGuestAmount: amounts.extra,
      parkingAmount: amounts.parking,
      securityDepositAmount: amounts.deposit,
      totalAmount: amounts.total
    };
    localStorage.setItem("guestBooking", JSON.stringify(savedBooking));
    localStorage.setItem("bookingReference", booking.bookingReference || "");
    window.location.href = "guest-booking/booking-success.html";
  } catch (err) {
    console.error("GUEST BOOKING ERROR:", err);
    alert(err.message || "Unable to complete the booking. Please try again.");
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = "Submit Booking <span>→</span>";
    }
  }
}

installVoucherSummaryHook();
document.addEventListener("DOMContentLoaded", () => {
  ensureVoucherUI();
  const form = document.getElementById("guestBookingForm");
  if (form) form.addEventListener("submit", submitGuestBookingWithDocuments, true);

  document.addEventListener("change", event => {
    if (event.target?.id !== "parking" || !appliedBookingVoucher) return;
    if (voucherScope(appliedBookingVoucher) === "parking" && !bookingHasParking()) {
      appliedBookingVoucher = null;
      const status = document.getElementById("voucherStatus");
      if (status) status.textContent = "Parking voucher removed because no parking lot is selected.";
    }
    if (typeof calculateTotal === "function") calculateTotal();
  });
});
