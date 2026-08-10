const ADMIN_EMAIL_API = "https://ca-smart-staycation-muqd.onrender.com/api";
const ADMIN_EMAIL_TOKEN_KEY = "caSmartAdminToken";
const DEFAULT_ADMIN_EMAIL = "markryantamayo@gmail.com";

function adminEmailAuthHeaders(json = false) {
  const headers = {};
  if (json) headers["Content-Type"] = "application/json";
  const token = sessionStorage.getItem(ADMIN_EMAIL_TOKEN_KEY) || "";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function ensureAdminEmailManager() {
  const section = document.querySelector(".admin-email-settings");
  if (!section) return false;
  let manager = document.getElementById("adminEmailManager");
  if (manager) return true;
  manager = document.createElement("div");
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
  manager.querySelector("#addAdminNotificationEmail").addEventListener("click", addAdminNotificationEmail);
  return true;
}

function renderAdminNotificationEmails(emails = [], primaryEmail = DEFAULT_ADMIN_EMAIL) {
  if (!ensureAdminEmailManager()) return;
  const list = document.getElementById("adminNotificationEmailList");
  if (!list) return;
  const primary = String(primaryEmail || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const unique = [...new Set((Array.isArray(emails) ? emails : []).map(v => String(v || "").trim().toLowerCase()).filter(Boolean))];
  const ordered = [primary, ...unique.filter(email => email !== primary)];
  list.innerHTML = "";
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

async function getAdminNotificationEmails() {
  const res = await fetch(`${ADMIN_EMAIL_API}/settings/admin-notification-email`, { headers: adminEmailAuthHeaders(), cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Unable to load notification emails.");
  return {
    primary: String(data.email || DEFAULT_ADMIN_EMAIL).trim().toLowerCase(),
    emails: Array.isArray(data.emails) ? data.emails : []
  };
}

async function loadAdminNotificationEmail() {
  try {
    ensureAdminEmailManager();
    const data = await getAdminNotificationEmails();
    renderAdminNotificationEmails(data.emails, data.primary);
  } catch (err) {
    console.error("ADMIN EMAIL LOAD ERROR:", err);
    // Keep the UI usable even if the settings API is temporarily unavailable.
    renderAdminNotificationEmails([], DEFAULT_ADMIN_EMAIL);
    const status = document.getElementById("adminNotificationEmailStatus");
    if (status) status.textContent = "Unable to load saved additional emails. Please try again.";
  }
}

async function addAdminNotificationEmail() {
  const input = document.getElementById("additionalAdminNotificationEmail");
  const status = document.getElementById("adminNotificationEmailStatus");
  const button = document.getElementById("addAdminNotificationEmail");
  if (!input) return;
  const email = input.value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (status) status.textContent = "Please enter a valid additional email address.";
    return;
  }
  button.disabled = true;
  try {
    const current = await getAdminNotificationEmails();
    const emails = Array.from(new Set([current.primary, ...current.emails, email].filter(Boolean)));
    const res = await fetch(`${ADMIN_EMAIL_API}/settings/admin-notification-emails`, {
      method: "PUT",
      headers: adminEmailAuthHeaders(true),
      body: JSON.stringify({ emails })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Unable to save additional email.");
    input.value = "";
    renderAdminNotificationEmails(result.emails || emails, current.primary);
    if (status) status.textContent = `Saved ${email}.`;
  } catch (err) {
    console.error("ADMIN EMAIL ADD ERROR:", err);
    if (status) status.textContent = err.message || "Unable to save additional email.";
  } finally {
    button.disabled = false;
  }
}

async function deleteAdminNotificationEmail(email) {
  const status = document.getElementById("adminNotificationEmailStatus");
  if (!confirm(`Delete ${email} from admin notification emails?`)) return;
  try {
    const current = await getAdminNotificationEmails();
    if (email === current.primary) {
      if (status) status.textContent = "The primary notification email cannot be deleted.";
      return;
    }
    const res = await fetch(`${ADMIN_EMAIL_API}/settings/admin-notification-emails`, {
      method: "DELETE",
      headers: adminEmailAuthHeaders(true),
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Unable to delete email.");
    renderAdminNotificationEmails(data.emails || [], current.primary);
    if (status) status.textContent = `Deleted ${email}.`;
  } catch (err) {
    console.error("ADMIN EMAIL DELETE ERROR:", err);
    if (status) status.textContent = err.message || "Unable to delete email.";
  }
}

function initAdminEmailSettings() {
  ensureAdminEmailManager();
  loadAdminNotificationEmail();
}

document.addEventListener("DOMContentLoaded", initAdminEmailSettings);

const adminEmailObserver = new MutationObserver(() => {
  const section = document.querySelector(".admin-email-settings");
  if (!section) return;
  if (!document.getElementById("adminEmailManager")) {
    ensureAdminEmailManager();
    loadAdminNotificationEmail();
  }
});

function startAdminEmailObserver() {
  if (document.body) adminEmailObserver.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startAdminEmailObserver);
else startAdminEmailObserver();