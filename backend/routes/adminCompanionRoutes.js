const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const BookingCompanion = require("../models/BookingCompanion");
const { openDownload, getFileInfo } = require("../services/gridfsStorage");

const router = express.Router();
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "markryantamayo@gmail.com").trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "");
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || (ADMIN_PASSWORD ? crypto.createHash("sha256").update(`ca-smart-admin:${ADMIN_PASSWORD}`).digest("hex") : "");
function requireAdmin(req,res,next){const h=req.headers.authorization||"",t=h.startsWith("Bearer ")?h.slice(7):"";if(!t||!ADMIN_JWT_SECRET)return res.status(401).json({success:false,message:"Admin authentication required."});try{const p=jwt.verify(t,ADMIN_JWT_SECRET);if(p.role!=="admin"||String(p.email||"").toLowerCase()!==ADMIN_EMAIL)return res.status(403).json({success:false,message:"Admin access required."});req.admin=p;next();}catch(_){return res.status(401).json({success:false,message:"Admin session expired or invalid."});}}
async function findBooking(raw){const id=String(raw||"").trim();return mongoose.Types.ObjectId.isValid(id)?Booking.findById(id).lean():Booking.findOne({bookingReference:id}).lean();}

router.get("/admin/bookings/:id/companions", requireAdmin, async (req,res)=>{try{const booking=await findBooking(req.params.id);if(!booking)return res.status(404).json({success:false,message:"Booking not found."});const companions=await BookingCompanion.find({booking:booking._id}).select("fullName idFile idFileName submittedAt createdAt").sort({createdAt:1}).lean();res.json({success:true,bookingReference:booking.bookingReference,required:Math.max(0,Number(booking.adults||0)+Number(booking.children||0)-1),companions});}catch(err){console.error("ADMIN COMPANIONS GET ERROR:",err);res.status(500).json({success:false,message:"Unable to load companion information."});}});

router.get("/admin/bookings/:id/companions/:companionId/id", requireAdmin, async (req,res)=>{try{const booking=await findBooking(req.params.id);if(!booking)return res.status(404).send("Booking not found.");const companion=await BookingCompanion.findOne({_id:req.params.companionId,booking:booking._id}).lean();if(!companion||!companion.idFile)return res.status(404).send("Companion ID not found.");const info=await getFileInfo(companion.idFile).catch(()=>null),stream=openDownload(companion.idFile);if(!stream)return res.status(404).send("Companion ID not found.");res.setHeader("Content-Type",info?.contentType||"application/octet-stream");res.setHeader("Content-Disposition",`inline; filename="${String(companion.idFileName||"companion-id").replace(/[^a-zA-Z0-9._-]/g,"_")}"`);res.setHeader("Cache-Control","private, no-store");stream.on("error",()=>{if(!res.headersSent)res.status(404).send("Unable to read companion ID.");});stream.pipe(res);}catch(err){console.error("ADMIN COMPANION ID ERROR:",err);res.status(500).send("Unable to open companion ID.");}});

module.exports = router;
