const UNIT_GALLERY_API="https://ca-smart-staycation-muqd.onrender.com/api";
(function(){
  const css=`
    .unit-info-panel{margin-top:18px;padding:0;width:100%;box-sizing:border-box;grid-column:1/-1}
    .unit-gallery{display:flex;flex-direction:column;align-items:stretch;width:100%;box-sizing:border-box}
    .unit-primary-photo{display:block;width:100%;height:auto;aspect-ratio:21/9;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid #ddd;box-sizing:border-box}
    .unit-photo-thumbs{display:flex;gap:8px;overflow-x:auto;margin-top:10px;padding-bottom:3px;width:100%;box-sizing:border-box}
    .unit-photo-thumbs img{width:76px;height:58px;object-fit:cover;border-radius:5px;border:1px solid #ddd;cursor:pointer;flex:0 0 auto}
    .unit-description{margin-top:16px;padding:18px;border:1px solid #e2ddd5;border-radius:8px;background:#fff}
    .unit-description h3,.unit-amenities h3{margin:0 0 7px;font-size:20px}
    .unit-description p{margin:0;line-height:1.6;color:#555;white-space:pre-line;overflow-wrap:anywhere}
    .unit-amenities{margin-top:12px;padding:18px;border:1px solid #e2ddd5;border-radius:8px;background:#fff}
    .unit-amenity-list{display:flex;flex-wrap:wrap;gap:8px}
    .unit-amenity{padding:7px 10px;border:1px solid #ddd;border-radius:6px;background:#f8f6f2;font-size:13px;color:#444}
    .unit-lightbox{position:fixed;inset:0;background:#000d;z-index:9999;display:flex;align-items:center;justify-content:center;padding:25px}
    .unit-lightbox img{max-width:94vw;max-height:88vh;object-fit:contain;border-radius:8px}
    .unit-lightbox button{position:absolute;background:none;border:0;color:#fff;cursor:pointer}
    .unit-lightbox .unit-close{right:22px;top:14px;font-size:42px}
    .unit-lightbox .unit-nav{top:50%;transform:translateY(-50%);font-size:52px;padding:12px 18px}
    .unit-lightbox .unit-prev{left:12px}.unit-lightbox .unit-next{right:12px}
    #calendarGrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;width:100%;min-height:340px}
    #calendarGrid .calendar-day{display:flex;align-items:center;justify-content:center;width:100%;min-height:42px;aspect-ratio:1/1;border:1px solid #ded7c5;border-radius:8px;background:#fff;color:#18332d;font:600 14px Arial,sans-serif;cursor:pointer;padding:0}
    #calendarGrid .calendar-day.empty{border:0;background:transparent;cursor:default}
    #calendarGrid .calendar-day.disabled{color:#aaa;background:#f3f3f3;cursor:not-allowed}
    #calendarGrid .calendar-day.booked{background:#d9534f;color:#fff;cursor:not-allowed;opacity:.75}
    #calendarGrid .calendar-day.checkin,#calendarGrid .calendar-day.checkout{background:#063b32;color:#fff;border-color:#063b32}
    #calendarGrid .calendar-day.selected-range{background:#d9f2ec;color:#18332d}
    #calendarGrid .calendar-day.today{border:2px solid #c9a44c}
    @media(max-width:700px){.unit-primary-photo{aspect-ratio:16/10}.unit-info-panel{margin-top:14px}#calendarGrid{gap:5px}.calendar-day{min-height:38px}}
  `;
  const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
  let units=[];
  const CACHE_KEY='caSmartStaycationRoomsGallery';
  const CACHE_TTL=5*60*1000;
  function esc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]))}
  function isParkingOnly(){return String(document.getElementById('bookingType')?.value||'').toLowerCase()==='parking'}
  function normalizeImage(value){
    if(!value)return '';
    const s=String(value).trim();
    if(/^https?:\/\//i.test(s)||s.startsWith('data:'))return s;
    if(s.startsWith('/'))return `${UNIT_GALLERY_API.replace(/\/api$/,'')}${s}`;
    if(s.startsWith('uploads/'))return `${UNIT_GALLERY_API.replace(/\/api$/,'')}/${s}`;
    return `${UNIT_GALLERY_API.replace(/\/api$/,'')}/uploads/${s}`;
  }
  function openPhoto(images,startIndex){
    if(!images.length)return;
    let index=startIndex;
    const m=document.createElement('div');m.className='unit-lightbox';
    m.innerHTML=`<button type="button" class="unit-close" aria-label="Close">×</button><button type="button" class="unit-nav unit-prev" aria-label="Previous photo">‹</button><img alt="Accommodation photo"><button type="button" class="unit-nav unit-next" aria-label="Next photo">›</button>`;
    const img=m.querySelector('img');
    const show=()=>{index=(index+images.length)%images.length;img.src=images[index];img.alt=`Accommodation photo ${index+1} of ${images.length}`};
    const close=()=>{document.removeEventListener('keydown',keyHandler);m.remove()};
    const keyHandler=e=>{if(!document.body.contains(m))return;if(e.key==='ArrowLeft'){e.preventDefault();index--;show()}else if(e.key==='ArrowRight'){e.preventDefault();index++;show()}else if(e.key==='Escape'){e.preventDefault();close()}};
    m.querySelector('.unit-prev').onclick=e=>{e.stopPropagation();index--;show()};m.querySelector('.unit-next').onclick=e=>{e.stopPropagation();index++;show()};m.querySelector('.unit-close').onclick=close;m.onclick=e=>{if(e.target===m)close()};document.addEventListener('keydown',keyHandler);document.body.appendChild(m);show();
  }
  function selected(){const id=document.getElementById('room')?.value;return units.find(x=>String(x._id)===String(id))||null}
  function getPanel(){
    let panel=document.getElementById('unitInfoPanel');if(panel)return panel;
    const group=document.getElementById('roomGroup');if(!group)return null;
    panel=document.createElement('div');panel.id='unitInfoPanel';panel.className='unit-info-panel';
    const formGrid=group.closest('.form-grid');const calendarGroup=formGrid?.querySelector('#calendarGrid')?.closest('.form-group');
    if(formGrid&&calendarGroup)formGrid.insertBefore(panel,calendarGroup);else if(formGrid)formGrid.appendChild(panel);else group.parentElement.appendChild(panel);return panel;
  }
  function render(){
    const room=document.getElementById('room');if(!room)return;const panel=getPanel();if(!panel)return;
    if(isParkingOnly()){panel.style.display='none';return}panel.style.display='';const u=selected();
    if(!u){panel.innerHTML='<p style="margin:0;color:#888">Select an accommodation to view photos.</p>';return}
    const images=Array.isArray(u.images)?u.images.map(x=>normalizeImage(typeof x==='string'?x:x?.url)).filter(Boolean):[];
    const amenities=Array.isArray(u.amenities)?u.amenities.filter(Boolean):[];
    panel.innerHTML=`<div class="unit-gallery">${images.length?`<img class="unit-primary-photo" loading="lazy" src="${esc(images[0])}" alt="${esc(u.unitName||u.name||'Accommodation')}" data-photo="0"><div class="unit-photo-thumbs">${images.map((img,i)=>`<img loading="lazy" src="${esc(img)}" alt="Photo ${i+1}" data-photo="${i}">`).join('')}</div>`:'<div style="display:flex;align-items:center;justify-content:center;min-height:300px;background:#f5f3ef;border-radius:8px;color:#888">No photos available</div>'}<div class="unit-description"><h3>${esc(u.unitName||u.name||u.unitNumber||'Selected Unit')}</h3><p>${esc(u.description||'No description available for this accommodation.')}</p></div>${amenities.length?`<div class="unit-amenities"><h3>Amenities</h3><div class="unit-amenity-list">${amenities.map(a=>`<span class="unit-amenity">${esc(a)}</span>`).join('')}</div></div>`:''}</div>`;
    panel.querySelectorAll('[data-photo]').forEach(el=>el.addEventListener('click',()=>openPhoto(images,Number(el.dataset.photo))));
  }
  function useCached(){try{const raw=sessionStorage.getItem(CACHE_KEY);if(!raw)return false;const cached=JSON.parse(raw);if(!cached?.timestamp||Date.now()-cached.timestamp>CACHE_TTL||!Array.isArray(cached.data))return false;units=cached.data;render();return true}catch{return false}}
  async function load(){if(isParkingOnly())return;if(useCached())return;try{const r=await fetch(`${UNIT_GALLERY_API}/rooms`,{cache:'no-store'}),j=await r.json();if(r.ok&&Array.isArray(j.data)){units=j.data;try{sessionStorage.setItem(CACHE_KEY,JSON.stringify({timestamp:Date.now(),data:units}))}catch{}render()}}catch(e){console.warn('Unable to load accommodation photos',e)}}

  /* Calendar fallback: independently renders the date grid even if the main booking script changes. */
  let calendarBookings=[];let calendarMonth=new Date().getMonth();let calendarYear=new Date().getFullYear();let selectedIn=null;let selectedOut=null;
  const dOnly=v=>{if(!v)return null;const s=String(v);let d;if(/^\d{4}-\d{2}-\d{2}/.test(s))d=new Date(+s.slice(0,4),+s.slice(5,7)-1,+s.slice(8,10));else d=new Date(v);if(Number.isNaN(d.getTime()))return null;d.setHours(0,0,0,0);return d};
  const bookedFor=d=>{const type=String(document.getElementById('bookingType')?.value||'unit').toLowerCase(),rid=String(document.getElementById('room')?.value||'');for(const b of calendarBookings){if(['Cancelled','Checked Out','Expired'].includes(String(b?.bookingStatus||'')))continue;const a=dOnly(b.checkIn),z=dOnly(b.checkOut);if(!a||!z||d<a||d>=z)continue;const br=String(b?.room?._id||b?.room||'');const bp=!!(b?.parking?._id||b?.parking);if(type==='parking'&&bp)return true;if(type==='both'&&((br&&br===rid)||bp))return true;if(type!=='parking'&&type!=='both'&&br&&br===rid)return true}return false};
  function renderCalendarFallback(){const grid=document.getElementById('calendarGrid'),title=document.getElementById('calendarTitle');if(!grid||!title)return;const first=new Date(calendarYear,calendarMonth,1),last=new Date(calendarYear,calendarMonth+1,0),today=new Date();today.setHours(0,0,0,0);title.textContent=first.toLocaleString('en-US',{month:'long',year:'numeric'});grid.innerHTML='';for(let i=0;i<first.getDay();i++){const e=document.createElement('div');e.className='calendar-day empty';grid.appendChild(e)}for(let n=1;n<=last.getDate();n++){const d=new Date(calendarYear,calendarMonth,n);d.setHours(0,0,0,0);const c=document.createElement('button');c.type='button';c.className='calendar-day';c.textContent=n;if(d<today){c.classList.add('disabled');c.disabled=true}else if(bookedFor(d)){c.classList.add('booked');c.disabled=true}else{if(selectedIn&&d.getTime()===selectedIn.getTime())c.classList.add('checkin');if(selectedOut&&d.getTime()===selectedOut.getTime())c.classList.add('checkout');if(selectedIn&&selectedOut&&d>selectedIn&&d<selectedOut)c.classList.add('selected-range');c.onclick=()=>{if(!selectedIn||selectedOut||d<=selectedIn){selectedIn=new Date(d);selectedOut=null}else{let blocked=false,t=new Date(selectedIn);t.setDate(t.getDate()+1);while(t<d){if(bookedFor(t)){blocked=true;break}t.setDate(t.getDate()+1)}if(blocked){selectedIn=new Date(d);selectedOut=null}else selectedOut=new Date(d)};const ci=document.getElementById('checkIn'),co=document.getElementById('checkOut');if(ci)ci.value=selectedIn?`${selectedIn.getFullYear()}-${String(selectedIn.getMonth()+1).padStart(2,'0')}-${String(selectedIn.getDate()).padStart(2,'0')}`:'';if(co)co.value=selectedOut?`${selectedOut.getFullYear()}-${String(selectedOut.getMonth()+1).padStart(2,'0')}-${String(selectedOut.getDate()).padStart(2,'0')}`:'';if(typeof window.calculateTotal==='function')window.calculateTotal();renderCalendarFallback()}}if(d.getTime()===today.getTime())c.classList.add('today');grid.appendChild(c)}}
  async function loadCalendar(){try{const r=await fetch(`${UNIT_GALLERY_API}/bookings`,{cache:'no-store'}),j=await r.json();calendarBookings=Array.isArray(j.data)?j.data:[]}catch{calendarBookings=[]}renderCalendarFallback()}

  document.addEventListener('DOMContentLoaded',()=>{const room=document.getElementById('room'),type=document.getElementById('bookingType');if(room)room.addEventListener('change',()=>{render();loadCalendar()});if(type)type.addEventListener('change',()=>{const panel=document.getElementById('unitInfoPanel');if(String(type.value).toLowerCase()==='parking'){if(panel)panel.style.display='none'}else{load();render()}selectedIn=null;selectedOut=null;loadCalendar()});document.getElementById('prevMonth')?.addEventListener('click',()=>{calendarMonth--;if(calendarMonth<0){calendarMonth=11;calendarYear--}renderCalendarFallback()});document.getElementById('nextMonth')?.addEventListener('click',()=>{calendarMonth++;if(calendarMonth>11){calendarMonth=0;calendarYear++}renderCalendarFallback()});if(!isParkingOnly())load();renderCalendarFallback();loadCalendar()});
})();
