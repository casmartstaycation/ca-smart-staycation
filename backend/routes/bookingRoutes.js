const express = require("express");
const router = express.Router();

const Booking = require("../models/Booking");
const Room = require("../models/Room");
const Parking = require("../models/Parking");

// =====================================
// TEST
// =====================================

router.get("/test", (req, res) => {

    res.json({

        status: "success",
        message: "Booking routes working"

    });

});

// =====================================
// GET BOOKINGS
// =====================================

router.get("/bookings", async (req, res) => {

    try {

        const bookings = await Booking.find()
            .sort({ createdAt: -1 });

        res.json({

            status: "success",

            count: bookings.length,

            data: bookings

        });

    } catch (err) {

        res.status(500).json({

            status: "error",

            message: err.message

        });

    }

});

// =====================================
// CREATE BOOKING
// =====================================

router.post("/bookings", async (req, res) => {

    try {

        const {

            room,

            checkIn,

            checkOut,

            parking

        } = req.body;

        // Room conflict

        if (room) {

            const roomConflict = await Booking.findOne({

                room,

                bookingStatus: {

                    $nin: [

                        "Cancelled",

                        "Checked Out"

                    ]

                },

                checkIn: {

                    $lt: new Date(checkOut)

                },

                checkOut: {

                    $gt: new Date(checkIn)

                }

            });

            if (roomConflict) {

                return res.status(400).json({

                    status: "error",

                    message: "Room already booked."

                });

            }

        }

        // Parking conflict

        if (parking) {

            const parkingConflict = await Booking.findOne({

                parking,

                bookingStatus: {

                    $nin: [

                        "Cancelled",

                        "Checked Out"

                    ]

                },

                checkIn: {

                    $lt: new Date(checkOut)

                },

                checkOut: {

                    $gt: new Date(checkIn)

                }

            });

            if (parkingConflict) {

                return res.status(400).json({

                    status: "error",

                    message: "Parking already booked."

                });

            }

        }

        const booking = new Booking(req.body);

        await booking.save();

        res.status(201).json({

            status: "success",

            data: booking

        });

    }

    catch (err) {

        res.status(400).json({

            status: "error",

            message: err.message

        });

    }

});

// =====================================
// UPDATE BOOKING
// =====================================

router.put("/bookings/:id", async (req, res) => {

    try {

        const booking = await Booking.findByIdAndUpdate(

            req.params.id,

            req.body,

            {

                new: true

            }

        );

        if (!booking) {

            return res.status(404).json({

                status: "error",

                message: "Booking not found"

            });

        }

        res.json({

            status: "success",

            data: booking

        });

    }

    catch (err) {

        res.status(400).json({

            status: "error",

            message: err.message

        });

    }

});

// =====================================
// DELETE BOOKING
// =====================================

router.delete("/bookings/:id", async (req, res) => {

    try {

        const booking = await Booking.findByIdAndDelete(

            req.params.id

        );

        if (!booking) {

            return res.status(404).json({

                status: "error",

                message: "Booking not found"

            });

        }

        res.json({

            status: "success",

            message: "Booking deleted"

        });

    }

    catch (err) {

        res.status(500).json({

            status: "error",

            message: err.message

        });

    }

});

// =====================================
// CHECK IN
// =====================================

router.put("/bookings/:id/checkin", async (req, res) => {

    try {

        const booking = await Booking.findById(req.params.id);

        if (!booking) {

            return res.status(404).json({

                status: "error",

                message: "Booking not found"

            });

        }

        booking.bookingStatus = "Checked In";
        booking.housekeepingStatus = "Clean";

        await booking.save();

        if (booking.room) {

            await Room.findByIdAndUpdate(

                booking.room,

                {

                    status: "Occupied"

                }

            );

        }

        if (booking.parking) {

            await Parking.findByIdAndUpdate(

                booking.parking,

                {

                    status: "Occupied"

                }

            );

        }

        res.json({

            status: "success",

            message: "Guest checked in."

        });

    }

    catch (err) {

        res.status(500).json({

            status: "error",

            message: err.message

        });

    }

});

// =====================================
// CHECK OUT
// =====================================

router.put("/bookings/:id/checkout", async (req, res) => {

    try {

        const booking = await Booking.findById(req.params.id);

        if (!booking) {

            return res.status(404).json({

                status: "error",

                message: "Booking not found"

            });

        }

        booking.bookingStatus = "Checked Out";
        booking.housekeepingStatus = "Needs Cleaning";

        await booking.save();

        if (booking.room) {

            await Room.findByIdAndUpdate(

                booking.room,

                {

                    status: "Needs Cleaning"

                }

            );

        }

        res.json({

            status: "success",

            message: "Guest checked out."

        });

    }

    catch (err) {

        res.status(500).json({

            status: "error",

            message: err.message

        });

    }

});

// =====================================
// MARK ROOM CLEAN
// =====================================

router.put("/bookings/:id/clean", async (req, res) => {

    try {

        const booking = await Booking.findById(req.params.id);

        if (!booking) {

            return res.status(404).json({

                status: "error",

                message: "Booking not found"

            });

        }

        booking.housekeepingStatus = "Clean";

        await booking.save();

        if (booking.room) {

            await Room.findByIdAndUpdate(

                booking.room,

                {

                    status: "Available"

                }

            );

        }

        if (booking.parking) {

            await Parking.findByIdAndUpdate(

                booking.parking,

                {

                    status: "Available"

                }

            );

        }

        res.json({

            status: "success",

            message: "Room cleaned."

        });

    }

    catch (err) {

        res.status(500).json({

            status: "error",

            message: err.message

        });

    }

});

module.exports = router;

// CHECK IN
router.put('/bookings/:id/checkin', async (req, res) => {

    try {

        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                status: "error",
                message: "Booking not found"
            });
        }

        booking.bookingStatus = "Checked In";
        await booking.save();

        await Room.findByIdAndUpdate(
            booking.room,
            {
                status: "Occupied"
            }
        );

        res.json({
            status: "success",
            message: "Guest checked in successfully."
        });

    } catch (err) {

        res.status(500).json({
            status: "error",
            message: err.message
        });

    }

});

// CHECK OUT
router.put('/bookings/:id/checkout', async (req, res) => {

    try {

        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                status: "error",
                message: "Booking not found"
            });
        }

        booking.bookingStatus = "Completed";
        await booking.save();

        await Room.findByIdAndUpdate(
            booking.room,
            {
                status: "Available"
            }
        );

        res.json({
            status: "success",
            message: "Guest checked out successfully."
        });

    } catch (err) {

        res.status(500).json({
            status: "error",
            message: err.message
        });

    }

});

// CHECK IN
router.put("/bookings/:id/checkin", async (req, res) => {

    try {

        const booking = await Booking.findById(req.params.id);

        if (!booking) {

            return res.status(404).json({
                status: "error",
                message: "Booking not found"
            });

        }

        booking.bookingStatus = "Checked In";

        booking.housekeepingStatus = "Clean";

        await booking.save();

        res.json({

            status: "success",

            data: booking

        });

    } catch (err) {

        res.status(500).json({

            status: "error",

            message: err.message

        });

    }

});

router.put("/bookings/:id/clean", ...)

module.exports = router;