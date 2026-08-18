const mongoose = require("mongoose");

const parkingSchema = new mongoose.Schema({

    parkingNumber: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },

    parkingName: {
        type: String,
        default: "Parking Slot"
    },

    rate: {
        type: Number,
        default: 500
    },

    status: {
        type: String,
        enum: [
            "Available",
            "Occupied",
            "Maintenance"
        ],
        default: "Available"
    }

}, {

    timestamps: true

});

module.exports = mongoose.model("Parking", parkingSchema);