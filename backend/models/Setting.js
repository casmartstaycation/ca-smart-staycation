const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema({

    studioRate: {
        type: Number,
        default: 2800
    },

    singleRate: {
        type: Number,
        default: 3500
    },

    doubleRate: {
        type: Number,
        default: 4500
    },

    parkingRate: {
        type: Number,
        default: 500
    },

    extraAdultFee: {
        type: Number,
        default: 300
    },

    securityDeposit: {
        type: Number,
        default: 1000
    },

    adminNotificationEmail: {
        type: String,
        default: ""
    }

});

module.exports = mongoose.model("Setting", settingSchema);
