const ADMIN_EMAIL_API = "https://ca-smart-staycation-muqd.onrender.com/api";
const ADMIN_EMAIL_TOKEN_KEY = "caSmartAdminToken";

function adminEmailAuthHeaders(json = false) {
  const headers = {};
  if (json) headers["Content-Type"] = "application/json";
  const token = sessionStorage.getItem(ADMIN_EMAIL_TOKEN_KEY) || "";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function ensureAdminEmailManager() {
  const section = document.querySelector(".admin-email-settings");
  if (!section || document.getElementById("adminEmailManager")) return false;
  const manager = document.createElement("div");
  manager.id = "adminEmailManager";
  manager.innerHTML = `
    <div style="margin-top:0">
      <strong style="display:block;color:#173f35;margin-bottom:8px">Admin Notification Emails</strong>
      <div id="adminNotificationEmailList"></div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:10px">
        <input id="additionalAdminNotificationEmail" type="email" placeholder="Add another email address" autocomplete="email" style="flex:1;min-height:40px;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd7d1;border-radius:7px">
        <button type="button" id="addAdminNotificationEmail" style="min-height:40px;padding:0 16px">+ Add Email</button>
      </div>
    </div>`;
  section.appendChild(manager);
  document.getElementById("addAdminNotificationEmail")?.addEventListener("click", addAdminNotificationEmail);
  return true;
}

function renderAdminNotificationEmails(emails = [], primaryEmail = "") {
  ensureAdminEmailManager();
  const list = document.getElementById("adminNotificationEmailList");
  if (!list) return;
  list.innerHTML = "";
  const primary = String(primaryEmail || "").trim().toLowerCase();
  const unique = [...new Set(emails.map(v => String(v || "").trim().toLowerCase()).filter(Boolean))];
  const ordered = primary ? [primary, ...unique.filter(email => email !== primary)] : unique;
  if (!ordered.length) {
    list.innerHTML = '<div style="font-size:12px;color:#66736e;padding:5px 0">No notification emails added.</div>';
    return;
  }
  ordered.forEach((email, index) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;margin:6px 0;background:#fff;border:1px solid #d7e1dc;border-radius:7px";
    const label = document.createElement("span");
    label.textContent = index === 0 ? `${email} (Primary)` : email;
    label.style.cssText = "font-size:13px;color:#173f35;word-break:break-all";
    row.appendChild(label);
    if (index > 0) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Delete";
      button.style.cssText = "min-height:34px;padding:0 12px;border:1px solid #d9b1ad;background:#fff;color:#a1261f;border-radius:6px;cursor:pointer";
      button.addEventListener("click", () => deleteAdminNotificationEmail(email));
      row.appendChild(button);
    }
    list.appendChild(row);
  });
}

async function loadAdminNotificationEmail() {
  const status = document.getElementById("adminNotificationEmailStatus");
  try {
    ensureAdminEmailManager();
    const res = await fetch(`${ADMIN_EMAIL_API}/settings/admin-notification-email`, { headers: adminEmailAuthHeaders(), cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Unable to load notification emails.");
    const primary = String(data.email || "").trim().toLowerCase();
    const emails = Array.isArray(data.emails) ? data.emails : [];
    renderAdminNotificationEmails(emails.length ? emails : (primary ? [primary] : []), primary);
    if (status) status.textContent = "";
  } catch (err) {
    console.error("ADMIN EMAIL LOAD ERROR:", err);
    if (status) status.textContent = err.message;
  }
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
    const primary = String(data.email || "").trim().toLowerCase();
    const emails = Array.from(new Set([primary, ...(data.emails || []), email].filter(Boolean)));
    const res = await fetch(`${ADMIN_EMAIL_API}/settings/admin-notification-emails`, { method: "PUT", headers: adminEmailAuthHeaders(true), body: JSON.stringify({ emails }) });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Unable to add email.");
    input.value = "";
    renderAdminNotificationEmails(result.emails || emails, primary);
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
    const res = await fetch(`${ADMIN_EMAIL_API}/settings/admin-notification-emails`, { method: "DELETE", headers: adminEmailAuthHeaders(true), body: JSON.stringify({ email }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Unable to delete email.");
    const primary = document.getElementById("adminNotificationEmailList")?.querySelector("span")?.textContent?.replace(/ \(Primary\)$/, "") || "";
    renderAdminNotificationEmails(data.emails || [], primary);
    if (status) status.textContent = `Deleted ${email} from admin notifications.`;
  } catch (err) {
    console.error("ADMIN EMAIL DELETE ERROR:", err);
    if (status) status.textContent = err.message;
  }
}

function initAdminEmailSettings() {
  ensureAdminEmailManager();
  loadAdminNotificationEmail();
}

document.addEventListener("DOMContentLoaded", initAdminEmailSettings);

// Admin settings content can be rendered dynamically after the initial page load.
// Keep the email list synchronized whenever that section is inserted or replaced.
const adminEmailObserver = new MutationObserver(() => {
  const section = document.querySelector(".admin-email-settings");
  if (!section) return;
  const managerCreated = ensureAdminEmailManager();
  if (managerCreated || !document.getElementById("adminNotificationEmailList")?.children.length) {
    loadAdminNotificationEmail();
  }
});

function startAdminEmailObserver() {
  if (document.body) adminEmailObserver.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startAdminEmailObserver);
else startAdminEmailObserver();
