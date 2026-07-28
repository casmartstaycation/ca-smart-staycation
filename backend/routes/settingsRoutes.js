console.log("🔥 settingsRoutes.js executed");
const express = require("express");
const router = express.Router();
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

module.exports = router;