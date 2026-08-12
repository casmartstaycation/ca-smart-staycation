const express = require('express');
const router = express.Router();
const Parking = require('../models/Parking');
const { requireAdmin } = require('../middleware/adminAuth');

// GET all parking slots (public because booking pages need availability and pricing)
router.get('/parking', async (req, res) => {
    try {
        const parkingSlots = await Parking.find().sort({ parkingNumber: 1 });
        res.json({ status: "success", data: parkingSlots });
    } catch (err) {
        console.error("GET PARKING SLOTS ERROR:", err);
        res.status(500).json({ status: "error", message: err.message });
    }
});

// CREATE parking slot — admin only
router.post('/parking', requireAdmin, async (req, res) => {
    try {
        const parkingSlot = new Parking(req.body);
        await parkingSlot.save();
        res.status(201).json({ status: "success", data: parkingSlot });
    } catch (err) {
        console.error("PARKING CREATE ERROR:", err);
        res.status(400).json({ status: "error", message: err.message });
    }
});

// UPDATE parking slot — admin only
router.put('/parking/:id', requireAdmin, async (req, res) => {
    try {
        const parkingSlot = await Parking.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!parkingSlot) return res.status(404).json({ status: "error", message: "Parking slot not found" });
        res.json({ status: "success", data: parkingSlot });
    } catch (err) {
        res.status(400).json({ status: "error", message: err.message });
    }
});

// DELETE parking slot — admin only
router.delete('/parking/:id', requireAdmin, async (req, res) => {
    try {
        const parkingSlot = await Parking.findByIdAndDelete(req.params.id);
        if (!parkingSlot) return res.status(404).json({ status: "error", message: "Parking slot not found" });
        res.json({ status: "success", message: "Parking slot deleted" });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

module.exports = router;