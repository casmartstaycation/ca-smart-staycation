const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const { requireAdmin } = require('../middleware/adminAuth');

// GET all rooms (public because booking/calendar pages need current availability and pricing)
router.get('/rooms', async (req, res) => {
    try {
        const rooms = await Room.find().sort({ unitNumber: 1 });
        res.json({ status: "success", data: rooms });
    } catch (err) {
        console.error("GET ROOMS ERROR:", err);
        res.status(500).json({ status: "error", message: err.message });
    }
});

// CREATE room — admin only
router.post('/rooms', requireAdmin, async (req, res) => {
    try {
        const room = new Room(req.body);
        await room.save();
        res.status(201).json({ status: "success", data: room });
    } catch (err) {
        console.error("ROOM CREATE ERROR:", err);
        res.status(400).json({ status: "error", message: err.message });
    }
});

// UPDATE room — admin only
router.put('/rooms/:id', requireAdmin, async (req, res) => {
    try {
        const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!room) return res.status(404).json({ status: "error", message: "Unit not found" });
        res.json({ status: "success", data: room });
    } catch (err) {
        res.status(400).json({ status: "error", message: err.message });
    }
});

// DELETE room — admin only
router.delete('/rooms/:id', requireAdmin, async (req, res) => {
    try {
        const room = await Room.findByIdAndDelete(req.params.id);
        if (!room) return res.status(404).json({ status: "error", message: "Unit not found" });
        res.json({ status: "success", message: "Unit deleted" });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

module.exports = router;
