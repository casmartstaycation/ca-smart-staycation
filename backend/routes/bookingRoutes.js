const express = require("express");
const router = express.Router();

const Booking = require("../models/Booking");
const Room = require("../models/Room");
const Parking = require("../models/Parking");

const multer = require("multer");
const path = require("path");
const fs = require("fs");

// =====================================
// CREATE PAYMENT FOLDER
// =====================================

const uploadDir = path.join(__dirname, "../uploads/payments");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// =====================================
// MULTER CONFIG
// =====================================

const storage = multer.diskStorage({

    destination(req, file, cb) {
        cb(null, uploadDir);
    },

    filename(req, file, cb) {

        const ext = path.extname(file.originalname);

        cb(null, Date.now() + ext);

    }

});

const upload = multer({ storage });

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
            .populate("room")
            .populate("parking")
            .sort({ createdAt: -1 });

        res.json({

            success: true,

            data: bookings

        });

    }

    catch (err) {

        res.status(500).json({

            success: false,

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
            parking,
            checkIn,
            checkOut

        } = req.body;

        // ============================
        // ROOM CONFLICT
        // ============================

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

                    success: false,

                    message: "Room already booked."

                });

            }

        }

        // ============================
        // PARKING CONFLICT
        // ============================

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

                    success: false,

                    message: "Parking slot already reserved."

                });

            }

        }

        const bookingReference =
            "CA" +
            new Date()
                .toISOString()
                .slice(2,10)
                .replace(/-/g,"") +
            "-" +
            Math.floor(
                1000 + Math.random() * 9000
            );

        const booking = new Booking({

            ...req.body,

            bookingReference

        });

        await booking.save();

        res.status(201).json({

            success: true,

            message: "Booking created.",

            data: booking

        });

    }

    catch(err){

        res.status(500).json({

            success:false,

            message:err.message

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

            { new: true }

        );

        if (!booking) {

            return res.status(404).json({

                success: false,

                message: "Booking not found."

            });

        }

        res.json({

            success: true,

            data: booking

        });

    }

    catch (err) {

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});

// =====================================
// DELETE BOOKING
// =====================================

router.delete("/bookings/:id", async (req, res) => {

    try {

        const booking = await Booking.findByIdAndDelete(req.params.id);

        if (!booking) {

            return res.status(404).json({

                success: false,

                message: "Booking not found."

            });

        }

        res.json({

            success: true,

            message: "Booking deleted."

        });

    }

    catch (err) {

        res.status(500).json({

            success: false,

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

                success: false,

                message: "Booking not found."

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

            success: true,

            message: "Guest checked in."

        });

    }

    catch (err) {

        res.status(500).json({

            success: false,

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

                success: false,

                message: "Booking not found."

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

        if (booking.parking) {

            await Parking.findByIdAndUpdate(

                booking.parking,

                {

                    status: "Available"

                }

            );

        }

        res.json({

            success: true,

            message: "Guest checked out."

        });

    }

    catch (err) {

        res.status(500).json({

            success: false,

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

                success: false,

                message: "Booking not found."

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

            success: true,

            message: "Room cleaned."

        });

    }

    catch (err) {

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});

// =====================================
// UPLOAD PAYMENT PROOF
// =====================================

router.post(
    "/bookings/:id/payment",
    upload.single("paymentProof"),
    async (req, res) => {

        try {

            console.log("========== PAYMENT UPLOAD V2 ==========");
            console.log("DEBUG VERSION 12345");
            console.log("Booking ID:", req.params.id);
            console.log("File:", req.file);

            const booking = await Booking.findById(req.params.id);

            if (!booking) {

                return res.status(404).json({

                    success: false,

                    message: "Booking not found."

                });

            }

            if (!req.file) {

                return res.status(400).json({

                    success: false,

                    message: "No payment proof uploaded."

                });

            }

            booking.paymentProof = req.file.filename;

            booking.paymentDate = new Date();

            booking.bookingStatus = "Pending Payment Verification";

            await booking.save();

            console.log("===== AFTER SAVE =====");
            console.log(await Booking.findById(req.params.id));

            console.log("Payment proof saved.");

            res.json({

                success: true,

                message: "Payment proof uploaded successfully.",

                data: booking

            });

        }

        catch (err) {

            console.error(err);

            res.status(500).json({

                success: false,

                message: err.message

            });

        }

    }
);

// =====================================
// APPROVE PAYMENT
// =====================================

router.put("/bookings/:id/approve-payment", async (req, res) => {

    try {

        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        booking.paymentStatus = "Paid";
        booking.bookingStatus = "Reserved";

        await booking.save();

        res.json({
            success: true,
            message: "Payment approved.",
            data: booking
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});


// =====================================
// EXPORT ROUTER
// =====================================

module.exports = router;