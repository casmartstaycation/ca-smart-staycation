const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const app = express();
const Booking = require("./models/Booking");
const Parking = require("./models/Parking");
const { requireAdmin } = require("./middleware/adminAuth");
const { processBookingStatusNotifications } = require("./services/bookingStatusNotifier");
const paymentUploadDir = path.join(__dirname, 'uploads/payments');
const guestDocumentUploadDir = path.join(__dirname, 'uploads/guest-documents');
const frontendRoot = path.join(__dirname, '..', 'frontend');
function deleteUploadedFile(dir, filename) { if (!filename) return; const safeName = path.basename(String(filename)); const filePath = path.join(dir, safeName); try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (err) { console.error(`Failed to delete ${filePath}:`, err); } }
function listFiles(dir) { try { if (!fs.existsSync(dir)) return []; return fs.readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isFile()).map(entry => entry.name); } catch (err) { console.error(`Error reading directory ${dir}:`, err); return []; } }
async function cleanupTerminalBookingUploads() { try { const bookings = await Booking.find({}).select("_id bookingStatus paymentProof paymentProofHistory governmentId driversLicense reschedulePaymentProof"); const paymentFiles = listFiles(paymentUploadDir); const documentFiles = listFiles(guestDocumentUploadDir); const validFiles = new Set(); bookings.forEach(b => { if (b.paymentProof) validFiles.add(b.paymentProof); if (b.governmentId) validFiles.add(b.governmentId); if (b.driversLicense) validFiles.add(b.driversLicense); if (b.reschedulePaymentProof) validFiles.add(b.reschedulePaymentProof); (b.paymentProofHistory || []).forEach(h => { if (h.proof) validFiles.add(h.proof); }); }); paymentFiles.forEach(file => { if (!validFiles.has(file)) deleteUploadedFile(paymentUploadDir, file); }); documentFiles.forEach(file => { if (!validFiles.has(file)) deleteUploadedFile(guestDocumentUploadDir, file); }); } catch (err) { console.error("Cleanup error:", err); } }

app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], baseUri: ["'self'"], fontSrc: ["'self'", "https:", "data:"], formAction: ["'self'"], frameAncestors: ["'self'"], imgSrc: ["'self'", "https:", "data:"], scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"], styleSrc: ["'self'", "'unsafe-inline'"], childSrc: ["'none'"], objectSrc: ["'none'"], upgradeInsecureRequests: [] } } }));

const allowedOrigins = new Set(["https://casmartstaycation.com","https://www.casmartstaycation.com","https://casmartstaycation.github.io","http://localhost:3000","http://127.0.0.1:5500","http://localhost:5500"]);

function isAllowedOrigin(origin) { if (!origin) return true; if (allowedOrigins.has(origin)) return true; try { const url = new URL(origin); return url.protocol === 'https:' && url.hostname.endsWith('.casmartstaycation.com'); } catch { return false; } }

app.use((req,res,next)=>{const origin=req.headers.origin;if(isAllowedOrigin(origin)){if(origin)res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Credentials','true');}next();});
app.use(cors({origin:(origin,callback)=>{if(isAllowedOrigin(origin))return callback(null,true);return callback(new Error(`CORS blocked origin: ${origin}`));},credentials:true,methods:["GET","HEAD","PUT","PATCH","POST","DELETE"],allowedHeaders:["Content-Type","Authorization"]}));

app.use(morgan('dev'));
app.use(express.json({limit:'10mb'}));
app.use(express.urlencoded({extended:true,limit:'10mb'}));
app.use('/uploads',express.static(path.join(__dirname,'uploads')));

app.use(express.static(frontendRoot, { index: 'index.html' }));
app.get('/', (req,res)=>res.sendFile(path.join(frontendRoot,'index.html')));
app.get('/favicon.ico', (req,res)=>res.sendFile(path.join(frontendRoot,'favicon.svg')));

mongoose.connect(process.env.MONGODB_URI).then(()=>console.log("✅ MongoDB Connected")).catch(err=>console.error("MongoDB Error:",err));

app.get('/api/health',(req,res)=>res.json({status:'success',message:'CA Smart Staycation API is running',timestamp:new Date()}));

async function expireUnpaidBookings(){try{const result=await Booking.updateMany({paymentDeadline:{$ne:null,$lte:new Date()},paymentProof:{$in:[null,""]},paymentStatus:{$ne:"Paid"},bookingStatus:{$nin:["Cancelled","Checked Out","Expired"]}},{$set:{bookingStatus:"Expired",paymentStatus:"Expired"}});if(result.modifiedCount>0)console.log(`⏰ Expired ${result.modifiedCount} unpaid bookings`);}catch(err){console.error("Expiry error:",err);}}

app.get('/api/bookings',async(req,res)=>{try{await expireUnpaidBookings();const bookings=await Booking.find().select("bookingReference firstName lastName email mobile room parking parkingOnly checkIn checkOut bookingStatus paymentStatus payingGuests").populate("room","unitNumber roomType price").populate("parking","parkingNumber rate").lean();res.json({status:"success",data:bookings});}catch(err){console.error("GET BOOKINGS ERROR:",err);res.status(500).json({status:"error",message:err.message});}});
app.get('/api/parking/availability',async(req,res)=>{try{await expireUnpaidBookings();const bookings=await Booking.find({bookingStatus:{$nin:["Cancelled","Checked Out","Expired"]},checkIn:{$ne:null},checkOut:{$ne:null}}).select("parking checkIn checkOut").lean();const reserved=bookings.reduce((acc,b)=>{if(b.parking){const id=String(b.parking);if(!acc[id])acc[id]=[];acc[id].push({start:new Date(b.checkIn),end:new Date(b.checkOut)});}return acc;},{});res.json({status:"success",data:reserved});}catch(err){console.error("GET PARKING AVAILABILITY ERROR:",err);res.status(500).json({status:"error",message:err.message});}});
app.get('/api/bookings/:id',async(req,res)=>{try{const booking=await Booking.findById(req.params.id).populate('room').populate('parking').lean();if(!booking)return res.status(404).json({success:false,message:'Booking not found'});res.json({success:true,data:booking});}catch(err){console.error("GET BOOKING ERROR:",err);res.status(500).json({success:false,message:err.message});}});

// Settings routes - embedded directly
app.get('/api/settings', async (req, res) => {
    try {
        const Setting = require('./models/Setting');
        let settings = await Setting.findOne();
        if (!settings) settings = await Setting.create({});
        res.json({ status: "success", data: settings });
    } catch (err) {
        console.error("GET SETTINGS ERROR:", err);
        res.status(500).json({ status: "error", message: err.message });
    }
});

app.put('/api/settings', async (req, res) => {
    try {
        const Setting = require('./models/Setting');
        let settings = await Setting.findOne();
        if (!settings) settings = await Setting.create(req.body);
        else { Object.assign(settings, req.body); await settings.save(); }
        res.json({ status: "success", data: settings });
    } catch (err) {
        console.error("PUT SETTINGS ERROR:", err);
        res.status(500).json({ status: "error", message: err.message });
    }
});

// Parking routes - embedded directly
app.get('/api/parking', async (req, res) => {
    try {
        const parkingSlots = await Parking.find().sort({ parkingNumber: 1 });
        res.json({ status: "success", data: parkingSlots });
    } catch (err) {
        console.error("GET PARKING SLOTS ERROR:", err);
        res.status(500).json({ status: "error", message: err.message });
    }
});

app.post('/api/parking', requireAdmin, async (req, res) => {
    try {
        const parkingSlot = new Parking(req.body);
        await parkingSlot.save();
        res.status(201).json({ status: "success", data: parkingSlot });
    } catch (err) {
        console.error("PARKING CREATE ERROR:", err);
        res.status(400).json({ status: "error", message: err.message });
    }
});

app.put('/api/parking/:id', requireAdmin, async (req, res) => {
    try {
        const parkingSlot = await Parking.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!parkingSlot) return res.status(404).json({ status: "error", message: "Parking slot not found" });
        res.json({ status: "success", data: parkingSlot });
    } catch (err) {
        res.status(400).json({ status: "error", message: err.message });
    }
});

app.delete('/api/parking/:id', requireAdmin, async (req, res) => {
    try {
        const parkingSlot = await Parking.findByIdAndDelete(req.params.id);
        if (!parkingSlot) return res.status(404).json({ status: "error", message: "Parking slot not found" });
        res.json({ status: "success", message: "Parking slot deleted" });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

app.use('/api',require('./routes/adminRoutes'));
app.use('/api',require('./routes/roomRoutes'));
app.use('/api',require('./routes/guestRoutes'));
app.use('/api',require('./routes/guestFastRoutes'));
app.use('/api',require('./routes/guestAuthRoutes'));

app.use((req,res)=>{if(req.method==='GET' && !req.path.startsWith('/api/')) return res.sendFile(path.join(frontendRoot,'index.html'));return res.status(404).json({status:'error',message:'Route not found'});
});

module.exports=app;

if(require.main===module){const PORT=process.env.PORT||3000;app.listen(PORT,()=>{console.log(`🚀 CA Smart Staycation API running on port ${PORT}`);setInterval(expireUnpaidBookings,60*1000);setInterval(cleanupTerminalBookingUploads,6*60*60*1000);});}