const express = require('express');
const router = express.Router();
const Room = require('../models/Room');

// GET all rooms
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await Room.find().sort({ roomNumber: 1 });

    res.json({
      status: 'success',
      data: rooms
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

// CREATE room
router.post('/rooms', async (req, res) => {
  try {
    const room = new Room(req.body);
    await room.save();

    res.status(201).json({
      status: 'success',
      data: room
    });
  } catch (err) {
    res.status(400).json({
      status: 'error',
      message: err.message
    });
  }
});

module.exports = router;

