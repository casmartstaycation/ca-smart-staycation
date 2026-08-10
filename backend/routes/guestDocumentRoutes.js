const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Booking = require("../models/Booking");

const router = express.Router();
const uploadDir = path.join(__dirname, "../uploads/guest-documents");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) { cb(null, uploadDir); },
  filename(req, file, cb) {
    const safeRef = String(req.params.id || "booking").replace(/[^a-zA-Z0-9_-]/g, "");
    cb(null, `${safeRef}-${file.fieldname}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.mimetype)) return cb(new Error("Documents must be JPG, PNG, WEBP, or PDF."));
    cb(null, true);
  }
});

router.post("/bookings/:id/documents", upload.fields([
  { name: "governmentId", maxCount: 1 },
  { name: "driversLicense", maxCount: 1 }
]), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });

    const governmentId = req.files?.governmentId?.[0];
    const driversLicense = req.files?.driversLicense?.[0];

    if (!governmentId) return res.status(400).json({ success: false, message: "Government-issued ID is required." });
    if (booking.parking && !driversLicense) return res.status(400).json({ success: false, message: "Driver's license is required for parking bookings." });

    booking.governmentId = governmentId.filename;
    if (driversLicense) booking.driversLicense = driversLicense.filename;
    booking.vehicleBrand = String(req.body.vehicleBrand || booking.vehicleBrand || "").trim();
    booking.vehicleModel = String(req.body.vehicleModel || booking.vehicleModel || "").trim();
    booking.vehicleColor = String(req.body.vehicleColor || booking.vehicleColor || "").trim();
    booking.plateNumber = String(req.body.plateNumber || booking.plateNumber || "").trim();
    await booking.save();

    res.json({
      success: true,
      message: "Guest documents uploaded successfully.",
      data: {
        governmentId: booking.governmentId,
        driversLicense: booking.driversLicense,
        vehicleBrand: booking.vehicleBrand,
        vehicleModel: booking.vehicleModel,
        vehicleColor: booking.vehicleColor,
        plateNumber: booking.plateNumber
      }
    });
  } catch (err) {
    console.error("GUEST DOCUMENT UPLOAD ERROR:", err);
    res.status(400).json({ success: false, message: err.message || "Document upload failed." });
  }
});

router.get("/bookings/:id/documents/:type", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).lean();
    if (!booking) return res.status(404).send("Booking not found.");
    const field = req.params.type === "driversLicense" ? "driversLicense" : req.params.type === "governmentId" ? "governmentId" : null;
    if (!field || !booking[field]) return res.status(404).send("Document not found.");
    const filePath = path.join(uploadDir, path.basename(booking[field]));
    if (!fs.existsSync(filePath)) return res.status(404).send("Document file not found.");
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).send("Unable to open document.");
  }
});

module.exports = router;
