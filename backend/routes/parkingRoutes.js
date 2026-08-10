const express = require("express");
const router = express.Router();
const Parking = require("../models/Parking");
const { requireAdmin } = require("../middleware/adminAuth");

// GET all parking slots — public because booking pages need current options.
router.get("/parking", async (req, res) => {
    try {
        const parking = await Parking.find().sort({ parkingNumber: 1 });
        res.json({ status: "success", data: parking });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

// CREATE — admin only
router.post("/parking", requireAdmin, async (req, res) => {
    try {
        const parking = new Parking(req.body);
        await parking.save();
        res.status(201).json({ status: "success", data: parking });
    } catch (err) {
        res.status(400).json({ status: "error", message: err.message });
    }
});

// UPDATE — admin only
router.put("/parking/:id", requireAdmin, async (req, res) => {
    try {
        const parking = await Parking.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!parking) return res.status(404).json({ status: "error", message: "Parking slot not found" });
        res.json({ status: "success", data: parking });
    } catch (err) {
        res.status(400).json({ status: "error", message: err.message });
    }
});

// DELETE — admin only
router.delete("/parking/:id", requireAdmin, async (req, res) => {
    try {
        const parking = await Parking.findByIdAndDelete(req.params.id);
        if (!parking) return res.status(404).json({ status: "error", message: "Parking slot not found" });
        res.json({ status: "success" });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

module.exports = router;
