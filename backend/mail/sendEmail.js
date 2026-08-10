const nodemailer = require("nodemailer");

const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = Number(process.env.SMTP_PORT || 465);
const smtpSecure = String(process.env.SMTP_SECURE || (smtpPort === 465)).toLowerCase() === "true";
const emailUser = String(process.env.EMAIL_USER || "").trim();
const emailPass = String(process.env.EMAIL_PASS || "").trim();

const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: emailUser && emailPass ? { user: emailUser, pass: emailPass } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
});

let verificationStarted = false;
async function verifyEmailTransport() {
    if (verificationStarted) return;
    verificationStarted = true;
    if (!emailUser || !emailPass) {
        console.error("EMAIL CONFIG ERROR: EMAIL_USER and EMAIL_PASS are not configured. Booking emails cannot be sent.");
        return;
    }
    try {
        await transporter.verify();
        console.log(`EMAIL SMTP READY: ${smtpHost}:${smtpPort} as ${emailUser}`);
    } catch (err) {
        console.error("EMAIL SMTP VERIFY FAILED:", err && err.message ? err.message : err);
    }
}

async function sendEmail(to, subject, html) {
    if (!to) return { sent: false, reason: "missing-recipient" };
    if (!emailUser || !emailPass) {
        console.error(`EMAIL NOT SENT: missing EMAIL_USER/EMAIL_PASS (recipient=${to}, subject=${subject})`);
        return { sent: false, reason: "missing-credentials" };
    }

    await verifyEmailTransport();

    try {
        const result = await transporter.sendMail({
            from: `"CA Smart Staycation" <${emailUser}>`,
            to,
            subject,
            html
        });
        console.log(`EMAIL SENT: ${subject} -> ${to} (${result.messageId || "no-message-id"})`);
        return { sent: true, messageId: result.messageId };
    } catch (err) {
        console.error(`EMAIL SEND FAILED: ${subject} -> ${to}:`, err && err.message ? err.message : err);
        return { sent: false, reason: err && err.message ? err.message : "send-failed" };
    }
}

module.exports = sendEmail;
