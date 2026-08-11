const UNIT_GALLERY_API="https://ca-smart-staycation-muqd.onrender.com/api";
(function(){
  const css=`.unit-info-panel{margin-top:14px;padding:18px;border:1px solid #e2ddd5;border-radius:10px;background:#fff;width:100%;box-sizing:border-box;overflow:hidden}.unit-info-layout{display:block;width:100%;box-sizing:border-box}.unit-details{display:none}.unit-gallery{display:flex;flex-direction:column;align-items:stretch;width:100%;box-sizing:border-box}.unit-primary-photo{display:block;width:100%;height:auto;aspect-ratio:16/10;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid #ddd;box-sizing:border-box}.unit-photo-thumbs{display:flex;gap:7px;overflow-x:auto;margin-top:8px;padding-bottom:3px;width:100%;box-sizing:border-box}.unit-photo-thumbs img{width:62px;height:50px;object-fit:cover;border-radius:5px;border:1px solid #ddd;cursor:pointer;flex:0 0 auto}.unit-lightbox{position:fixed;inset:0;background:#000d;z-index:9999;display:flex;align-items:center;justify-content:center;padding:25px}.unit-lightbox img{max-width:94vw;max-height:88vh;object-fit:contain;border-radius:8px}.unit-lightbox button{position:absolute;right:22px;top:14px;background:none;border:0;color:#fff;font-size:42px;cursor:pointer}`;
  const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
  let units=[];
  function esc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]))}
  function openPhoto(url){const m=document.createElement('div');m.className='unit-lightbox';m.innerHTML=`<button type="button" aria-label="Close">×</button><img src="${esc(url)}" alt="Accommodation photo">`;m.querySelector('button').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove()};document.body.appendChild(m)}
  function selected(){const id=document.getElementById('room')?.value;return units.find(x=>String(x._id)===String(id))||null}
  function render(){
    const room=document.getElementById('room'),group=document.getElementById('roomGroup');if(!room||!group)return;
    let panel=document.getElementById('unitInfoPanel');if(!panel){panel=document.createElement('div');panel.id='unitInfoPanel';panel.className='unit-info-panel';group.appendChild(panel)}
    const u=selected();if(!u){panel.innerHTML='<p style="margin:0;color:#888">Select an accommodation to view photos.</p>';return}
    const images=Array.isArray(u.images)?u.images.filter(Boolean):[];const primary=images[0];
    panel.innerHTML=`<div class="unit-info-layout"><div class="unit-gallery">${primary?`<img class="unit-primary-photo" src="${esc(primary)}" alt="${esc(u.unitName||'Accommodation')}" data-photo="0"><div class="unit-photo-thumbs">${images.map((img,i)=>`<img src="${esc(img)}" alt="Photo ${i+1}" data-photo="${i}">`).join('')}</div>`:'<div style="display:flex;align-items:center;justify-content:center;min-height:230px;background:#f5f3ef;border-radius:8px;color:#888">No photos available</div>'}</div></div>`;
    panel.querySelectorAll('[data-photo]').forEach(el=>el.addEventListener('click',()=>openPhoto(images[Number(el.dataset.photo)])));
  }
  async function load(){try{const r=await fetch(`${UNIT_GALLERY_API}/rooms`,{cache:'no-store'}),j=await r.json();if(r.ok&&Array.isArray(j.data)){units=j.data;render()}}catch(e){console.warn('Unable to load accommodation photos',e)}}
  document.addEventListener('DOMContentLoaded',()=>{const room=document.getElementById('room');if(room)room.addEventListener('change',render);load()});
})();
