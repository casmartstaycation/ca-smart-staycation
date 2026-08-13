/*
 * CA Smart Staycation - Temporary GitHub Pages Offline API Bridge
 * No Vercel/Render dependency while offline development is enabled.
 */
(function () {
  'use strict';
  const STORAGE_KEY = 'caSmartStaycationOfflineBookings';
  const rooms = [{
    _id:'unit-719', id:'unit-719', name:'Unit 719', unitName:'Unit 719', unitNumber:'719',
    title:'Studio Unit 719', type:'Studio', category:'Accommodation', tower:'Barbados Tower',
    floor:'7th Floor', roomNumber:'Room 19', location:'Azure North Pampanga',
    description:'Welcome to CA Smart Staycation Unit 719, located on the 7th Floor, Room 19 of Barbados Tower at Azure North Pampanga. Enjoy a comfortable and relaxing studio stay with convenient access to the amenities and attractions of Azure North. The unit accommodates up to 4 adults. Children ages 0–2 are not counted toward the guest limit.',
    price:2800, nightlyRate:2800, rate:2800, capacity:4, maxGuests:4, status:'Available', available:true,
    amenities:['Air Conditioning','Private Bathroom','Wi-Fi','Kitchen','Refrigerator','Microwave','Television','Keyless Entry','Hot Water','Bedroom','Dining Area'],
    images:['images/luxury-room-4.png'], photos:['images/luxury-room-4.png'], gallery:['images/luxury-room-4.png']
  }];
  const parking=[{_id:'parking-1',id:'parking-1',slot:'P1',name:'Parking Slot 1',label:'Parking Slot 1',status:'Available',available:true,price:500,nightlyRate:500,rate:500}];
  const defaultSettings={roomRate:2800,ROOM_RATE:2800,extraGuestFee:300,EXTRA_GUEST_FEE:300,parkingRate:500,PARKING_RATE:500,securityDeposit:1000,SECURITY_DEPOSIT:1000,maxGuests:4,MAX_GUESTS:4,maxFreeChildren:2,MAX_FREE_CHILDREN:2};
  function getBookings(){try{const stored=localStorage.getItem(STORAGE_KEY);if(!stored)return[];const parsed=JSON.parse(stored);return Array.isArray(parsed)?parsed:[]}catch(e){return[]}}
  function saveBookings(list){localStorage.setItem(STORAGE_KEY,JSON.stringify(list));}
  function saveBooking(body){const list=getBookings();const booking={...(body||{}),_id:body&&body._id?body._id:'offline-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),bookingReference:body&&body.bookingReference?body.bookingReference:'BK'+Date.now(),bookingStatus:body&&body.bookingStatus?body.bookingStatus:'Pending',offline:true,createdAt:new Date().toISOString(),documentsUploaded:false};list.push(booking);saveBookings(list);return booking}
  function updateBooking(id,patch){const list=getBookings();const index=list.findIndex(b=>String(b._id)===String(id));if(index<0)return null;list[index]={...list[index],...patch};saveBookings(list);return list[index]}
  function pathOf(input){try{return new URL(typeof input==='string'?input:(input&&input.url)||'',window.location.origin).pathname}catch(e){return String(input||'').split('?')[0]}}
  function jsonResponse(data,status){return new Response(JSON.stringify(data),{status:status||200,headers:{'Content-Type':'application/json'}})}
  const originalFetch=window.fetch.bind(window);
  window.CA_SMART_API='/api';
  window.fetch=async function(input,init){
    const path=pathOf(input),method=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase();
    if(path==='/api/rooms'){console.info('[CA Smart Staycation] Offline API: /api/rooms');return jsonResponse({success:true,rooms,data:rooms})}
    if(path==='/api/parking'){console.info('[CA Smart Staycation] Offline API: /api/parking');return jsonResponse({success:true,parking,slots:parking,data:parking})}
    if(path==='/api/settings'){console.info('[CA Smart Staycation] Offline API: /api/settings');return jsonResponse({success:true,settings:defaultSettings,data:defaultSettings})}
    if(path==='/api/health')return jsonResponse({status:'success',offline:true,database:'offline'});
    if(path==='/api/vouchers/validate'&&method==='POST')return jsonResponse({success:false,message:'Voucher validation is unavailable in temporary offline mode.'},404);
    if(path==='/api/bookings'){
      console.info('[CA Smart Staycation] Offline API: /api/bookings');
      if(method==='GET'){const data=getBookings();return jsonResponse({success:true,bookings:data,data})}
      if(['POST','PUT','PATCH'].includes(method)){
        let body={};try{body=JSON.parse((init&&init.body)||'{}')}catch(e){}
        const booking=saveBooking(body);return jsonResponse({success:true,offline:true,message:'Booking saved temporarily on this device.',booking,data:booking},201)
      }
    }
    const documentMatch=path.match(/^\/api\/bookings\/([^/]+)\/documents$/);
    if(documentMatch&&['POST','PUT','PATCH'].includes(method)){
      const id=decodeURIComponent(documentMatch[1]);
      const existing=getBookings().find(b=>String(b._id)===String(id));
      if(!existing)return jsonResponse({success:false,message:'Offline booking not found.'},404);
      const updated=updateBooking(id,{documentsUploaded:true,governmentIdUploaded:true,driverLicenseUploaded:true});
      return jsonResponse({success:true,offline:true,message:'Documents recorded locally for this offline booking.',data:updated},200)
    }
    return originalFetch(input,init);
  };
  window.CA_SMART_OFFLINE={enabled:true,rooms,parking,settings:defaultSettings,getBookings,saveBooking,clearBookings:()=>localStorage.removeItem(STORAGE_KEY)};
  console.info('[CA Smart Staycation] Temporary offline API enabled.');
})();