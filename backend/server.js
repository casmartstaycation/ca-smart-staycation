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
const settingsRoutes = require("./routes/settingsRoutes");
const { processBookingStatusNotifications } = require("./services/bookingStatusNotifier");
const paymentUploadDir = path.join(__dirname, 'uploads/payments');
const guestDocumentUploadDir = path.join(__dirname, 'uploads/guest-documents');
const frontendRoot = path.join(__dirname, '..', 'frontend');
function deleteUploadedFile(dir, filename) { if (!filename) return; const safeName = path.basename(String(filename)); const filePath = path.join(dir, safeName); try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (err) { console.error('DELETE UPLOAD ERROR:', err && err.message ? err.message : err); } }
function listFiles(dir) { try { if (!fs.existsSync(dir)) return []; return fs.readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isFile()).map(entry => entry.name); } catch (err) { console.error('LIST FILES ERROR:', err && err.message ? err.message : err); return []; } }
async function cleanupTerminalBookingUploads() { try { const bookings = await Booking.find({}).select("_id bookingStatus paymentProof paymentProofHistory governmentId driversLicense reschedulePaymentProof"); for (const b of bookings) { if (['Cancelled','Checked Out','Expired'].includes(b.bookingStatus || '')) { deleteUploadedFile(paymentUploadDir, b.paymentProof); (Array.isArray(b.paymentProofHistory) ? b.paymentProofHistory : []).forEach(n => deleteUploadedFile(paymentUploadDir, n)); deleteUploadedFile(guestDocumentUploadDir, b.governmentId); deleteUploadedFile(guestDocumentUploadDir, b.driversLicense); deleteUploadedFile(guestDocumentUploadDir, b.reschedulePaymentProof); } } } catch (err) { console.error('CLEANUP ERROR:', err); } }

app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], baseUri: ["'self'"], fontSrc: ["'self'", "https:", "data:"], formAction: ["'self'"], frameAncestors: ["'self'"], imgSrc: ["'self'", "data:"], scriptSrc: ["'self'","'unsafe-inline'"], styleSrc: ["'self'", "https:", "'unsafe-inline'"] } } }));

const allowedOrigins = new Set(["https://casmartstaycation.com","https://www.casmartstaycation.com","https://casmartstaycation.github.io","http://localhost:3000","http://127.0.0.1:5500","http://localhost:8080"]);

function isAllowedOrigin(origin) { if (!origin) return true; if (allowedOrigins.has(origin)) return true; try { const url = new URL(origin); return url.protocol === 'https:' && url.hostname.endsWith('.vercel.app'); } catch (err) { return false; } }

app.use((req,res,next)=>{const origin=req.headers.origin;if(isAllowedOrigin(origin)){if(origin)res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Credentials','true');res.setHeader('Vary','Origin');}res.setHeader('Access-Control-Allow-Methods','GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, Accept');next();});
app.use(cors({origin:(origin,callback)=>{if(isAllowedOrigin(origin))return callback(null,true);return callback(new Error(`CORS blocked origin: ${origin}`));},credentials:true,methods:["GET","HEAD","POST","PUT","PATCH","DELETE","OPTIONS"]}));

app.use(morgan('dev'));
app.use(express.json({limit:'10mb'}));
app.use(express.urlencoded({extended:true,limit:'10mb'}));
app.use('/uploads',express.static(path.join(__dirname,'uploads')));

app.use(express.static(frontendRoot, { index: 'index.html' }));
app.get('/', (req,res)=>res.sendFile(path.join(frontendRoot,'index.html')));
app.get('/favicon.ico', (req,res)=>res.sendFile(path.join(frontendRoot,'favicon.svg')));

mongoose.connect(process.env.MONGODB_URI).then(()=>console.log("✅ MongoDB Connected")).catch(err=>console.error("MongoDB Error:",err));

app.get('/api/health',(req,res)=>res.json({status:'success',message:'CA Smart Staycation API is running',timestamp:new Date()}));

async function expireUnpaidBookings(){try{const result=await Booking.updateMany({paymentDeadline:{$ne:null,$lte:new Date()},paymentProof:{$in:[null,""]},paymentStatus:{$ne:"Paid"},bookingStatus:{$nin:["Cancelled","Checked Out","Expired"]}},{$set:{bookingStatus:'Expired'}});if(result)console.log('Expired unpaid bookings:',result.nModified||result.modifiedCount||0);}catch(err){console.error('EXPIRE BOOKINGS ERROR:',err);}}

app.get('/api/bookings',async(req,res)=>{try{await expireUnpaidBookings();const bookings=await Booking.find().select("bookingReference firstName lastName email mobile room parking parkingOnly checkIn checkOut bookingStatus paymentStatus totalAmount").lean();res.json({success:true,data:bookings});}catch(err){console.error('GET BOOKINGS ERROR:',err);res.status(500).json({success:false,message:'Unable to load bookings.'});}});
app.get('/api/parking/availability',async(req,res)=>{try{await expireUnpaidBookings();const bookings=await Booking.find({bookingStatus:{$nin:["Cancelled","Checked Out","Expired"]},checkIn:{$ne:null},checkOut:{$ne:null}}).select('room parking checkIn checkOut').lean();res.json({success:true,data:bookings});}catch(err){console.error('PARKING AVAIL ERROR:',err);res.status(500).json({success:false,message:'Unable to load parking availability.'});}});
app.get('/api/bookings/:id',async(req,res)=>{try{const booking=await Booking.findById(req.params.id).populate('room').populate('parking').lean();if(!booking)return res.status(404).json({success:false,message:'Booking not found.'});res.json({success:true,data:booking});}catch(err){console.error('GET BOOKING ERROR:',err);res.status(500).json({success:false,message:'Unable to load booking.'});}});

app.use('/api',require('./routes/adminRoutes'));
app.use('/api',require('./routes/roomRoutes'));
app.use('/api',require('./routes/guestRoutes'));
app.use('/api',require('./routes/guestFastRoutes'));
app.use('/api',require('./routes/guestAuthRoutes'));

app.use((req,res)=>{if(req.method==='GET' && !req.path.startsWith('/api/')) return res.sendFile(path.join(frontendRoot,'index.html'));return res.status(404).json({status:'error',message:'Route not found'});
});

module.exports=app;

if(require.main===module){const PORT=process.env.PORT||3000;app.listen(PORT,()=>{console.log(`🚀 CA Smart Staycation API running on port ${PORT}`);setInterval(expireUnpaidBookings,60*1000);setInterval(cleanupTerminalBookingUploads,60*60*1000);});}
