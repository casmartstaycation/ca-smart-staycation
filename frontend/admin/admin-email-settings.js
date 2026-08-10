const ADMIN_EMAIL_API = "https://ca-smart-staycation-muqd.onrender.com/api";
const ADMIN_EMAIL_TOKEN_KEY = "caSmartAdminToken";

function adminEmailAuthHeaders(json = false) {
  const headers = {};
  if (json) headers["Content-Type"] = "application/json";
  const token = sessionStorage.getItem(ADMIN_EMAIL_TOKEN_KEY) || "";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function renderAdminNotificationEmails(emails = []) {
  const list = document.getElementById("adminNotificationEmailList");
  if (!list) return;
  list.innerHTML = "";
  const unique = [...new Set(emails.map(v => String(v || "").trim().toLowerCase()).filter(Boolean))];
  if (!unique.length) {
    list.innerHTML = '<div class="admin-email-empty">No notification email added.</div>';
    return;
  }
  unique.forEach((email, index) => {
    const row = document.createElement("div");
    row.className = "admin-email-item";
    row.innerHTML = `<span>${email}</span><button type="button" class="admin-email-delete" data-email="${email}" ${index === 0 ? "disabled title=\"Primary email cannot be deleted here\"" : ""}>Delete</button>`;
    list.appendChild(row);
  });
  list.querySelectorAll(".admin-email-delete:not(:disabled)").forEach(button => {
    button.addEventListener("click", () => deleteAdminNotificationEmail(button.dataset.email));
  });
}

async function loadAdminNotificationEmail() {
  const input = document.getElementById("adminNotificationEmail");
  const status = document.getElementById("adminNotificationEmailStatus");
  if (!input) return;
  try {
    const res = await fetch(`${ADMIN_EMAIL_API}/settings/admin-notification-email`, {
      headers: adminEmailAuthHeaders(), cache: "no-store"
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Unable to load notification emails.");
    input.value = data.email || "";
    const emails = Array.isArray(data.emails) && data.emails.length ? data.emails : (data.email ? [data.email] : []);
    renderAdminNotificationEmails(emails);
    if (status) status.textContent = data.email ? `Primary notification email: ${data.email}` : "No custom admin notification email is set.";
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
      method: "PUT", headers: adminEmailAuthHeaders(true), body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Unable to save notification email.");
    if (status) status.textContent = `Saved. Primary admin notification email: ${data.email}.`;
    await loadAdminNotificationEmail();
  } catch (err) {
    console.error("ADMIN EMAIL SAVE ERROR:", err);
    if (status) status.textContent = err.message;
  } finally { button.disabled = false; }
}

async function addAdminNotificationEmail() {
  const input = document.getElementById("additionalAdminNotificationEmail");
  const status = document.getElementById("adminNotificationEmailStatus");
  if (!input) return;
  const email = input.value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (status) status.textContent = "Please enter a valid additional email address.";
    return;
  }
  try {
    const current = await fetch(`${ADMIN_EMAIL_API}/settings/admin-notification-email`, { headers: adminEmailAuthHeaders(), cache: "no-store" });
    const data = await current.json();
    if (!current.ok) throw new Error(data.message || "Unable to load current emails.");
    const emails = Array.from(new Set([...(data.emails || []), email]));
    const res = await fetch(`${ADMIN_EMAIL_API}/settings/admin-notification-emails`, {
      method: "PUT", headers: adminEmailAuthHeaders(true), body: JSON.stringify({ emails })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Unable to add email.");
    input.value = "";
    renderAdminNotificationEmails(result.emails || emails);
    if (status) status.textContent = `Added ${email} to admin notifications.`;
  } catch (err) {
    console.error("ADMIN EMAIL ADD ERROR:", err);
    if (status) status.textContent = err.message;
  }
}

async function deleteAdminNotificationEmail(email) {
  const status = document.getElementById("adminNotificationEmailStatus");
  if (!confirm(`Delete ${email} from admin notification emails?`)) return;
  try {
    const res = await fetch(`${ADMIN_EMAIL_API}/settings/admin-notification-emails`, {
      method: "DELETE", headers: adminEmailAuthHeaders(true), body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Unable to delete email.");
    renderAdminNotificationEmails(data.emails || []);
    if (status) status.textContent = `Deleted ${email} from admin notifications.`;
  } catch (err) {
    console.error("ADMIN EMAIL DELETE ERROR:", err);
    if (status) status.textContent = err.message;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("saveAdminNotificationEmail")?.addEventListener("click", saveAdminNotificationEmail);
  document.getElementById("addAdminNotificationEmail")?.addEventListener("click", addAdminNotificationEmail);
  loadAdminNotificationEmail();
});
