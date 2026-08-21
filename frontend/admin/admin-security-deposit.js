/* Admin security-deposit refund controls. Loaded after booking-details.js and admin-refund.js. */
(function () {
  const API = "/api";
  const DAY_MS = 24 * 60 * 60 * 1000;

  const token = () =>
    sessionStorage.getItem("caSmartAdminToken") ||
    localStorage.getItem("caSmartAdminToken") ||
    sessionStorage.getItem("adminToken") ||
    sessionStorage.getItem("admin_token") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));

  const money = value => `₱${Number(value || 0).toLocaleString("en-PH")}`;
  const dateTime = value => {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-PH", {
      year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
    });
  };

  function authHeaders(json = false) {
    const headers = {};
    if (json) headers["Content-Type"] = "application/json";
    if (token()) headers.Authorization = `Bearer ${token()}`;
    return headers;
  }

  async function getStatus(id) {
    const response = await fetch(`${API}/admin/bookings/${encodeURIComponent(id)}/security-deposit-status`, {
      headers: authHeaders(),
      cache: "no-store"
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.success) throw new Error(json.message || "Unable to load security deposit status.");
    return json.data || {};
  }

  function remainingText(availableAt) {
    const ms = Math.max(0, new Date(availableAt).getTime() - Date.now());
    if (!Number.isFinite(ms) || ms <= 0) return "Available now";
    const totalMinutes = Math.ceil(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`;
  }

  function tablePlaceholder(id) {
    return `<button type="button" class="security-deposit-action" data-security-deposit-id="${esc(id)}" disabled style="background:#e7e2d7;color:#665d4f;border:0;border-radius:6px;padding:7px 9px;font-weight:700;cursor:not-allowed">Deposit Refund<br><small>Checking eligibility…</small></button>`;
  }

  function renderButton(button, status) {
    if (!button || !status) return;
    const amount = Number(status.securityDepositAmount || 0);
    button.dataset.securityDepositAmount = String(amount);

    if (status.securityDepositStatus === "Refunded") {
      const badge = document.createElement("span");
      badge.className = "security-deposit-refunded";
      badge.style.cssText = "display:inline-block;padding:6px 8px;border-radius:6px;background:#e9f3ee;color:#0b5d4d;font-size:12px;font-weight:700";
      badge.textContent = `Deposit Refunded${amount ? ` · ${money(amount)}` : ""}`;
      button.replaceWith(badge);
      return;
    }

    if (status.parkingOnly || status.bookingStatus !== "Checked Out") {
      button.remove();
      return;
    }

    const availableAt = status.securityDepositRefundAvailableAt || (
      status.checkedOutAt ? new Date(new Date(status.checkedOutAt).getTime() + DAY_MS).toISOString() : ""
    );
    button.dataset.securityDepositAvailableAt = availableAt || "";

    if (status.available || (availableAt && Date.now() >= new Date(availableAt).getTime())) {
      button.disabled = false;
      button.style.cssText = "background:#b08a3c;color:#fff;border:0;border-radius:6px;padding:7px 9px;font-weight:700;cursor:pointer";
      button.innerHTML = `Refund Deposit<br><small>${money(amount)}</small>`;
      button.title = "Available after the 24-hour post-checkout inspection period.";
      button.onclick = () => processSecurityDepositRefund(status.bookingId || button.dataset.securityDepositId, button);
      return;
    }

    button.disabled = true;
    button.style.cssText = "background:#e7e2d7;color:#665d4f;border:0;border-radius:6px;padding:7px 9px;font-weight:700;cursor:not-allowed";
    button.innerHTML = `Deposit Refund Locked<br><small>${availableAt ? remainingText(availableAt) : "24-hour inspection period"}</small>`;
    button.title = availableAt ? `Refund available ${dateTime(availableAt)}` : "Refund unlocks 24 hours after checkout.";
  }

  async function hydrateButton(button) {
    if (!button || button.dataset.securityDepositLoading === "1") return;
    const id = button.dataset.securityDepositId;
    if (!id) return;
    button.dataset.securityDepositLoading = "1";
    try {
      const status = await getStatus(id);
      renderButton(button, status);
    } catch (err) {
      button.disabled = true;
      button.innerHTML = "Deposit Refund<br><small>Status unavailable</small>";
      button.title = err.message || "Unable to check refund eligibility.";
    } finally {
      if (button.isConnected) button.dataset.securityDepositLoading = "0";
    }
  }

  function hydrateAll(root = document) {
    root.querySelectorAll?.("button[data-security-deposit-id]").forEach(hydrateButton);
  }

  async function processSecurityDepositRefund(id, button) {
    let status;
    try {
      status = await getStatus(id);
    } catch (err) {
      alert(err.message || "Unable to check security deposit status.");
      return;
    }

    if (!status.available) {
      alert(status.securityDepositRefundAvailableAt
        ? `Security deposit refund is still locked.\n\nAvailable: ${dateTime(status.securityDepositRefundAvailableAt)}`
        : "Security deposit refund is not available yet.");
      renderButton(button, status);
      return;
    }

    const amount = Number(status.securityDepositAmount || 0);
    const ok = confirm(
      `Confirm security deposit refund for ${status.bookingReference || "this booking"}?\n\n` +
      `Refund amount: ${money(amount)}\n\n` +
      `Only continue after the unit inspection is complete, no chargeable damages were found, and you have actually sent the refund to the guest.`
    );
    if (!ok) return;

    button.disabled = true;
    button.textContent = "Recording refund…";

    try {
      const response = await fetch(`${API}/admin/bookings/${encodeURIComponent(id)}/security-deposit-refund`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({})
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.success) throw new Error(json.message || "Unable to process security deposit refund.");

      alert(json.message || "Security deposit refund recorded.");
      if (typeof window.loadBookings === "function") await window.loadBookings(true);

      const modal = document.getElementById("bookingModal");
      if (modal && !modal.hidden && typeof window.viewBooking === "function") {
        await window.viewBooking(id);
      } else {
        hydrateAll(document);
      }
    } catch (err) {
      alert(err.message || "Unable to process security deposit refund.");
      try {
        const latest = await getStatus(id);
        renderButton(button, latest);
      } catch (_) {
        button.disabled = false;
        button.textContent = "Refund Deposit";
      }
    }
  }

  window.processSecurityDepositRefund = processSecurityDepositRefund;

  function installTableAction() {
    if (typeof window.actionButtons !== "function" || window.actionButtons.__securityDepositWrapped) return;
    const original = window.actionButtons;
    const wrapped = function (booking) {
      let html = original(booking);
      if (booking && booking.bookingStatus === "Checked Out" && !booking.parkingOnly) {
        html += tablePlaceholder(booking._id || booking.bookingReference);
      }
      return html;
    };
    wrapped.__securityDepositWrapped = true;
    window.actionButtons = wrapped;

    if (typeof window.renderBookings === "function") {
      const originalRender = window.renderBookings;
      if (!originalRender.__securityDepositWrapped) {
        const wrappedRender = function () {
          const result = originalRender.apply(this, arguments);
          queueMicrotask(() => hydrateAll(document.getElementById("bookingTable") || document));
          return result;
        };
        wrappedRender.__securityDepositWrapped = true;
        window.renderBookings = wrappedRender;
      }
    }
  }

  function depositDetailsHtml(status) {
    if (!status || status.parkingOnly || (status.bookingStatus !== "Checked Out" && status.securityDepositStatus !== "Refunded")) return "";
    const availableLabel = status.securityDepositStatus === "Refunded"
      ? `Refunded ${dateTime(status.securityDepositRefundedAt)}`
      : (status.available ? "Refund available now" : `Locked until ${dateTime(status.securityDepositRefundAvailableAt)}`);
    return `<div class="notes" data-security-deposit-details="1"><span>Security Deposit</span><p>` +
      `Amount: <strong>${money(status.securityDepositAmount)}</strong><br>` +
      `Status: <strong>${esc(status.securityDepositStatus || "Held")}</strong><br>` +
      `Checked out: ${dateTime(status.checkedOutAt)}<br>` +
      `Refund eligibility: ${esc(availableLabel)}` +
      `${status.securityDepositRefundedBy ? `<br>Processed by: ${esc(status.securityDepositRefundedBy)}` : ""}` +
      `</p></div>`;
  }

  async function enhanceModal(id) {
    try {
      const status = await getStatus(id);
      if (status.parkingOnly || (status.bookingStatus !== "Checked Out" && status.securityDepositStatus !== "Refunded")) return;

      const details = document.getElementById("bookingDetails");
      if (details) {
        details.querySelector("[data-security-deposit-details]")?.remove();
        details.insertAdjacentHTML("beforeend", depositDetailsHtml(status));
      }

      const actions = document.getElementById("modalActions");
      if (actions) {
        actions.querySelector("[data-security-deposit-modal]")?.remove();
        actions.querySelector(".security-deposit-refunded-modal")?.remove();

        if (status.securityDepositStatus === "Refunded") {
          const badge = document.createElement("span");
          badge.className = "security-deposit-refunded-modal";
          badge.style.cssText = "display:inline-flex;align-items:center;padding:8px 11px;border-radius:7px;background:#e9f3ee;color:#0b5d4d;font-weight:700";
          badge.textContent = `Security Deposit Refunded · ${money(status.securityDepositAmount)}`;
          actions.appendChild(badge);
        } else {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.securityDepositModal = "1";
          button.dataset.securityDepositId = String(status.bookingId || id);
          button.className = "security-deposit-action";
          actions.appendChild(button);
          renderButton(button, status);
        }
      }
    } catch (err) {
      console.warn("SECURITY DEPOSIT MODAL ERROR:", err.message);
    }
  }

  function installModalEnhancer() {
    if (typeof window.viewBooking !== "function" || window.viewBooking.__securityDepositWrapped) return;
    const original = window.viewBooking;
    const wrapped = async function (id) {
      const result = await original.apply(this, arguments);
      await enhanceModal(id);
      return result;
    };
    wrapped.__securityDepositWrapped = true;
    window.viewBooking = wrapped;
  }

  function refreshCountdowns() {
    document.querySelectorAll("button[data-security-deposit-available-at]").forEach(button => {
      const availableAt = button.dataset.securityDepositAvailableAt;
      if (!availableAt || !button.isConnected) return;
      const timestamp = new Date(availableAt).getTime();
      if (!Number.isFinite(timestamp)) return;
      if (Date.now() >= timestamp) {
        hydrateButton(button);
      } else if (button.disabled) {
        button.innerHTML = `Deposit Refund Locked<br><small>${remainingText(availableAt)}</small>`;
      }
    });
  }

  function boot() {
    installTableAction();
    installModalEnhancer();
    // Re-render once after installing the wrapper so bookings that loaded
    // before this dynamically loaded script still receive deposit controls.
    if (typeof window.renderBookings === "function") window.renderBookings();
    hydrateAll(document);
    setInterval(refreshCountdowns, 60000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
