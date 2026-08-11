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
    @media(max-width:700px){.unit-primary-photo{aspect-ratio:16/10}.unit-info-panel{margin-top:14px}}
  `;
  const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
  let units=[];
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
  function render(){
    const room=document.getElementById('room'),group=document.getElementById('roomGroup');if(!room||!group)return;
    let panel=document.getElementById('unitInfoPanel');
    if(!panel){panel=document.createElement('div');panel.id='unitInfoPanel';panel.className='unit-info-panel';const formGrid=group.closest('.form-grid');if(formGrid&&formGrid.parentElement)formGrid.parentElement.insertBefore(panel,formGrid.nextSibling);else group.parentElement.appendChild(panel)}
    if(isParkingOnly()){panel.style.display='none';return}
    panel.style.display='';
    const u=selected();
    if(!u){panel.innerHTML='<p style="margin:0;color:#888">Select an accommodation to view photos.</p>';return}
    const images=Array.isArray(u.images)?u.images.map(x=>typeof x==='string'?x:x?.url).filter(Boolean):[];
    const primary=images[0];
    const amenities=Array.isArray(u.amenities)?u.amenities.filter(Boolean):[];
    panel.innerHTML=`<div class="unit-gallery">${primary?`<img class="unit-primary-photo" src="${esc(primary)}" alt="${esc(u.unitName||u.name||'Accommodation')}" data-photo="0"><div class="unit-photo-thumbs">${images.map((img,i)=>`<img src="${esc(img)}" alt="Photo ${i+1}" data-photo="${i}">`).join('')}</div>`:'<div style="display:flex;align-items:center;justify-content:center;min-height:300px;background:#f5f3ef;border-radius:8px;color:#888">No photos available</div>'}<div class="unit-description"><h3>${esc(u.unitName||u.name||u.unitNumber||'Selected Unit')}</h3><p>${esc(u.description||'No description available for this accommodation.')}</p></div>${amenities.length?`<div class="unit-amenities"><h3>Amenities</h3><div class="unit-amenity-list">${amenities.map(a=>`<span class="unit-amenity">${esc(a)}</span>`).join('')}</div></div>`:''}</div>`;
    panel.querySelectorAll('[data-photo]').forEach(el=>el.addEventListener('click',()=>openPhoto(images,Number(el.dataset.photo))));
  }
  async function load(){try{const r=await fetch(`${UNIT_GALLERY_API}/rooms`,{cache:'no-store'}),j=await r.json();if(r.ok&&Array.isArray(j.data)){units=j.data;render()}}catch(e){console.warn('Unable to load accommodation photos',e)}}
  document.addEventListener('DOMContentLoaded',()=>{
    const room=document.getElementById('room');
    const type=document.getElementById('bookingType');
    if(room)room.addEventListener('change',render);
    if(type)type.addEventListener('change',render);
    load();
  });
})();
