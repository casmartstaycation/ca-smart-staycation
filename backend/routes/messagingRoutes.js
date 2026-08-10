const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const GuestAccount = require("../models/GuestAccount");
const Booking = require("../models/Booking");
const Notification = require("../models/Notification");
const Message = require("../models/Message");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "ca-smart-staycation-guest-secret";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "markryantamayo@gmail.com";
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "");
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || (ADMIN_PASSWORD ? crypto.createHash("sha256").update(`ca-smart-admin:${ADMIN_PASSWORD}`).digest("hex") : "");

function guestPayload(req){const h=req.headers.authorization||"";if(!h.startsWith("Bearer "))throw new Error("Authentication required.");return jwt.verify(h.slice(7),JWT_SECRET);}
function adminPayload(req){const h=req.headers.authorization||"";if(!h.startsWith("Bearer ")||!ADMIN_JWT_SECRET)throw new Error("Admin authentication required.");const p=jwt.verify(h.slice(7),ADMIN_JWT_SECRET);if(p.role!=="admin"||String(p.email||"").toLowerCase()!==String(ADMIN_EMAIL).toLowerCase())throw new Error("Admin access required.");return p;}
function attachmentOk(a){return a&&typeof a.name==="string"&&typeof a.type==="string"&&typeof a.data==="string"&&["image/jpeg","image/png","image/webp","application/pdf"].includes(a.type)&&a.data.length<=7*1024*1024;}
async function guestAccount(req){const p=guestPayload(req);const a=await GuestAccount.findById(p.accountId).lean();if(!a)throw new Error("Account not found.");return a;}

router.get("/guest/inbox",async(req,res)=>{try{const a=await guestAccount(req);const [messages,notifications]=await Promise.all([Message.find({guestEmail:a.email}).sort({createdAt:1}).lean(),Notification.find({recipientType:"guest",recipientEmail:a.email}).sort({createdAt:-1}).lean()]);res.json({success:true,messages,notifications});}catch(e){res.status(401).json({success:false,message:e.message});}});
router.put("/guest/inbox/read",async(req,res)=>{try{const a=await guestAccount(req);await Promise.all([Message.updateMany({guestEmail:a.email,readByGuest:false},{$set:{readByGuest:true}}),Notification.updateMany({recipientType:"guest",recipientEmail:a.email,read:false},{$set:{read:true}})]);res.json({success:true});}catch(e){res.status(401).json({success:false,message:e.message});}});
router.post("/guest/messages",async(req,res)=>{try{const a=await guestAccount(req);const text=String(req.body.message||"").trim();const attachments=Array.isArray(req.body.attachments)?req.body.attachments.filter(attachmentOk):[];if(!text&&!attachments.length)return res.status(400).json({success:false,message:"Enter a message or attach a file."});if(attachments.length>3)return res.status(400).json({success:false,message:"You can attach up to 3 files per message."});let booking=null;if(req.body.bookingId){booking=await Booking.findById(req.body.bookingId).lean();if(!booking||String(booking.email).toLowerCase()!==String(a.email).toLowerCase())return res.status(403).json({success:false,message:"Booking not found for this account."});}const m=await Message.create({guestEmail:a.email,booking:booking?booking._id:null,senderType:"guest",senderName:String(a.email).split("@")[0],message:text,attachments,readByGuest:true,readByAdmin:false});await Notification.create({recipientType:"admin",title:"New guest message",message:`${a.email} sent a new message${booking?` about ${booking.bookingReference}`:""}.`,type:"message",booking:booking?booking._id:null});res.status(201).json({success:true,data:m});}catch(e){console.error("GUEST MESSAGE ERROR",e);res.status(400).json({success:false,message:e.message});}});

router.get("/admin/inbox",async(req,res)=>{try{adminPayload(req);const [messages,notifications]=await Promise.all([Message.find().sort({createdAt:1}).populate("booking").lean(),Notification.find({recipientType:"admin"}).sort({createdAt:-1}).lean()]);res.json({success:true,messages,notifications});}catch(e){res.status(401).json({success:false,message:e.message});}});
router.put("/admin/inbox/read",async(req,res)=>{try{adminPayload(req);await Promise.all([Message.updateMany({readByAdmin:false},{$set:{readByAdmin:true}}),Notification.updateMany({recipientType:"admin",read:false},{$set:{read:true}})]);res.json({success:true});}catch(e){res.status(401).json({success:false,message:e.message});}});
router.post("/admin/messages",async(req,res)=>{try{adminPayload(req);const email=String(req.body.guestEmail||"").trim().toLowerCase();const text=String(req.body.message||"").trim();if(!email||!text)return res.status(400).json({success:false,message:"Guest email and message are required."});const booking=req.body.bookingId?await Booking.findById(req.body.bookingId).lean():null;const m=await Message.create({guestEmail:email,booking:booking?booking._id:null,senderType:"admin",senderName:"CA Smart Staycation Admin",message:text,attachments:[],readByGuest:false,readByAdmin:true});await Notification.create({recipientType:"guest",recipientEmail:email,title:"New message from CA Smart Staycation",message:text.slice(0,180),type:"message",booking:booking?booking._id:null});res.status(201).json({success:true,data:m});}catch(e){res.status(400).json({success:false,message:e.message});}});

module.exports=router;
