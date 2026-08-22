const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../middleware/adminAuth");
const Setting = require("../models/Setting");
const { mergedVisualLayout, sanitizeVisualLayout, assertTarget } = require("../services/visualLayout");
async function getSettings(){let settings=await Setting.findOne();if(!settings)settings=await Setting.create({});return settings;}
function host(settings,target){
  const booking=settings.guestBookingPage&&typeof settings.guestBookingPage==="object"?settings.guestBookingPage:{};
  const account=settings.guestAccountPage&&typeof settings.guestAccountPage==="object"?settings.guestAccountPage:{};
  if(target==="booking")return {field:"guestBookingPage",root:booking,layout:booking.visualLayout};
  if(target==="guest-account")return {field:"guestAccountPage",root:account,layout:account.visualLayout};
  const admin=booking.adminPageDesign&&typeof booking.adminPageDesign==="object"?booking.adminPageDesign:{};
  return {field:"guestBookingPage",root:booking,admin,layout:admin.visualLayout};
}
router.get("/:target", async (req,res)=>{try{const target=assertTarget(req.params.target),settings=await getSettings(),h=host(settings,target);res.set("Cache-Control","no-store");res.json({success:true,target,data:mergedVisualLayout(h.layout)});}catch(err){const status=/Unknown visual/.test(String(err.message||""))?404:500;res.status(status).json({success:false,message:err.message||"Unable to load visual layout."});}});
router.put("/:target", requireAdmin, async (req,res)=>{try{const target=assertTarget(req.params.target),layout=sanitizeVisualLayout(req.body||{}),settings=await getSettings(),h=host(settings,target);if(target==="admin")settings.guestBookingPage={...h.root,adminPageDesign:{...h.admin,visualLayout:layout}};else settings[h.field]={...h.root,visualLayout:layout};settings.markModified(h.field);await settings.save();res.json({success:true,target,message:"Visual layout saved.",data:layout});}catch(err){console.error("VISUAL LAYOUT UPDATE ERROR:",err);const status=/Unknown visual/.test(String(err.message||""))?404:400;res.status(status).json({success:false,message:err.message||"Unable to save visual layout."});}});
router.post("/:target/reset", requireAdmin, async (req,res)=>{try{const target=assertTarget(req.params.target),settings=await getSettings(),h=host(settings,target);if(target==="admin"){const admin={...h.admin};delete admin.visualLayout;settings.guestBookingPage={...h.root,adminPageDesign:admin};}else{const next={...h.root};delete next.visualLayout;settings[h.field]=next;}settings.markModified(h.field);await settings.save();res.json({success:true,target,message:"Visual layout restored.",data:mergedVisualLayout({})});}catch(err){res.status(500).json({success:false,message:err.message||"Unable to reset visual layout."});}});
module.exports=router;
