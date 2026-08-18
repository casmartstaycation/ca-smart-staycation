const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { GridFSBucket, ObjectId } = require("mongodb");
const Booking = require("../models/Booking");
const { openDownload, getFileInfo } = require("../services/gridfsStorage");

const router = express.Router();
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "markryantamayo@gmail.com").trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "");
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || (ADMIN_PASSWORD ? crypto.createHash("sha256").update(`ca-smart-admin:${ADMIN_PASSWORD}`).digest("hex") : "");
function requireAdmin(req,res,next){const h=req.headers.authorization||"",t=h.startsWith("Bearer ")?h.slice(7):"";if(!t||!ADMIN_JWT_SECRET)return res.status(401).json({success:false,message:"Admin authentication required."});try{const p=jwt.verify(t,ADMIN_JWT_SECRET);if(p.role!=="admin"||String(p.email||"").toLowerCase()!==ADMIN_EMAIL)return res.status(403).json({success:false,message:"Admin access required."});req.admin=p;next();}catch(_){return res.status(401).json({success:false,message:"Admin session expired or invalid."});}}
async function bookingFor(rawId){const id=String(rawId||"").trim();return mongoose.Types.ObjectId.isValid(id)?Booking.findById(id).lean():Booking.findOne({bookingReference:id}).lean();}
function safeFilename(value,fallback){return String(value||fallback).replace(/[^a-zA-Z0-9._-]/g,"_");}
async function serveGridFSFromBucket(bucketName,fileId,res,fallbackFilename="uploaded-file"){if(!mongoose.Types.ObjectId.isValid(String(fileId))||!mongoose.connection.db)return false;let objectId;try{objectId=new ObjectId(String(fileId));}catch(_){return false;}const bucket=new GridFSBucket(mongoose.connection.db,{bucketName});const files=await bucket.find({_id:objectId}).toArray();const info=files[0];if(!info)return false;const stream=bucket.openDownloadStream(objectId);res.setHeader("Content-Type",info.contentType||info.metadata?.contentType||"application/octet-stream");res.setHeader("Content-Disposition",`inline; filename="${safeFilename(info.filename,fallbackFilename)}"`);res.setHeader("Cache-Control","private, no-store");stream.on("error",err=>{console.error(`ADMIN GRIDFS ${bucketName} DOWNLOAD ERROR:`,err);if(!res.headersSent)res.status(404).json({success:false,message:"Unable to read uploaded file."});else res.end();});stream.pipe(res);return true;}
async function serveGridFS(fileId,res,fallbackFilename="uploaded-file"){if(await serveGridFSFromBucket("uploads",fileId,res,fallbackFilename))return true;if(await serveGridFSFromBucket("fs",fileId,res,fallbackFilename))return true;if(await serveGridFSFromBucket("files",fileId,res,fallbackFilename))return true;if(!mongoose.Types.ObjectId.isValid(String(fileId)))return false;try{const info=await getFileInfo(fileId);if(!info)return false;const stream=openDownload(fileId);if(!stream)return false;res.setHeader("Content-Type",info.contentType||info.metadata?.contentType||"application/octet-stream");res.setHeader("Content-Disposition",`inline; filename="${safeFilename(info.filename,fallbackFilename)}"`);res.setHeader("Cache-Control","private, no-store");stream.on("error",err=>{console.error("ADMIN GRIDFS DOWNLOAD ERROR:",err);if(!res.headersSent)res.status(404).json({success:false,message:"Unable to read uploaded file."});else res.end();});stream.pipe(res);return true;}catch(err){console.error("ADMIN GRIDFS LOOKUP ERROR:",err);return false;}}

router.get("/admin/bookings/:id/file/:type/:subId?",requireAdmin,async(req,res)=>{try{const booking=await bookingFor(req.params.id);if(!booking)return res.status(404).json({success:false,message:"Booking not found."});const type=String(req.params.type||"").toLowerCase();const subId=String(req.params.subId||"");let value="",filename="uploaded-file";
if(type==="government-id"){value=booking.governmentId||"";filename="government-id";}
else if(type==="drivers-license"){value=booking.driversLicense||"";filename="drivers-license";}
else if(type==="payment"){value=booking.paymentProof||"";filename=booking.paymentProofName||"payment-proof";}
else if(type==="reschedule-payment"){value=booking.reschedulePaymentProof||"";filename="reschedule-payment-proof";}
else if(type==="payment-history"){const index=Number(subId),history=Array.isArray(booking.paymentProofHistory)?booking.paymentProofHistory:[];if(!Number.isInteger(index)||index<0||index>=history.length)return res.status(404).json({success:false,message:"Payment proof history item not found."});const item=history[index]||{};value=item.data||item.paymentProof||item.url||item.fileUrl||item.path||item.filename||"";filename=item.filename||item.name||`payment-proof-${index+1}`;}
else if(type==="extra-request"){
  const requests=Array.isArray(booking.extraRequests)?booking.extraRequests:[];
  let index=-1;
  if(subId) index=requests.findIndex(r=>String(r?._id||r?.id||"")===subId);
  if(index<0&&/^\d+$/.test(subId)) index=Number(subId);
  // Older bookings and the /full response may omit the subdocument _id.
  // In that case the admin link uses the request's array index.
  if(index<0&&subId==="") index=0;
  if(index<0||index>=requests.length)return res.status(404).json({success:false,message:"Additional request not found."});
  const request=requests[index]||{};value=request.paymentProof||request.data||request.url||request.fileUrl||request.path||"";filename=request.paymentProofFileName||request.filename||"additional-request-payment-proof";
}
else return res.status(400).json({success:false,message:"Unknown uploaded file type."});
if(!value)return res.status(404).json({success:false,message:"Uploaded file is not available."});
if(typeof value==="string"&&value.startsWith("data:")){const match=value.match(/^data:([^;,]+)(?:;[^,]*)?,(.*)$/s);if(!match)return res.status(400).json({success:false,message:"Stored upload data is invalid."});res.setHeader("Content-Type",match[1]||"application/octet-stream");res.setHeader("Content-Disposition",`inline; filename="${safeFilename(filename,"uploaded-file")}"`);res.setHeader("Cache-Control","private, no-store");return res.send(Buffer.from(match[2],"base64"));}
if(mongoose.Types.ObjectId.isValid(String(value).trim())){if(await serveGridFS(String(value).trim(),res,filename))return;return res.status(404).json({success:false,message:"The uploaded file was found in the booking record but is not present in the current or legacy MongoDB GridFS storage."});}
const legacyMatch=String(value).match(/\/api\/uploads\/[^/]+\/([a-f0-9]{24})(?:[/?#]|$)/i)||String(value).match(/\/([a-f0-9]{24})(?:[/?#]|$)/i);if(legacyMatch){const fileId=legacyMatch[1];if(!JSON.stringify(booking).includes(fileId))return res.status(403).json({success:false,message:"Uploaded file is not associated with this booking."});if(await serveGridFS(fileId,res,filename))return;}
if(/^https?:\/\//i.test(String(value))){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const upstream=await fetch(String(value),{redirect:"follow",signal:controller.signal});if(!upstream.ok)return res.status(502).json({success:false,message:`Stored upload could not be retrieved (HTTP ${upstream.status}).`});const contentType=upstream.headers.get("content-type")||"application/octet-stream";if(/text\/html/i.test(contentType))return res.status(502).json({success:false,message:"The stored upload URL returned a web page instead of the uploaded file. Please re-upload the document."});res.setHeader("Content-Type",contentType);res.setHeader("Content-Disposition",`inline; filename="${safeFilename(filename,"uploaded-file")}"`);res.setHeader("Cache-Control","private, no-store");return res.send(Buffer.from(await upstream.arrayBuffer()));}finally{clearTimeout(timer);}}
return res.status(404).json({success:false,message:"The uploaded file is not available from the current or legacy storage service. Please re-upload this document."});
}catch(err){console.error("ADMIN FILE VIEW ERROR:",err);if(err.name==="AbortError")return res.status(504).json({success:false,message:"The uploaded file storage service took too long to respond."});return res.status(500).json({success:false,message:"Unable to open uploaded file."});}});

router.get("/admin/bookings/:id/gridfs/:fileId",requireAdmin,async(req,res)=>{try{const booking=await bookingFor(req.params.id);if(!booking)return res.status(404).json({success:false,message:"Booking not found."});const fileId=String(req.params.fileId||"").trim();if(!mongoose.Types.ObjectId.isValid(fileId)||!JSON.stringify(booking).includes(fileId))return res.status(403).json({success:false,message:"Uploaded file is not associated with this booking."});if(await serveGridFS(fileId,res))return;return res.status(404).json({success:false,message:"Uploaded file is no longer available in production or legacy GridFS storage."});}catch(err){console.error("ADMIN LEGACY UPLOAD VIEW ERROR:",err);res.status(500).json({success:false,message:"Unable to open uploaded file."});}});
module.exports=router;
