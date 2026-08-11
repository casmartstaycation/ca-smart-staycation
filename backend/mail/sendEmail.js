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

let verificationPromise = null;
async function verifyEmailTransport() {
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

async function sendEmail(to, subject, html) {
    if (!to) throw new Error("Email recipient is missing.");
    await verifyEmailTransport();
    try {
        const result = await transporter.sendMail({
            from: `\"CA Smart Staycation\" <${emailUser}>`,
            to,
            subject,
            html
        });
        console.log(`EMAIL SENT: ${subject} -> ${to} (${result.messageId || "no-message-id"})`);
        return { sent: true, messageId: result.messageId };
    } catch (err) {
        console.error(`EMAIL SEND FAILED: ${subject} -> ${to}:`, err && err.message ? err.message : err);
        throw new Error(`Unable to send email: ${err && err.message ? err.message : "SMTP send failed"}`);
    }
}

module.exports = sendEmail;
