const nodemailer = require("nodemailer");
const { getAdminContactContext, appendAdminContactToHtml } = require("../services/adminContact");

// Render Free blocks outbound SMTP connections. Use the HTTP email API when
// RESEND_API_KEY is configured; SMTP remains available as a local/paid-host
// fallback when the API key is not present.
const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
const resendFromEmail = String(
    process.env.RESEND_FROM_EMAIL || process.env.EMAIL_USER || ""
).trim();
const resendFromName = String(process.env.RESEND_FROM_NAME || "CA Smart Staycation").trim();

const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = Number(process.env.SMTP_PORT || 465);
const smtpSecure = String(process.env.SMTP_SECURE || (smtpPort === 465)).toLowerCase() === "true";
const emailUser = String(process.env.EMAIL_USER || "").trim();
const emailPass = String(process.env.EMAIL_PASS || "").trim();

const CANONICAL_PUBLIC_BASE = "https://casmartstaycation.com";
const LEGACY_GITHUB_PUBLIC_BASE_RE = /https:\/\/casmartstaycation\.github\.io\/cassbooking\b/gi;

const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: emailUser && emailPass ? { user: emailUser, pass: emailPass } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
});

let verificationPromise = null;

async function verifySmtpTransport() {
    if (!emailUser || !emailPass) {
        throw new Error("EMAIL_USER and EMAIL_PASS are not configured on the server.");
    }
    if (!verificationPromise) {
        verificationPromise = transporter.verify().then(() => {
            console.log(`EMAIL SMTP READY: ${smtpHost}:${smtpPort} as ${emailUser}`);
            return true;
        }).catch(err => {
            verificationPromise = null;
            console.error("EMAIL SMTP VERIFY FAILED:", err && err.message ? err.message : err);
            throw new Error(`Email service is not available: ${err && err.message ? err.message : "SMTP verification failed"}`);
        });
    }
    return verificationPromise;
}

async function sendViaResend(to, subject, html) {
    if (!resendApiKey) throw new Error("RESEND_API_KEY is not configured on the server.");
    if (!resendFromEmail) throw new Error("RESEND_FROM_EMAIL is not configured on the server.");

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
            from: `${resendFromName} <${resendFromEmail}>`,
            to: [to],
            subject,
            html
        })
    });

    let payload = null;
    try {
        payload = await response.json();
    } catch (_) {
        payload = null;
    }

    if (!response.ok) {
        const detail = payload?.message || payload?.error || `HTTP ${response.status}`;
        throw new Error(`Resend API request failed: ${detail}`);
    }

    const messageId = payload?.id || null;
    console.log(`EMAIL SENT VIA RESEND: ${subject} -> ${to} (${messageId || "no-message-id"})`);
    return { sent: true, messageId, provider: "resend" };
}

async function sendViaSmtp(to, subject, html) {
    await verifySmtpTransport();
    try {
        const result = await transporter.sendMail({
            from: `\"CA Smart Staycation\" <${emailUser}>`,
            to,
            subject,
            html
        });
        console.log(`EMAIL SENT VIA SMTP: ${subject} -> ${to} (${result.messageId || "no-message-id"})`);
        return { sent: true, messageId: result.messageId, provider: "smtp" };
    } catch (err) {
        console.error(`EMAIL SMTP SEND FAILED: ${subject} -> ${to}:`, err && err.message ? err.message : err);
        throw new Error(`Unable to send email: ${err && err.message ? err.message : "SMTP send failed"}`);
    }
}

function normalizePublicLinks(html) {
    return String(html ?? "").replace(LEGACY_GITHUB_PUBLIC_BASE_RE, CANONICAL_PUBLIC_BASE);
}

async function prepareEmailHtml(to, html) {
    const source = normalizePublicLinks(html);
    try {
        const { contact, adminEmails } = await getAdminContactContext();
        const recipient = String(to || "").trim().toLowerCase();
        if (!contact || adminEmails.has(recipient)) return source;
        return appendAdminContactToHtml(source, contact);
    } catch (err) {
        console.error("EMAIL ADMIN CONTACT FOOTER ERROR:", err && err.message ? err.message : err);
        return source;
    }
}

async function sendEmail(to, subject, html) {
    if (!to) throw new Error("Email recipient is missing.");

    const preparedHtml = await prepareEmailHtml(to, html);

    // Prefer the HTTP API. This avoids Render's outbound SMTP restrictions.
    if (resendApiKey) {
        return sendViaResend(to, subject, preparedHtml);
    }

    return sendViaSmtp(to, subject, preparedHtml);
}

module.exports = sendEmail;
