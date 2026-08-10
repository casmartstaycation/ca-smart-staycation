const ADMIN_EMAIL_API = "https://ca-smart-staycation-muqd.onrender.com/api";
const ADMIN_EMAIL_TOKEN_KEY = "caSmartAdminToken";

function adminEmailAuthHeaders(json = false) {
  const headers = {};
  if (json) headers["Content-Type"] = "application/json";
  const token = sessionStorage.getItem(ADMIN_EMAIL_TOKEN_KEY) || "";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function loadAdminNotificationEmail() {
  const input = document.getElementById("adminNotificationEmail");
  const status = document.getElementById("adminNotificationEmailStatus");
  if (!input) return;
  try {
    const res = await fetch(`${ADMIN_EMAIL_API}/settings/admin-notification-email`, {
      headers: adminEmailAuthHeaders(),
      cache: "no-store"
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Unable to load notification email.");
    input.value = data.email || "";
    if (status) status.textContent = data.email ? `Notifications will be sent to ${data.email}.` : "No custom admin notification email is set.";
  } catch (err) {
    console.error("ADMIN EMAIL LOAD ERROR:", err);
    if (status) status.textContent = err.message;
  }
}

async function saveAdminNotificationEmail() {
  const input = document.getElementById("adminNotificationEmail");
  const status = document.getElementById("adminNotificationEmailStatus");
  const button = document.getElementById("saveAdminNotificationEmail");
  if (!input) return;
  const email = input.value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (status) status.textContent = "Please enter a valid email address.";
    return;
  }
  button.disabled = true;
  if (status) status.textContent = "Saving…";
  try {
    const res = await fetch(`${ADMIN_EMAIL_API}/settings/admin-notification-email`, {
      method: "PUT",
      headers: adminEmailAuthHeaders(true),
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Unable to save notification email.");
    if (status) status.textContent = `Saved. Admin notifications will be sent to ${data.email}.`;
  } catch (err) {
    console.error("ADMIN EMAIL SAVE ERROR:", err);
    if (status) status.textContent = err.message;
  } finally {
    button.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("saveAdminNotificationEmail")?.addEventListener("click", saveAdminNotificationEmail);
  loadAdminNotificationEmail();
});
