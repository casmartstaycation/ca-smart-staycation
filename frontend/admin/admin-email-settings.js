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
  if (!section || document.getElementById("adminEmailManager")) return;
  const manager = document.createElement("div");
  manager.id = "adminEmailManager";
  manager.innerHTML = `
    <div style="margin-top:14px;border-top:1px solid #d7e1dc;padding-top:14px">
      <strong style="display:block;color:#173f35;margin-bottom:8px">Additional Notification Emails</strong>
      <div id="adminNotificationEmailList"></div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:10px">
        <input id="additionalAdminNotificationEmail" type="email" placeholder="Add another email address" autocomplete="email" style="flex:1;min-height:40px;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd7d1;border-radius:7px">
        <button type="button" id="addAdminNotificationEmail" style="min-height:40px;padding:0 16px">+ Add Email</button>
      </div>
    </div>`;
  section.appendChild(manager);
}

function renderAdminNotificationEmails(emails = []) {
  ensureAdminEmailManager();
  const list = document.getElementById("adminNotificationEmailList");
  if (!list) return;
  list.innerHTML = "";
  const unique = [...new Set(emails.map(v => String(v || "").trim().toLowerCase()).filter(Boolean))];
  if (!unique.length) {
    list.innerHTML = '<div style="font-size:12px;color:#66736e;padding:5px 0">No notification emails added.</div>';
    return;
  }
  unique.forEach((email, index) => {
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
      button.dataset.email = email;
      button.style.cssText = "min-height:34px;padding:0 12px;border:1px solid #d9b1ad;background:#fff;color:#a1261f;border-radius:6px;cursor:pointer";
      button.addEventListener("click", () => deleteAdminNotificationEmail(email));
      row.appendChild(button);
    }
    list.appendChild(row);
  });
}

async function loadAdminNotificationEmail() {
  ensureAdminEmailManager();
  const input = document.getElementById("adminNotificationEmail");
  const status = document.getElementById("adminNotificationEmailStatus");
  if (!input) return;
  try {
    const res = await fetch(`${ADMIN_EMAIL_API}/settings/admin-notification-email`, { headers: adminEmailAuthHeaders(), cache: "no-store" });
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
    const res = await fetch(`${ADMIN_EMAIL_API}/settings/admin-notification-email`, { method: "PUT", headers: adminEmailAuthHeaders(true), body: JSON.stringify({ email }) });
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
    const res = await fetch(`${ADMIN_EMAIL_API}/settings/admin-notification-emails`, { method: "PUT", headers: adminEmailAuthHeaders(true), body: JSON.stringify({ emails }) });
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
    const res = await fetch(`${ADMIN_EMAIL_API}/settings/admin-notification-emails`, { method: "DELETE", headers: adminEmailAuthHeaders(true), body: JSON.stringify({ email }) });
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
  ensureAdminEmailManager();
  document.getElementById("saveAdminNotificationEmail")?.addEventListener("click", saveAdminNotificationEmail);
  document.getElementById("addAdminNotificationEmail")?.addEventListener("click", addAdminNotificationEmail);
  loadAdminNotificationEmail();
});
