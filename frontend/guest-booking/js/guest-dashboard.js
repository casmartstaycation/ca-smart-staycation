const API = window.CA_SMART_API || '/api', TOKEN = localStorage.getItem("guestAuthToken");
const auth = () => ({ Authorization: `Bearer ${TOKEN}` });
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ '&': '&amp;','<': '&lt;','>': '&gt;','"': '&quot;',"'":'&#039;' }[c]));
const dateText = v => { if (!v) return "—"; const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }); };
let account = null, bookings = [];
if (!TOKEN) location.href = "guest-login.html";

document.querySelectorAll(".tab-button").forEach(btn => btn.addEventListener("click", () => openTab(btn.dataset.tab)));
function openTab(name) {
  document.querySelectorAll(".tab-button").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById(name + "Panel").classList.add("active");
  if (name !== "bookings") loadInbox();
}

async function loadAccount() {
  try {
    const r = await fetch(`${API}/guest-auth/me`, { headers: auth(), cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw Error(d.message || "Session expired.");
    account = d.account || {};
    bookings = d.bookings || [];
    renderBookings(bookings);
    document.getElementById("accountEmail").textContent = account.email || "—";
    document.getElementById("accountReference").textContent = account.bookingReference || "—";
    fillBookingSelect();
  } catch (e) {
    document.getElementById("bookingsList").innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

// The rest of the guest-dashboard logic (renderBookings, loadInbox, fillBookingSelect, send message, logout) is assumed to be provided by other scripts or present in the page.
// Call loadAccount on page load
window.addEventListener('DOMContentLoaded', loadAccount);
