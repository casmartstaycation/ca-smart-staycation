const Setting = require("../models/Setting");

const CACHE_MS = 60 * 1000;
const FALLBACK_CONTACT = String(process.env.ADMIN_CONTACT_NUMBER || "").trim();
let cached = { contact: "", adminEmails: new Set(), expiresAt: 0 };

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function fallbackAdminEmails() {
  return new Set([
    normalizeEmail(process.env.ADMIN_EMAIL),
    normalizeEmail(process.env.EMAIL_USER)
  ].filter(Boolean));
}

async function getAdminContactContext() {
  if (cached.expiresAt > Date.now()) return cached;

  try {
    const settings = await Setting.findOne()
      .select("adminContactNumber adminNotificationEmail adminNotificationEmails")
      .lean();

    const contact = String(settings?.adminContactNumber || FALLBACK_CONTACT || "").trim();
    const adminEmails = new Set([
      ...fallbackAdminEmails(),
      normalizeEmail(settings?.adminNotificationEmail),
      ...(Array.isArray(settings?.adminNotificationEmails)
        ? settings.adminNotificationEmails.map(normalizeEmail)
        : [])
    ].filter(Boolean));

    cached = { contact, adminEmails, expiresAt: Date.now() + CACHE_MS };
    return cached;
  } catch (err) {
    console.error("ADMIN CONTACT CONTEXT LOOKUP ERROR:", err?.message || err);
    cached = {
      contact: FALLBACK_CONTACT,
      adminEmails: fallbackAdminEmails(),
      expiresAt: Date.now() + 10 * 1000
    };
    return cached;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function appendAdminContactToHtml(html, contact) {
  const source = String(html ?? "");
  const value = String(contact || "").trim();
  if (!value || source.includes(value) || /data-ca-admin-contact=["']1["']/i.test(source)) return source;

  const block = `<div data-ca-admin-contact="1" style="margin-top:20px;padding:14px 16px;border:1px solid #d7e1dc;border-left:4px solid #173f35;border-radius:7px;background:#f7faf8"><strong>Need help or have a request?</strong><br>Contact CA Smart Staycation Admin: <strong>${escapeHtml(value)}</strong></div>`;
  return /<\/body>/i.test(source)
    ? source.replace(/<\/body>/i, `${block}</body>`)
    : `${source}${block}`;
}

function appendAdminContactToText(message, contact) {
  const source = String(message ?? "").trim();
  const value = String(contact || "").trim();
  if (!value || source.includes(value) || /CA Smart Staycation Admin:/i.test(source)) return source;
  return `${source}${source ? "\n\n" : ""}CA Smart Staycation Admin: ${value}`;
}

module.exports = {
  getAdminContactContext,
  appendAdminContactToHtml,
  appendAdminContactToText
};
