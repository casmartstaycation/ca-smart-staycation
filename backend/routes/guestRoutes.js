const express = require('express');
const router = express.Router();
const Guest = require('../models/Guest');

// GET all guests
router.get('/guests', async (req, res) => {
  try {
    const guests = await Guest.find().sort({ createdAt: -1 });

    res.json({
      status: 'success',
      data: guests
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

// CREATE guest
router.post('/guests', async (req, res) => {
  try {
    const guest = new Guest(req.body);
    await guest.save();

    res.status(201).json({
      status: 'success',
      data: guest
    });
  } catch (err) {
    res.status(400).json({
      status: 'error',
      message: err.message
    });
  }
});

// GET one guest
router.get('/guests/:id', async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.id);

    if (!guest) {
      return res.status(404).json({
        status: 'error',
        message: 'Guest not found'
      });
    }

    res.json({
      status: 'success',
      data: guest
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

module.exports = router;
