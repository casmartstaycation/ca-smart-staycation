const express = require("express");
const router = express.Router();

const Parking = require("../models/Parking");

// GET
router.get("/parking", async (req, res) => {

    const parking = await Parking.find().sort({
        parkingNumber: 1
    });

    res.json({
        status: "success",
        data: parking
    });

});

// CREATE
router.post("/parking", async (req, res) => {

    try {

        const parking = new Parking(req.body);

        await parking.save();

        res.status(201).json({
            status: "success",
            data: parking
        });

    } catch (err) {

        res.status(400).json({
            status: "error",
            message: err.message
        });

    }

});

// UPDATE
router.put("/parking/:id", async (req, res) => {

    const parking = await Parking.findByIdAndUpdate(

        req.params.id,

        req.body,

        {
            new: true
        }

    );

    res.json({

        status: "success",

        data: parking

    });

});

// DELETE
router.delete("/parking/:id", async (req, res) => {

    await Parking.findByIdAndDelete(req.params.id);

    res.json({

        status: "success"

    });

});

module.exports = router;