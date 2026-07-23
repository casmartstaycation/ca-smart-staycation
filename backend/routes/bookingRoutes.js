const express = require('express');
const router = express.Router();

router.get('/test', (req, res) => {
  console.log("TEST ROUTE HIT");
  res.json({
    status: "success",
    message: "Booking routes are working"
  });
});

const Booking = require('../models/Booking');
console.log("✅ bookingRoutes loaded");

// GET all bookings
  console.log("GET /bookings called");

  try {
    console.log("Before Booking.find()");

    
console.log("After Booking.find()", bookings.length);

res.json({
  status: "success",
  data: bookings
console.log("Before Booking.find()");

const bookings = await Booking.find().sort({ createdAt: -1 });

console.log("After Booking.find()");
console.log(bookings);

return res.json({
  status: "success",
  count: bookings.length,
  data: bookings
});

  console.log("GET /bookings called");

  try {
    console.log("Before Booking.find()");

    const bookings = await Booking.find().sort({ createdAt: -1 });

    console.log("After Booking.find()", bookings.length);

    res.json({
      status: "success",
      data: bookings
    });  console.log("GET /bookings called");

  try {
    console.log("Before Booking.find()");

    const bookings = await Booking.find().sort({ createdAt: -1 });

    console.log("After Booking.find()");
    console.log(bookings);

    return res.json({
      status: "success",
      count: bookings.length,
      data: bookings
    });

  } catch (err) {
    console.error("Booking route error:", err);

    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
router.get('/bookings', async (req, res) => {
  console.log("GET /bookings called");

  try {
    console.log("Before Booking.find()");

    const bookings = await Booking.find().sort({ createdAt: -1 });

    console.log("After Booking.find()");
    console.log(bookings);

    return res.json({
      status: "success",
      count: bookings.length,
      data: bookings
    });

  } catch (err) {
    console.error("Booking route error:", err);

    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});
// CREATE booking
router.post('/bookings', async (req, res) => {
  try {
    const booking = new Booking(req.body);
    await booking.save();

    res.status(201).json({
      status: 'success',
      data: booking
    });
  } catch (err) {
    res.status(400).json({
      status: 'error',
      message: err.message
    });
  }
});

// UPDATE booking
router.put('/bookings/:id', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    res.json({
      status: 'success',
      data: booking
    });
  } catch (err) {
    res.status(400).json({
      status: 'error',
      message: err.message
    });
  }
});

// DELETE booking
router.delete('/bookings/:id', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);

    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Booking deleted successfully'
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

module.exports = router;
