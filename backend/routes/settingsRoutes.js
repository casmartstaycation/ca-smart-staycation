console.log("🔥 settingsRoutes.js executed");
const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../middleware/adminAuth");
router.get("/test", (req, res) => {
    res.json({ status: "success", message: "Settings router loaded" });
});

const Setting = require("../models/Setting");
const validEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

router.get("/", async (req, res) => {
    let settings = await Setting.findOne();
    if (!settings) settings = await Setting.create({});
    res.json({ status: "success", data: settings });
});

router.put("/", async (req, res) => {
    let settings = await Setting.findOne();
    if (!settings) settings = await Setting.create(req.body);
    else { Object.assign(settings, req.body); await settings.save(); }
    res.json({ status: "success", data: settings });
});

router.get("/admin-notification-email", requireAdmin, async (req, res) => {
    try {
        let settings = await Setting.findOne();
        if (!settings) settings = await Setting.create({});
        const fallback = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "markryantamayo@gmail.com";
        const primary = settings.adminNotificationEmail || fallback;
        const emails = Array.from(new Set([primary, ...(settings.adminNotificationEmails || [])].filter(validEmail)));
        res.json({ success: true, email: primary, emails });
    } catch (err) {
        console.error("ADMIN NOTIFICATION EMAIL GET ERROR:", err);
        res.status(500).json({ success: false, message: "Unable to load admin notification emails." });
    }
});

router.put("/admin-notification-email", requireAdmin, async (req, res) => {
    try {
        const email = String(req.body?.email || "").trim().toLowerCase();
        if (!validEmail(email)) return res.status(400).json({ success: false, message: "Please provide a valid email address." });
        let settings = await Setting.findOne();
        if (!settings) settings = await Setting.create({});
        settings.adminNotificationEmail = email;
        await settings.save();
        res.json({ success: true, email });
    } catch (err) {
        console.error("ADMIN NOTIFICATION EMAIL UPDATE ERROR:", err);
        res.status(500).json({ success: false, message: "Unable to save admin notification email." });
    }
});

router.put("/admin-notification-emails", requireAdmin, async (req, res) => {
    try {
        const input = Array.isArray(req.body?.emails) ? req.body.emails : [];
        const emails = Array.from(new Set(input.map(v => String(v || "").trim().toLowerCase()).filter(Boolean)));
        if (emails.length > 20) return res.status(400).json({ success: false, message: "You can add up to 20 admin notification emails." });
        const invalid = emails.find(email => !validEmail(email));
        if (invalid) return res.status(400).json({ success: false, message: `Invalid email address: ${invalid}` });
        let settings = await Setting.findOne();
        if (!settings) settings = await Setting.create({});
        const primary = settings.adminNotificationEmail || process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "markryantamayo@gmail.com";
        settings.adminNotificationEmails = Array.from(new Set([primary, ...emails].filter(validEmail)));
        await settings.save();
        res.json({ success: true, emails: settings.adminNotificationEmails });
    } catch (err) {
        console.error("ADMIN NOTIFICATION EMAILS UPDATE ERROR:", err);
        res.status(500).json({ success: false, message: "Unable to save admin notification emails." });
    }
});

router.delete("/admin-notification-emails", requireAdmin, async (req, res) => {
    try {
        const email = String(req.body?.email || "").trim().toLowerCase();
        let settings = await Setting.findOne();
        if (!settings) settings = await Setting.create({});
        settings.adminNotificationEmails = (settings.adminNotificationEmails || []).filter(v => v.toLowerCase() !== email);
        await settings.save();
        res.json({ success: true, emails: settings.adminNotificationEmails });
    } catch (err) {
        console.error("ADMIN NOTIFICATION EMAIL DELETE ERROR:", err);
        res.status(500).json({ success: false, message: "Unable to remove admin notification email." });
    }
});

module.exports = router;
