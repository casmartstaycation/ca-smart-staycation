require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { waitUntil } = require('@vercel/functions');

const app = express();
const Booking = require("./models/Booking");
const BookingCompanion = require("./models/BookingCompanion");
const Parking = require("./models/Parking");
const settingsRoutes = require("./routes/settingsRoutes");
const { processBookingStatusNotifications } = require("./services/bookingStatusNotifier");
const { deleteFile: deleteGridFsFile } = require("./services/gridfsStorage");
const { cleanupExpiredTransientUploads } = require("./services/uploadRetentionCleanup");

const paymentUploadDir = path.join(__dirname, 'uploads/payments');
const guestDocumentUploadDir = path.join(__dirname, 'uploads/guest-documents');
function deleteUploadedFile(dir, filename) { if (!filename) return; const safeName = path.basename(String(filename)); const filePath = path.join(dir, safeName); try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (err) { console.error(`UPLOAD CLEANUP ERROR (${safeName}):`, err.message); } }
function listFiles(dir) { try { if (!fs.existsSync(dir)) return []; return fs.readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isFile()).map(entry => entry.name); } catch (err) { console.error(`UPLOAD DIRECTORY SCAN ERROR (${dir}):`, err.message); return []; } }
let cleanupPromise = null;
let lastCleanupAt = 0;
async function cleanupTerminalBookingUploads() {
  if (cleanupPromise) return cleanupPromise;
  const now = Date.now();
  if (now - lastCleanupAt < 5 * 60 * 1000) return;
  cleanupPromise = (async () => {
    try {
      await expireUnpaidBookings();
      const bookings = await Booking.find({}).select("_id bookingStatus paymentProof paymentProofHistory governmentId driversLicense reschedulePaymentProof extraRequests").lean();
      const terminalStatuses = new Set(["Cancelled", "Expired"]);
      const referencedPaymentFiles = new Set();
      const referencedDocumentFiles = new Set();
      const terminalBookings = [];
      for (const booking of bookings) {
        if (booking.paymentProof && !String(booking.paymentProof).startsWith("data:")) referencedPaymentFiles.add(path.basename(String(booking.paymentProof)));
        for (const item of (booking.paymentProofHistory || [])) if (item.filename && !String(item.filename).startsWith("data:")) referencedPaymentFiles.add(path.basename(String(item.filename)));
        if (booking.governmentId && !/^[a-f0-9]{24}$/i.test(String(booking.governmentId))) referencedDocumentFiles.add(path.basename(String(booking.governmentId)));
        if (booking.driversLicense && !/^[a-f0-9]{24}$/i.test(String(booking.driversLicense))) referencedDocumentFiles.add(path.basename(String(booking.driversLicense)));
        if (booking.reschedulePaymentProof && !String(booking.reschedulePaymentProof).startsWith("data:") && !/^[a-f0-9]{24}$/i.test(String(booking.reschedulePaymentProof))) referencedPaymentFiles.add(path.basename(String(booking.reschedulePaymentProof)));
        if (terminalStatuses.has(String(booking.bookingStatus || "").trim())) terminalBookings.push(booking);
      }
      for (const booking of terminalBookings) {
        deleteUploadedFile(paymentUploadDir, booking.paymentProof);
        for (const item of (booking.paymentProofHistory || [])) deleteUploadedFile(paymentUploadDir, item.filename);
        deleteUploadedFile(guestDocumentUploadDir, booking.governmentId);
        deleteUploadedFile(guestDocumentUploadDir, booking.driversLicense);
        deleteUploadedFile(paymentUploadDir, booking.reschedulePaymentProof);
        const companions = await BookingCompanion.find({ booking: booking._id }).select("idFile").lean();
        for (const companion of companions) if (companion.idFile) await deleteGridFsFile(companion.idFile);
        if (booking.governmentId && /^[a-f0-9]{24}$/i.test(String(booking.governmentId))) await deleteGridFsFile(booking.governmentId);
        if (booking.driversLicense && /^[a-f0-9]{24}$/i.test(String(booking.driversLicense))) await deleteGridFsFile(booking.driversLicense);
        if (booking.reschedulePaymentProof && /^[a-f0-9]{24}$/i.test(String(booking.reschedulePaymentProof))) await deleteGridFsFile(booking.reschedulePaymentProof);
        await BookingCompanion.deleteMany({ booking: booking._id });
        await Booking.updateOne({ _id: booking._id }, { $set: { paymentProof: "", governmentId: "", driversLicense: "", reschedulePaymentProof: "", paymentProofHistory: [], extraRequests: [] } });
      }
      const orphanPaymentFiles = listFiles(paymentUploadDir).filter(name => !referencedPaymentFiles.has(name));
      const orphanDocumentFiles = listFiles(guestDocumentUploadDir).filter(name => !referencedDocumentFiles.has(name));
      for (const filename of orphanPaymentFiles) deleteUploadedFile(paymentUploadDir, filename);
      for (const filename of orphanDocumentFiles) deleteUploadedFile(guestDocumentUploadDir, filename);
      lastCleanupAt = Date.now();
      console.log(`🧹 Guest upload cleanup complete. Terminal bookings processed: ${terminalBookings.length}.`);
    } catch (err) { console.error("TERMINAL/ORPHAN UPLOAD CLEANUP ERROR:", err); }
    finally { cleanupPromise = null; }
  })();
  return cleanupPromise;
}

app.use(helmet({ contentSecurityPolicy: false }));
const allowedOrigins = new Set(['https://www.casmartstaycation.com','https://casmartstaycation.com','https://casmartstaycation.github.io','http://localhost:3000','http://localhost:5173']);
app.use(cors({ origin: (origin, callback) => { if (!origin || allowedOrigins.has(origin)) return callback(null, true); return callback(null, false); }, credentials: true, methods: ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Origin','X-Requested-With','Content-Type','Accept','Authorization','Cache-Control'], optionsSuccessStatus: 204 }));
app.options('*', cors({ origin: (origin, callback) => { if (!origin || allowedOrigins.has(origin)) return callback(null, true); return callback(null, false); }, credentials: true, methods: ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Origin','X-Requested-With','Content-Type','Accept','Authorization','Cache-Control'], optionsSuccessStatus: 204 }));
app.use(morgan('dev')); app.use(express.json({ limit: '10mb' })); app.use(express.urlencoded({ extended: true, limit: '10mb' })); app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));
const frontendRoot = path.resolve(__dirname, '..', 'frontend'); app.use(express.static(frontendRoot)); app.get('/', (req,res)=>res.sendFile(path.join(frontendRoot,'index.html')));
const mongoUri = process.env.MONGODB_URI; let mongoConnectionPromise = null;
function connectMongoDB() { if (!mongoUri) return Promise.reject(new Error('MONGODB_URI environment variable is not configured in Vercel.')); if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection); if (!mongoConnectionPromise) { mongoConnectionPromise = mongoose.connect(mongoUri,{serverSelectionTimeoutMS:10000,connectTimeoutMS:10000,maxPoolSize:5,bufferCommands:false}).then(()=>{console.log('✅ MongoDB Connected');return mongoose.connection;}).catch(err=>{mongoConnectionPromise=null;console.error('MongoDB Error:',err.message);throw err;}); } return mongoConnectionPromise; }
app.get('/api/health',async(req,res)=>{try{await connectMongoDB();res.json({status:'success',message:'CA Smart Staycation API is running',database:'connected',timestamp:new Date()});}catch(err){res.status(503).json({status:'error',message:'Database unavailable',error:err.message});}});
app.use('/api',async(req,res,next)=>{try{await connectMongoDB();const maintenanceTask=cleanupExpiredTransientUploads().catch(err=>console.error("24H UPLOAD CLEANUP TRIGGER ERROR:",err)).then(()=>cleanupTerminalBookingUploads().catch(err=>console.error("UPLOAD CLEANUP TRIGGER ERROR:",err)));if(process.env.VERCEL)waitUntil(maintenanceTask);next();}catch(err){console.error('API DATABASE CONNECTION ERROR:',err.message);res.status(503).json({success:false,message:'Database connection unavailable. Check the MONGODB_URI and MongoDB Atlas network access settings.'});}});
async function expireUnpaidBookings(){try{const result=await Booking.updateMany({paymentDeadline:{$ne:null,$lte:new Date()},paymentProof:{$in:[null,""]},paymentStatus:{$ne:"Paid"},bookingStatus:{$in:["Reserved","Waiting for Payment","Payment Rejected"]}},{$set:{bookingStatus:"Expired"}});if(result.modifiedCount)console.log(`⏰ Auto-expired ${result.modifiedCount} unpaid booking(s).`);}catch(err){console.error("BOOKING EXPIRATION ERROR:",err);}}
app.get('/api/bookings',async(req,res)=>{try{await expireUnpaidBookings();const bookings=await Booking.find().select("bookingReference firstName lastName email mobile room parking parkingOnly checkIn checkOut adults children totalAmount paymentStatus bookingStatus housekeepingStatus paymentProof paymentProofSubmittedAt paymentDate refundRequested refundRequestedAt refundAmount refundFee refundPolicyRule refundStatus refundProcessedAt refundProcessedBy cancellationRequestedAt cancellationReason createdAt updatedAt").populate({path:"room",select:"unitNumber unitName category capacity price weekendPrice holidayPrice status"}).populate({path:"parking",select:"parkingNumber parkingName status"}).lean().sort({createdAt:-1});res.json({success:true,data:bookings});}catch(err){console.error("BOOKING LIST ERROR:",err);res.status(500).json({success:false,message:err.message});}});
app.get('/api/bookings/:id',async(req,res)=>{try{const booking=mongoose.Types.ObjectId.isValid(req.params.id)?await Booking.findById(req.params.id).populate("room").populate("parking").lean():await Booking.findOne({bookingReference:String(req.params.id).trim()}).populate("room").populate("parking").lean();if(!booking)return res.status(404).json({success:false,message:"Booking not found."});res.json({success:true,data:booking});}catch(err){res.status(500).json({success:false,message:err.message});}});
app.use('/api', require('./routes/guestExtraRequestRoutes'));
app.use('/api', require('./routes/guestCompanionRoutes'));
app.use('/api', require('./routes/adminRoutes'));
app.use('/api', require('./routes/adminBookingStatusRoutes'));
app.use('/api', require('./routes/roomRoutes')); app.use('/api', require('./routes/guestRoutes')); app.use('/api', require('./routes/guestFastRoutes')); app.use('/api', require('./routes/guestAuthRoutes')); app.use('/api', require('./routes/paymentRecoveryRoutes')); app.use('/api', require('./routes/bookingRoutes')); app.use('/api', require('./routes/guestDocumentRoutes')); app.use('/api', require('./routes/parkingRoutes')); app.use('/api', require('./routes/voucherRoutes')); app.use('/api', require('./routes/messagingRoutes')); app.use('/api/settings',settingsRoutes);
app.get('*',(req,res)=>{if(req.path.startsWith('/api/'))return res.status(404).json({status:'error',message:'Route not found'});return res.sendFile(path.join(frontendRoot,'index.html'));});
if(!process.env.VERCEL){const PORT=process.env.PORT||3000;app.listen(PORT,()=>{console.log(`🚀 CA Smart Staycation API running on port ${PORT}`);setInterval(expireUnpaidBookings,60000);setInterval(cleanupTerminalBookingUploads,60000);setInterval(()=>processBookingStatusNotifications().catch(err=>console.error("BOOKING STATUS NOTIFICATION ERROR:",err)),15000);expireUnpaidBookings();cleanupTerminalBookingUploads();processBookingStatusNotifications().catch(err=>console.error("INITIAL BOOKING STATUS NOTIFICATION ERROR:",err));});}
module.exports=app;
