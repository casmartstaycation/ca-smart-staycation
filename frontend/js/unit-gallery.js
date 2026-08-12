const UNIT_GALLERY_API="https://ca-smart-staycation-muqd.onrender.com/api";
(function(){
  const css=`
    .unit-info-panel{display:block;position:relative;clear:both;margin-top:18px;padding:0;width:100%;max-width:100%;min-width:0;box-sizing:border-box;overflow:visible}
    .unit-gallery{display:flex;flex-direction:column;align-items:stretch;position:relative;width:100%;max-width:100%;min-width:0;box-sizing:border-box;overflow:hidden}
    .unit-primary-photo{display:block;position:relative;width:100%;max-width:100%;height:auto;aspect-ratio:21/9;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid #ddd;box-sizing:border-box}
    .unit-photo-thumbs{display:flex;gap:8px;overflow-x:auto;margin-top:10px;padding-bottom:3px;width:100%;max-width:100%;box-sizing:border-box}
    .unit-photo-thumbs img{width:76px;height:58px;object-fit:cover;border-radius:5px;border:1px solid #ddd;cursor:pointer;flex:0 0 auto}
    .unit-description{margin-top:16px;padding:18px;border:1px solid #e2ddd5;border-radius:8px;background:#fff;box-sizing:border-box;width:100%;max-width:100%;min-width:0;overflow:hidden}
    .unit-description h3,.unit-amenities h3{margin:0 0 7px;font-size:20px}
    .unit-description p{margin:0;line-height:1.6;color:#555;white-space:pre-line;overflow-wrap:anywhere;word-break:break-word}
    .unit-amenities{margin-top:12px;padding:18px;border:1px solid #e2ddd5;border-radius:8px;background:#fff;box-sizing:border-box;width:100%;max-width:100%;min-width:0;overflow:hidden}
    .unit-amenity-list{display:flex;flex-wrap:wrap;gap:8px;min-width:0}
    .unit-amenity{padding:7px 10px;border:1px solid #ddd;border-radius:6px;background:#f8f6f2;font-size:13px;color:#444;max-width:100%;overflow-wrap:anywhere}
    .unit-lightbox{position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;background:#000d;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;overflow:hidden}
    .unit-lightbox img{display:block;width:auto;max-width:94vw;max-height:88vh;max-height:88dvh;height:auto;object-fit:contain;border-radius:8px}
    .unit-lightbox button{position:absolute;background:none;border:0;color:#fff;cursor:pointer}
    .unit-lightbox .unit-close{right:22px;top:14px;font-size:42px}
    .unit-lightbox .unit-nav{top:50%;transform:translateY(-50%);font-size:52px;padding:12px 18px}
    .unit-lightbox .unit-prev{left:12px}.unit-lightbox .unit-next{right:12px}
    @media(max-width:700px){
      .unit-info-panel{display:block;position:relative;clear:both;float:none;left:auto;right:auto;top:auto;bottom:auto;transform:none;margin:14px 0 0;padding:0;width:100%;max-width:100%;min-width:0;grid-column:auto;box-sizing:border-box;overflow:visible}
      .unit-gallery{display:flex;position:relative;float:none;left:auto;right:auto;top:auto;bottom:auto;transform:none;width:100%;max-width:100%;min-width:0;height:auto;box-sizing:border-box;overflow:hidden}
      .unit-primary-photo{display:block;position:relative;left:auto;right:auto;top:auto;bottom:auto;transform:none;width:100%;max-width:100%;height:auto;max-height:240px;aspect-ratio:16/10;object-fit:cover;box-sizing:border-box;margin:0}
      .unit-photo-thumbs{display:flex;position:relative;left:auto;right:auto;width:100%;max-width:100%;min-width:0;height:64px;max-height:64px;overflow-x:auto;overflow-y:hidden;flex-wrap:nowrap;box-sizing:border-box}
      .unit-photo-thumbs img{width:68px;min-width:68px;max-width:68px;height:52px;max-height:52px;flex:0 0 68px}
      .unit-description,.unit-amenities{width:100%;max-width:100%;min-width:0;box-sizing:border-box;overflow:hidden;overflow-wrap:anywhere}
    }
    @media(max-width:340px){
      .unit-primary-photo{max-height:210px}
      .unit-photo-thumbs img{width:60px;min-width:60px;max-width:60px;flex-basis:60px}
    }
  `;
  const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
  let units=[];
  const CACHE_KEY='caSmartStaycationRoomsGallery';
  const CACHE_TTL=5*60*1000;
  function esc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]))}
  function isParkingOnly(){return String(document.getElementById('bookingType')?.value||'').toLowerCase()==='parking'}
  function openPhoto(images,startIndex){
    if(!images.length)return;
    let index=startIndex;
    const m=document.createElement('div');m.className='unit-lightbox';
    m.innerHTML=`<button type="button" class="unit-close" aria-label="Close">×</button><button type="button" class="unit-nav unit-prev" aria-label="Previous photo">‹</button><img alt="Accommodation photo"><button type="button" class="unit-nav unit-next" aria-label="Next photo">›</button>`;
    const img=m.querySelector('img');
    const show=()=>{index=(index+images.length)%images.length;img.src=images[index];img.alt=`Accommodation photo ${index+1} of ${images.length}`};
    const close=()=>{document.removeEventListener('keydown',keyHandler);m.remove()};
    const keyHandler=e=>{if(!document.body.contains(m))return;if(e.key==='ArrowLeft'){e.preventDefault();index--;show()}else if(e.key==='ArrowRight'){e.preventDefault();index++;show()}else if(e.key==='Escape'){e.preventDefault();close()}};
    m.querySelector('.unit-prev').onclick=e=>{e.stopPropagation();index--;show()};
    m.querySelector('.unit-next').onclick=e=>{e.stopPropagation();index++;show()};
    m.querySelector('.unit-close').onclick=close;
    m.onclick=e=>{if(e.target===m)close()};
    document.addEventListener('keydown',keyHandler);
    document.body.appendChild(m);show();
  }
  function selected(){const id=document.getElementById('room')?.value;return units.find(x=>String(x._id)===String(id))||null}
  function getPanel(){
    let panel=document.getElementById('unitInfoPanel');
    if(panel)return panel;
    const group=document.getElementById('roomGroup');if(!group)return null;
    panel=document.createElement('div');panel.id='unitInfoPanel';panel.className='unit-info-panel';
    const formGrid=group.closest('.form-grid');
    const formCard=formGrid?.closest('.form-card');
    /* Keep the gallery OUTSIDE the CSS grid. The previous implementation made
       the gallery a grid item beside the calendar, which caused mobile overlap. */
    if(formGrid&&formCard){
      formGrid.insertAdjacentElement('afterend',panel);
    } else if(group.parentElement){
      group.parentElement.insertAdjacentElement('afterend',panel);
    }
    return panel;
  }
  function render(){
    const room=document.getElementById('room');if(!room)return;
    const panel=getPanel();if(!panel)return;
    if(isParkingOnly()){panel.style.display='none';return}
    panel.style.display='block';
    const u=selected();
    if(!u){panel.innerHTML='<p style="margin:0;color:#888">Select an accommodation to view photos.</p>';return}
    const images=Array.isArray(u.images)?u.images.map(x=>typeof x==='string'?x:x?.url).filter(Boolean):[];
    const primary=images[0];
    const amenities=Array.isArray(u.amenities)?u.amenities.filter(Boolean):[];
    panel.innerHTML=`<div class="unit-gallery">${primary?`<img class="unit-primary-photo" loading="lazy" src="${esc(primary)}" alt="${esc(u.unitName||u.name||'Accommodation')}" data-photo="0"><div class="unit-photo-thumbs">${images.map((img,i)=>`<img loading="lazy" src="${esc(img)}" alt="Photo ${i+1}" data-photo="${i}">`).join('')}</div>`:'<div style="display:flex;align-items:center;justify-content:center;min-height:220px;background:#f5f3ef;border-radius:8px;color:#888">No photos available</div>'}<div class="unit-description"><h3>${esc(u.unitName||u.name||u.unitNumber||'Selected Unit')}</h3><p>${esc(u.description||'No description available for this accommodation.')}</p></div>${amenities.length?`<div class="unit-amenities"><h3>Amenities</h3><div class="unit-amenity-list">${amenities.map(a=>`<span class="unit-amenity">${esc(a)}</span>`).join('')}</div></div>`:''}</div>`;
    panel.querySelectorAll('[data-photo]').forEach(el=>el.addEventListener('click',()=>openPhoto(images,Number(el.dataset.photo))));
  }
  function useCached(){
    try{const raw=sessionStorage.getItem(CACHE_KEY);if(!raw)return false;const cached=JSON.parse(raw);if(!cached?.timestamp||Date.now()-cached.timestamp>CACHE_TTL||!Array.isArray(cached.data))return false;units=cached.data;render();return true}catch{return false}
  }
  async function load(){
    if(isParkingOnly())return;
    if(useCached())return;
    try{
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
      const r=await fetch(`${UNIT_GALLERY_API}/rooms`,{cache:'no-store',signal:controller.signal});clearTimeout(timer);
      const j=await r.json();
      if(r.ok&&Array.isArray(j.data)){units=j.data;try{sessionStorage.setItem(CACHE_KEY,JSON.stringify({timestamp:Date.now(),data:units}))}catch{}render()}
    }catch(e){console.warn('Unable to load accommodation photos',e)}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const room=document.getElementById('room');const type=document.getElementById('bookingType');
    if(room)room.addEventListener('change',render);
    if(type)type.addEventListener('change',()=>{const panel=document.getElementById('unitInfoPanel');if(String(type.value).toLowerCase()==='parking'){if(panel)panel.style.display='none'}else{load();render()}});
    if(!isParkingOnly())load();
  });
})();
