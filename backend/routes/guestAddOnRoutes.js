const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Booking = require("../models/Booking");

const router = express.Router();
const uploadDir = path.join(__dirname, "../uploads/payments");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({ destination: (_req, _file, cb) => cb(null, uploadDir), filename: (_req, file, cb) => cb(null, `addon-${Date.now()}-${crypto.randomBytes(5).toString("hex")}${path.extname(file.originalname).toLowerCase()}`) });
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.mimetype)) });
const GUEST_JWT_SECRET = process.env.JWT_SECRET || "ca-smart-staycation-guest-secret";
function guestPayload(req) { const h=req.headers.authorization||""; const token=h.startsWith("Bearer ")?h.slice(7):""; if(!token) throw new Error("Authentication required."); return jwt.verify(token,GUEST_JWT_SECRET); }
function adminConfig(){ const password=String(process.env.ADMIN_PASSWORD||""); const email=String(process.env.ADMIN_EMAIL||"markryantamayo@gmail.com").trim().toLowerCase(); const jwtSecret=String(process.env.ADMIN_JWT_SECRET||process.env.JWT_SECRET||(password?crypto.createHash("sha256").update(`ca-smart-admin:${password}`).digest("hex"):"")); return {email,jwtSecret}; }
function adminPayload(req){ const h=req.headers.authorization||""; const token=h.startsWith("Bearer ")?h.slice(7):""; const c=adminConfig(); if(!token||!c.jwtSecret) throw new Error("Admin authentication required."); const p=jwt.verify(token,c.jwtSecret); if(p.role!=="admin"||String(p.email||"").toLowerCase()!==c.email) throw new Error("Admin access required."); return p; }
const activeStatuses=["Reserved","Confirmed","Checked In"];
const normalize=(n,min=0,max=20)=>Math.max(min,Math.min(max,Number.parseInt(n,10)||0));

router.post("/guest-auth/bookings/:id/add-ons", upload.single("paymentProof"), async (req,res)=>{
  try {
    const payload=guestPayload(req); const booking=await Booking.findById(req.params.id); if(!booking)return res.status(404).json({success:false,message:"Booking not found."});
    if(String(booking.email).trim().toLowerCase()!==String(payload.email).trim().toLowerCase())return res.status(403).json({success:false,message:"You can only modify your own booking."});
    if(!activeStatuses.includes(booking.bookingStatus))return res.status(409).json({success:false,message:"Additional guests and amenity requests are available only for an active confirmed stay."});
    const extraGuests=normalize(req.body.extraGuests,0,2), amenitySets=normalize(req.body.amenitySets,0,10);
    const currentAdults=Number(booking.adults||0), pendingAdults=(booking.addOnRequests||[]).filter(r=>r.status==="Pending Verification").reduce((s,r)=>s+Number(r.extraGuests||0),0);
    if(currentAdults+pendingAdults+extraGuests>4)return res.status(400).json({success:false,message:`Maximum occupancy is 4 adults. You can add only ${Math.max(0,4-currentAdults-pendingAdults)} more adult guest(s).`});
    if(!extraGuests&&!amenitySets)return res.status(400).json({success:false,message:"Select at least one additional guest or amenity set."});
    if(!req.file)return res.status(400).json({success:false,message:"Payment proof is required immediately when requesting an additional guest or amenity set."});
    const amount=(extraGuests+amenitySets)*300;
    booking.addOnRequests=booking.addOnRequests||[];
    booking.addOnRequests.push({extraGuests,amenitySets,amount,paymentProof:req.file.filename,paymentSubmittedAt:new Date(),status:"Pending Verification",adminNote:""});
    await booking.save();
    res.json({success:true,message:"Request submitted. Payment proof has been received and is waiting for admin verification.",data:booking});
  } catch(err){console.error("GUEST ADD-ON REQUEST ERROR:",err);res.status(err.message.includes("authentication")||err.message.includes("access")?401:500).json({success:false,message:err.message||"Unable to submit request."});}
});

router.get("/admin/add-on-requests", async (req,res)=>{
  try { adminPayload(req); const bookings=await Booking.find({"addOnRequests.status":"Pending Verification"}).select("bookingReference firstName lastName email adults addOnRequests").lean(); const requests=[]; for(const b of bookings) for(const r of (b.addOnRequests||[])) if(r.status==="Pending Verification") requests.push({...r,bookingId:b._id,bookingReference:b.bookingReference,guestName:`${b.firstName||""} ${b.lastName||""}`.trim(),email:b.email,currentAdults:b.adults}); res.json({success:true,data:requests}); }
  catch(err){res.status(401).json({success:false,message:err.message||"Admin authentication required."});}
});

router.put("/admin/bookings/:bookingId/add-ons/:requestId/verify", async (req,res)=>{
  try {
    const admin=adminPayload(req); const booking=await Booking.findById(req.params.bookingId); if(!booking)return res.status(404).json({success:false,message:"Booking not found."}); const request=booking.addOnRequests?.id(req.params.requestId); if(!request)return res.status(404).json({success:false,message:"Add-on request not found."}); if(request.status!=="Pending Verification")return res.status(409).json({success:false,message:"This request has already been processed."}); const action=String(req.body.action||"").toLowerCase();
    if(action==="approve"){ if(Number(booking.adults||0)+Number(request.extraGuests||0)>4)return res.status(400).json({success:false,message:"Approval would exceed the 4-adult maximum."}); booking.adults=Number(booking.adults||0)+Number(request.extraGuests||0); booking.totalAmount=Number(booking.totalAmount||0)+Number(request.amount||0); request.status="Approved"; request.verifiedAt=new Date(); request.verifiedBy=admin.email; request.adminNote="Payment verified."; }
    else if(action==="reject"){request.status="Rejected";request.verifiedAt=new Date();request.verifiedBy=admin.email;request.adminNote=String(req.body.note||"Payment proof could not be verified.").slice(0,500);} else return res.status(400).json({success:false,message:"Action must be approve or reject."});
    await booking.save(); res.json({success:true,message:action==="approve"?"Add-on payment approved and booking updated.":"Add-on payment rejected.",data:booking});
  } catch(err){res.status(401).json({success:false,message:err.message||"Unable to verify add-on payment."});}
});

module.exports=router;
