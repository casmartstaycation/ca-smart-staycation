const Booking = require("../models/Booking");
const Notification = require("../models/Notification");
const Setting = require("../models/Setting");
const GuestAccount = require("../models/GuestAccount");
const bcrypt = require("bcryptjs");
const sendEmail = require("../mail/sendEmail");
const FALLBACK_ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "casmartstaycation@gmail.com";
const LEGACY_DEFAULT_ADMIN_EMAIL = "markryantamayo@gmail.com";
const LOGIN_URL = process.env.GUEST_LOGIN_URL || "https://casmartstaycation.github.io/cassbooking/guest-booking/guest-login.html";
let resendQuotaBlockedUntil = 0;
let resendQuotaWarningLogged = false;
function isResendQuotaError(err) { return /daily email sending quota/i.test(String(err?.message || err || "")); }
function blockResendUntilNextUtcDay() { const now=new Date(); const nextUtcDay=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1); resendQuotaBlockedUntil=nextUtcDay; if(!resendQuotaWarningLogged){console.warn(`RESEND QUOTA EXHAUSTED: email notifications paused until ${new Date(nextUtcDay).toISOString()}.`);resendQuotaWarningLogged=true;} }
function isResendQuotaBlocked(){if(resendQuotaBlockedUntil&&Date.now()>=resendQuotaBlockedUntil){resendQuotaBlockedUntil=0;resendQuotaWarningLogged=false;}return resendQuotaBlockedUntil>Date.now();}

// This fingerprint deliberately includes every booking-side action that can be
// performed by either the guest or admin. It excludes the notification keys so
// updating those keys cannot trigger another notification cycle.
function statusKey(b){
  const extra=(b.extraRequests||[]).map(r=>({id:String(r._id||""),type:r.type||"",quantity:Number(r.quantity||0),amount:Number(r.amount||0),status:r.status||"",requestedAt:r.requestedAt||null,paymentSubmittedAt:r.paymentSubmittedAt||null,paymentProofFileName:r.paymentProofFileName||"",rejectionReason:r.rejectionReason||"",approvedAt:r.approvedAt||null,paidAt:r.paidAt||null}));
  return JSON.stringify({
    bookingStatus:b.bookingStatus||"",paymentStatus:b.paymentStatus||"",refundStatus:b.refundStatus||"",refundRequested:b.refundRequested||false,refundRequestedAt:b.refundRequestedAt||null,refundAmount:Number(b.refundAmount||0),refundFee:Number(b.refundFee||0),refundProcessedAt:b.refundProcessedAt||null,
    cancellationRequestedAt:b.cancellationRequestedAt||null,cancellationReason:b.cancellationReason||"",
    paymentProofSubmittedAt:b.paymentProofSubmittedAt||null,paymentProof:b.paymentProof||"",paymentProofHistory:(b.paymentProofHistory||[]).map(x=>({filename:x.filename||"",uploadedAt:x.uploadedAt||x.createdAt||null,status:x.status||""})),reschedulePaymentProof:b.reschedulePaymentProof||"",reschedulePaymentProofSubmittedAt:b.reschedulePaymentProofSubmittedAt||null,
    checkIn:b.checkIn||null,checkOut:b.checkOut||null,adults:Number(b.adults||0),children:Number(b.children||0),room:String(b.room||""),parking:String(b.parking||""),parkingOnly:!!b.parkingOnly,totalAmount:Number(b.totalAmount||0),extraRequests:extra
  });
}
function statusMessage(b){
  const s=b.bookingStatus||"Updated",p=b.paymentStatus||"Pending";
  if(s==="Reserved"&&p==="Paid")return{title:"Booking Confirmed",message:`Your payment has been approved and booking ${b.bookingReference} is confirmed.`,type:"booking-confirmed"};
  if(s==="Payment Rejected")return{title:"Payment Proof Rejected",message:`Payment proof for booking ${b.bookingReference} was rejected. Please log in and upload a new proof of payment.`,type:"payment-rejected"};
  if(s==="Cancelled")return{title:"Booking Cancelled",message:`Booking ${b.bookingReference} has been cancelled by CA Smart Staycation.`,type:"booking-cancelled"};
  if(s==="Expired")return{title:"Booking Expired",message:`Booking ${b.bookingReference} has expired because payment was not completed within the required period.`,type:"booking-expired"};
  if(b.cancellationRequestedAt&&s!=="Cancelled")return{title:"Cancellation Request",message:`A cancellation request was submitted for booking ${b.bookingReference}${b.cancellationReason?`: ${b.cancellationReason}`:"."}`,type:"cancellation-requested"};
  if(b.refundRequested)return{title:"Refund Request Updated",message:`A refund request is associated with booking ${b.bookingReference}. Refund status: ${b.refundStatus||"Not Requested"}.`,type:"refund-request"};
  if(b.extraRequests&&b.extraRequests.length){const latest=b.extraRequests[b.extraRequests.length-1];const label=latest.type==="extra_guest"?"Extra Guest":"Extra Set of Amenities";if(latest.paymentSubmittedAt||latest.requestedAt)return{title:`${label} Request Updated`,message:`Booking ${b.bookingReference} has a ${label.toLowerCase()} request for quantity ${Number(latest.quantity||0)}. Status: ${latest.status||"Pending"}.`,type:"extra-request"};}
  if(b.reschedulePaymentProof||b.reschedulePaymentProofSubmittedAt)return{title:"Reschedule Payment Updated",message:`Reschedule payment information for booking ${b.bookingReference} was updated.`,type:"reschedule-payment"};
  if(b.paymentProofSubmittedAt||b.paymentProof)return{title:"Payment Proof Updated",message:`Payment proof for booking ${b.bookingReference} was uploaded or updated and may require verification.`,type:"payment-proof"};
  if(s==="Checked In")return{title:"Guest Checked In",message:`Booking ${b.bookingReference} has been checked in.`,type:"booking-status"};
  if(s==="Checked Out")return{title:"Guest Checked Out",message:`Booking ${b.bookingReference} has been checked out.`,type:"booking-status"};
  return{title:"Booking Activity Updated",message:`Booking ${b.bookingReference} was updated. Booking status: ${s}. Payment status: ${p}.`,type:"booking-activity"};
}
async function getAdminNotificationEmail(){try{const settings=await Setting.findOne().select("adminNotificationEmail").lean();const configured=String(settings?.adminNotificationEmail||"").trim().toLowerCase();if(configured===LEGACY_DEFAULT_ADMIN_EMAIL){await Setting.updateOne({},{$set:{adminNotificationEmail:FALLBACK_ADMIN_EMAIL}});return FALLBACK_ADMIN_EMAIL;}return configured||FALLBACK_ADMIN_EMAIL;}catch(e){console.error("ADMIN NOTIFICATION EMAIL LOOKUP ERROR:",e);return FALLBACK_ADMIN_EMAIL;}}
async function getAdminContactNumber(){try{const settings=await Setting.findOne().select("adminContactNumber").lean();return String(settings?.adminContactNumber||"").trim();}catch(e){console.error("ADMIN CONTACT NUMBER LOOKUP ERROR:",e);return "";}}
function adminContactBlock(contact){const value=String(contact||"").trim();if(!value)return "";const safe=value.replace(/[&<>\"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));return `<p><strong>Need assistance?</strong><br>Contact CA Smart Staycation Admin: <strong>${safe}</strong></p>`;}
async function ensureGuestAccount(b){if(!b.email||!b.bookingReference)return null;const email=String(b.email).trim().toLowerCase();let a=await GuestAccount.findOne({bookingReference:b.bookingReference});if(!a){const passwordHash=await bcrypt.hash(String(b.bookingReference).trim(),12);a=await GuestAccount.create({guest:null,bookingReference:b.bookingReference,email,passwordHash,defaultPassword:true});}else if(a.email!==email){a.email=email;await a.save();}return a;}
async function sendNewBookingEmail(b,adminContactNumber){if(!b.email)return;const email=String(b.email).trim().toLowerCase(),name=`${b.firstName||""} ${b.lastName||""}`.trim()||"Guest",password=String(b.bookingReference).trim();const html=`<h2>CA Smart Staycation</h2><p>Dear ${name},</p><p>Your booking request has been received successfully.</p><h3>Guest Account</h3><p><strong>Login email:</strong> ${email}<br><strong>Temporary password:</strong> ${password}</p><p>Please change this temporary password after your first login.</p><p><strong>Booking Reference:</strong> ${b.bookingReference}<br><strong>Check-in:</strong> ${new Date(b.checkIn).toLocaleDateString("en-PH")}<br><strong>Check-out:</strong> ${new Date(b.checkOut).toLocaleDateString("en-PH")}<br><strong>Total:</strong> ₱${Number(b.totalAmount||0).toLocaleString("en-PH")}</p><p>Your booking is currently <strong>${b.bookingStatus||"Waiting for Payment"}</strong>. Please follow the payment instructions on the booking page.</p>${adminContactBlock(adminContactNumber)}<p><a href="${LOGIN_URL}">Open Guest Account</a></p>`;await sendEmail(email,`Booking Received — ${b.bookingReference}`,html);}
async function sendGuestStatusEmail(b,i,adminContactNumber){const email=String(b.email||"").trim().toLowerCase();if(!email)return;const name=`${b.firstName||""} ${b.lastName||""}`.trim()||"Guest";const reason=b.bookingStatus==="Cancelled"&&b.cancellationReason?`<p><strong>Cancellation reason:</strong> ${b.cancellationReason}</p>`:"";await sendEmail(email,`${i.title} — ${b.bookingReference}`,`<h2>CA Smart Staycation</h2><p>Dear ${name},</p><p>${i.message}</p>${reason}<p><strong>Booking Reference:</strong> ${b.bookingReference}<br><strong>Check-in:</strong> ${new Date(b.checkIn).toLocaleDateString("en-PH")}<br><strong>Check-out:</strong> ${new Date(b.checkOut).toLocaleDateString("en-PH")}<br><strong>Total:</strong> ₱${Number(b.totalAmount||0).toLocaleString("en-PH")}</p>${adminContactBlock(adminContactNumber)}<p><a href="${LOGIN_URL}">Open Guest Account</a></p>`);}
async function sendAdminStatusEmail(b,i,adminEmail){if(!adminEmail)return;const name=`${b.firstName||""} ${b.lastName||""}`.trim()||"Guest";const reason=b.bookingStatus==="Cancelled"&&b.cancellationReason?`<br><strong>Cancellation Reason:</strong> ${b.cancellationReason}`:"";await sendEmail(adminEmail,`Booking Activity — ${b.bookingReference}`,`<h2>CA Smart Staycation Admin Notification</h2><p><strong>Booking:</strong> ${b.bookingReference}<br><strong>Guest:</strong> ${name}<br><strong>Guest Email:</strong> ${b.email||""}<br><strong>Booking Status:</strong> ${b.bookingStatus||""}<br><strong>Payment Status:</strong> ${b.paymentStatus||""}<br><strong>Refund Status:</strong> ${b.refundStatus||"Not Requested"}${reason}</p><p>${i.message}</p>`);}
async function processBookingStatusNotifications(){
  const [adminEmail,adminContactNumber]=await Promise.all([getAdminNotificationEmail(),getAdminContactNumber()]);
  const bookings=await Booking.find().select("_id bookingReference firstName lastName email bookingStatus paymentStatus refundStatus refundRequested refundRequestedAt refundAmount refundFee refundProcessedAt cancellationRequestedAt cancellationReason checkIn checkOut totalAmount adults children room parking parkingOnly paymentProof paymentProofSubmittedAt paymentProofHistory reschedulePaymentProof reschedulePaymentProofSubmittedAt extraRequests lastStatusNotificationKey lastGuestEmailNotificationKey lastAdminEmailNotificationKey").lean();
  for(const b of bookings){
    const key=statusKey(b),isNew=!b.lastStatusNotificationKey,email=String(b.email||"").trim().toLowerCase();
    if(isNew||b.lastStatusNotificationKey!==key){
      const info=isNew?{title:"Booking Received",message:`Your booking ${b.bookingReference} has been received.`,type:"booking-received"}:statusMessage(b);
      const name=`${b.firstName||""} ${b.lastName||""}`.trim()||"Guest";
      const adminMessage=`${b.bookingReference} — ${name}: ${isNew?"New booking received.":info.message}`;
      if(email)await Notification.create({recipientType:"guest",recipientEmail:email,booking:b._id,title:info.title,message:info.message,type:info.type,read:false});
      if(adminEmail)await Notification.create({recipientType:"admin",recipientEmail:adminEmail,booking:b._id,title:isNew?`New Booking — ${b.bookingReference}`:`Booking Activity — ${b.bookingReference}`,message:adminMessage,type:info.type,read:false});
      await Booking.updateOne({_id:b._id},{$set:{lastStatusNotificationKey:key}});
    }
    if(isResendQuotaBlocked())continue;
    if(email&&b.lastGuestEmailNotificationKey!==key){try{if(isNew){await ensureGuestAccount(b);await sendNewBookingEmail(b,adminContactNumber);}else await sendGuestStatusEmail(b,statusMessage(b),adminContactNumber);await Booking.updateOne({_id:b._id},{$set:{lastGuestEmailNotificationKey:key}});}catch(e){if(isResendQuotaError(e)){blockResendUntilNextUtcDay();continue;}console.error(`GUEST EMAIL FAILED (${email}, ${b.bookingReference}, key=${key}):`,e.message);}}
    if(isResendQuotaBlocked())continue;
    if(adminEmail&&b.lastAdminEmailNotificationKey!==key){try{if(isNew){const name=`${b.firstName||""} ${b.lastName||""}`.trim()||"Guest";await sendEmail(adminEmail,`New Booking — ${b.bookingReference}`,`<h2>CA Smart Staycation Admin Notification</h2><p><strong>Booking:</strong> ${b.bookingReference}<br><strong>Guest:</strong> ${name}<br><strong>Guest Email:</strong> ${email||""}<br><strong>Check-in:</strong> ${new Date(b.checkIn).toLocaleDateString("en-PH")}<br><strong>Check-out:</strong> ${new Date(b.checkOut).toLocaleDateString("en-PH")}<br><strong>Total:</strong> ₱${Number(b.totalAmount||0).toLocaleString("en-PH")}</p>`);}else await sendAdminStatusEmail(b,statusMessage(b),adminEmail);await Booking.updateOne({_id:b._id},{$set:{lastAdminEmailNotificationKey:key}});}catch(e){if(isResendQuotaError(e)){blockResendUntilNextUtcDay();continue;}console.error(`ADMIN EMAIL FAILED (${adminEmail}, ${b.bookingReference}, key=${key}):`,e.message);}}
  }
}
module.exports={processBookingStatusNotifications};
