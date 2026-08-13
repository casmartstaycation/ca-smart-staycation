/* CA Smart Staycation temporary offline API bridge */
(function(){'use strict';
const STORAGE_KEY='caSmartStaycationOfflineBookings';
const rooms=[{_id:'unit-719',id:'unit-719',name:'Unit 719',unitName:'Unit 719',unitNumber:'719',title:'Studio Unit 719',type:'Studio',category:'Accommodation',tower:'Barbados Tower',floor:'7th Floor',roomNumber:'Room 19',location:'Azure North Pampanga',description:'Welcome to CA Smart Staycation Unit 719, located on the 7th Floor, Room 19 of Barbados Tower at Azure North Pampanga. Enjoy a comfortable and relaxing studio stay with convenient access to the amenities and attractions of Azure North. The unit accommodates up to 4 adults. Children ages 0–2 are not counted toward the guest limit.',price:2800,nightlyRate:2800,rate:2800,capacity:4,maxGuests:4,status:'Available',available:true,amenities:['Air Conditioning','Private Bathroom','Wi-Fi','Kitchen','Refrigerator','Microwave','Television','Keyless Entry','Hot Water','Bedroom','Dining Area'],images:['images/luxury-room-4.png'],photos:['images/luxury-room-4.png'],gallery:['images/luxury-room-4.png']}];
const parking=[{_id:'parking-1',id:'parking-1',slot:'P1',name:'Parking Slot 1',label:'Parking Slot 1',status:'Available',available:true,price:500,nightlyRate:500,rate:500}];
const settings={roomRate:2800,ROOM_RATE:2800,extraGuestFee:300,EXTRA_GUEST_FEE:300,parkingRate:500,PARKING_RATE:500,securityDeposit:1000,SECURITY_DEPOSIT:1000,maxGuests:4,MAX_GUESTS:4,maxFreeChildren:2,MAX_FREE_CHILDREN:2};
const getBookings=()=>{try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(x)?x:[]}catch(e){return[]}};
const saveBookings=x=>localStorage.setItem(STORAGE_KEY,JSON.stringify(x));
const saveBooking=body=>{const b={...(body||{}),_id:'offline-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),bookingReference:'BK'+Date.now(),bookingStatus:'Pending',offline:true,createdAt:new Date().toISOString(),documentsUploaded:false};const a=getBookings();a.push(b);saveBookings(a);return b};
const json=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{'Content-Type':'application/json'}});
const path=x=>{try{return new URL(typeof x==='string'?x:x.url||'',location.origin).pathname}catch(e){return String(x||'').split('?')[0]}};
const originalFetch=window.fetch.bind(window);window.CA_SMART_API='/api';
window.fetch=async function(input,init){const p=path(input),m=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase();
if(p==='/api/rooms'){console.info('[CA Smart Staycation] Offline API: /api/rooms');return json({success:true,rooms,data:rooms})}
if(p==='/api/parking'){console.info('[CA Smart Staycation] Offline API: /api/parking');return json({success:true,parking,slots:parking,data:parking})}
if(p==='/api/settings'){console.info('[CA Smart Staycation] Offline API: /api/settings');return json({success:true,settings,data:settings})}
if(p==='/api/bookings'){console.info('[CA Smart Staycation] Offline API: /api/bookings');if(m==='GET'){const data=getBookings();return json({success:true,bookings:data,data})}if(m==='POST'){let body={};try{body=JSON.parse((init&&init.body)||'{}')}catch(e){}const booking=saveBooking(body);return json({success:true,offline:true,booking,data:booking},201)}}
const match=p.match(/^\/api\/bookings\/([^/]+)\/documents$/);if(match&&m==='POST'){const id=decodeURIComponent(match[1]),a=getBookings(),i=a.findIndex(b=>String(b._id)===String(id));if(i<0)return json({success:false,message:'Offline booking not found.'},404);a[i]={...a[i],documentsUploaded:true,governmentIdUploaded:true,driverLicenseUploaded:true};saveBookings(a);console.info('[CA Smart Staycation] Offline API: /api/bookings/'+id+'/documents');return json({success:true,offline:true,data:a[i]})}
if(p==='/api/vouchers/validate'&&m==='POST')return json({success:false,message:'Voucher validation is unavailable in temporary offline mode.'},404);
return originalFetch(input,init)};
window.CA_SMART_OFFLINE={enabled:true,rooms,parking,settings,getBookings,saveBooking,clearBookings:()=>localStorage.removeItem(STORAGE_KEY)};
console.info('[CA Smart Staycation] Temporary offline API enabled.');
})();