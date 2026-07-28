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

// UPDATE room
router.put('/rooms/:id', async (req, res) => {

    try {

        const room = await Room.findByIdAndUpdate(

            req.params.id,

            req.body,

            { new: true }

        );

        if (!room) {

            return res.status(404).json({

                status: "error",

                message: "Unit not found"

            });

        }

        res.json({

            status: "success",

            data: room

        });

    } catch (err) {

        res.status(400).json({

            status: "error",

            message: err.message

        });

    }

});// DELETE room
router.delete('/rooms/:id', async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) {
      return res.status(404).json({
        status: "error",
        message: "Unit not found"
      });
    }
    res.json({
      status: "success",
      message: "Unit deleted"
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});



