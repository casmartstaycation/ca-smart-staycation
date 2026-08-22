const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const { requireAdmin } = require("../middleware/adminAuth");
const Setting = require("../models/Setting");
const { saveBuffer, openDownload } = require("../services/gridfsStorage");
const { mergedGuestAccountDesign, sanitizeGuestAccountDesign } = require("../services/guestAccountDesign");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowed.has(file.mimetype)) return cb(new Error("Background image must be JPG, PNG, or WEBP."));
    cb(null, true);
  }
});

async function getSettings() {
  let settings = await Setting.findOne();
  if (!settings) settings = await Setting.create({});
  return settings;
}

router.get("/", async (req, res) => {
  try {
    const settings = await getSettings();
    res.set("Cache-Control", "no-store");
    res.json({ success: true, data: mergedGuestAccountDesign(settings.guestAccountPage) });
  } catch (err) {
    console.error("GUEST ACCOUNT DESIGN GET ERROR:", err);
    res.status(500).json({ success: false, message: "Unable to load guest account design." });
  }
});

router.put("/", requireAdmin, async (req, res) => {
  try {
    const clean = sanitizeGuestAccountDesign(req.body || {});
    const settings = await getSettings();
    settings.guestAccountPage = { ...mergedGuestAccountDesign(settings.guestAccountPage), ...clean, version: 1 };
    settings.markModified("guestAccountPage");
    await settings.save();
    res.json({ success: true, message: "Guest account design saved.", data: mergedGuestAccountDesign(settings.guestAccountPage) });
  } catch (err) {
    console.error("GUEST ACCOUNT DESIGN UPDATE ERROR:", err);
    const status = /^Invalid /.test(String(err.message || "")) ? 400 : 500;
    res.status(status).json({ success: false, message: err.message || "Unable to save guest account design." });
  }
});

router.post("/reset", requireAdmin, async (req, res) => {
  try {
    const settings = await getSettings();
    settings.guestAccountPage = {};
    settings.markModified("guestAccountPage");
    await settings.save();
    res.json({ success: true, message: "Guest account restored to the current working design.", data: mergedGuestAccountDesign({}) });
  } catch (err) {
    console.error("GUEST ACCOUNT DESIGN RESET ERROR:", err);
    res.status(500).json({ success: false, message: "Unable to reset guest account design." });
  }
});

router.post("/upload", requireAdmin, (req, res) => {
  upload.single("image")(req, res, async uploadErr => {
    if (uploadErr) return res.status(400).json({ success: false, message: uploadErr.message || "Image upload failed." });
    try {
      if (!req.file) return res.status(400).json({ success: false, message: "Please select an image to upload." });
      const ext = path.extname(req.file.originalname || "").toLowerCase() || ".jpg";
      const id = await saveBuffer(req.file.buffer, `guest-account-design-${Date.now()}${ext}`, req.file.mimetype);
      res.json({ success: true, id, url: `/api/settings/guest-account-design/assets/${encodeURIComponent(id)}` });
    } catch (err) {
      console.error("GUEST ACCOUNT DESIGN IMAGE UPLOAD ERROR:", err);
      res.status(500).json({ success: false, message: "Unable to upload guest account background image." });
    }
  });
});

router.get("/assets/:id", async (req, res) => {
  try {
    const stream = openDownload(req.params.id);
    if (!stream) return res.status(400).send("Invalid image.");
    stream.on("file", file => {
      if (file.contentType) res.type(file.contentType);
      res.set("Cache-Control", "public, max-age=86400");
    });
    stream.on("error", () => {
      if (!res.headersSent) res.status(404).send("Image not found.");
    });
    stream.pipe(res);
  } catch (_) {
    res.status(404).send("Image not found.");
  }
});

module.exports = router;
