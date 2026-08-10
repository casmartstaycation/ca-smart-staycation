console.log("🔥 settingsRoutes.js executed");
const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../middleware/adminAuth");
router.get("/test", (req, res) => {
    res.json({
        status: "success",
        message: "Settings router loaded"
    });
});

const Setting = require("../models/Setting");

// GET SETTINGS
router.get("/", async (req, res) => {

    let settings = await Setting.findOne();

    if (!settings) {
        settings = await Setting.create({});
    }

    res.json({
        status: "success",
        data: settings
    });

});

// UPDATE SETTINGS
router.put("/", async (req, res) => {

    let settings = await Setting.findOne();

    if (!settings) {
        settings = await Setting.create(req.body);
    } else {
        Object.assign(settings, req.body);
        await settings.save();
    }

    res.json({
        status: "success",
        data: settings
    });

});

// ADMIN NOTIFICATION EMAIL
router.get("/admin-notification-email", requireAdmin, async (req, res) => {
    try {
        let settings = await Setting.findOne();
        if (!settings) settings = await Setting.create({});
        const fallback = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "markryantamayo@gmail.com";
        res.json({ success: true, email: settings.adminNotificationEmail || fallback });
    } catch (err) {
        console.error("ADMIN NOTIFICATION EMAIL GET ERROR:", err);
        res.status(500).json({ success: false, message: "Unable to load admin notification email." });
    }
});

router.put("/admin-notification-email", requireAdmin, async (req, res) => {
    try {
        const email = String(req.body?.email || "").trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ success: false, message: "Please provide a valid email address." });
        }
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

module.exports = router;