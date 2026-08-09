const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
});

async function sendEmail(to, subject, html) {
    if (!to) return;

    await transporter.sendMail({
        from: `"CA Smart Staycation" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html
    });
}

module.exports = sendEmail;
