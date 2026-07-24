// GET all bookings
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
    console.error(err);

    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});
