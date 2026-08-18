const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const router = express.Router();
const DEFAULT_ADMIN_EMAIL = 'markryantamayo@gmail.com';
function getAdminConfig() { const password=String(process.env.ADMIN_PASSWORD||''); const email=String(process.env.ADMIN_EMAIL||DEFAULT_ADMIN_EMAIL).trim().toLowerCase(); const jwtSecret=String(process.env.ADMIN_JWT_SECRET||process.env.JWT_SECRET||(password?crypto.createHash('sha256').update(`ca-smart-admin:${password}`).digest('hex'):'')); return {email,password,jwtSecret}; }
router.get('/admin',(req,res)=>res.json({status:'success',message:'Admin endpoint OK'}));
router.get('/admin-auth/status',(req,res)=>{const config=getAdminConfig();res.json({success:true,configured:Boolean(config.password&&config.jwtSecret),emailConfigured:Boolean(config.email),passwordConfigured:Boolean(config.password),jwtConfigured:Boolean(config.jwtSecret),adminEmail:config.email||null,configurationMode:'ADMIN_PASSWORD_ONLY'});});
router.post('/admin-auth/login',async(req,res)=>{try{const config=getAdminConfig(),email=String(req.body?.email||'').trim().toLowerCase(),password=String(req.body?.password??'');if(!config.password||!config.jwtSecret)return res.status(503).json({success:false,code:'ADMIN_AUTH_NOT_CONFIGURED',message:'Admin authentication is not configured on the server. Set ADMIN_PASSWORD in Vercel, then redeploy.'});if(!email||!password)return res.status(400).json({success:false,code:'ADMIN_CREDENTIALS_REQUIRED',message:'Admin email and password are required.'});if(email!==config.email)return res.status(401).json({success:false,code:'INVALID_ADMIN_CREDENTIALS',message:'Invalid admin credentials.'});const valid=config.password.startsWith('$2')?await bcrypt.compare(password,config.password):password===config.password;if(!valid)return res.status(401).json({success:false,code:'INVALID_ADMIN_CREDENTIALS',message:'Invalid admin credentials.'});const token=jwt.sign({role:'admin',email:config.email},config.jwtSecret,{expiresIn:'8h'});return res.json({success:true,message:'Admin login successful.',token,admin:{email:config.email,role:'admin'}});}catch(err){console.error('ADMIN LOGIN ERROR:',err);return res.status(500).json({success:false,code:'ADMIN_LOGIN_ERROR',message:'Unable to process admin login.'});}});
// Must be mounted before the legacy generic /api/bookings/:id PUT route so Vercel sends the notification in the same request.
router.use(require('./adminBookingStatusRoutes'));
router.use(require('./adminExtraRequestFileRoutes'));
router.use(require('./adminUploadRoutes'));
router.use(require('./adminBookingRoutes'));
router.use(require('./adminCompanionRoutes'));
module.exports = router;
