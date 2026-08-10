(() => {
  const API = "https://ca-smart-staycation-muqd.onrender.com/api";
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
  const token = () => sessionStorage.getItem("caSmartAdminToken") || "";

  function injectStyles() {
    if ($("unitPhotoManagerStyles")) return;
    const s = document.createElement("style"); s.id = "unitPhotoManagerStyles";
    s.textContent = `
      .unit-photo-field{grid-column:1/-1}.unit-photo-upload{border:1px dashed #b9c8c1;border-radius:12px;padding:12px;background:#f8faf9}.unit-photo-upload input{width:100%}.unit-photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-top:10px}.unit-photo-item{position:relative;border:1px solid #d9e2dd;border-radius:8px;overflow:hidden;background:#fff;aspect-ratio:4/3}.unit-photo-item img{width:100%;height:100%;object-fit:cover}.unit-photo-item button{position:absolute;top:4px;right:4px;border:0;border-radius:50%;width:24px;height:24px;background:rgba(0,0,0,.65);color:#fff;cursor:pointer}.unit-photo-note{font-size:12px;color:#6b7772;margin:6px 0 0}.unit-save-actions{grid-column:1/-1!important;display:flex!important;justify-content:flex-end!important;gap:10px!important;margin-top:20px!important;padding-top:16px!important;border-top:1px solid #eee!important;visibility:visible!important;opacity:1!important}.unit-save-actions button{display:inline-flex!important;visibility:visible!important;opacity:1!important;align-items:center!important;justify-content:center!important;padding:11px 18px!important;min-height:42px!important;border-radius:7px!important;border:1px solid #ccc!important;cursor:pointer!important;font:inherit!important}.unit-save-actions .unit-save-btn{background:#173d32!important;color:#fff!important;border-color:#173d32!important;font-weight:600!important}.unit-save-actions .unit-cancel-btn{background:#fff!important;color:#222!important}
      .guest-unit-info{margin-top:12px;border:1px solid #d9e2dd;border-radius:14px;background:#fff;overflow:hidden;box-shadow:0 8px 24px rgba(20,45,36,.08)}.guest-unit-info[hidden]{display:none}.guest-unit-hero{width:100%;height:230px;object-fit:cover;display:block;background:#eef2f0}.guest-unit-body{padding:16px}.guest-unit-body h3{margin:0 0 5px;color:#173f35}.guest-unit-meta{font-size:13px;color:#6b7772;margin-bottom:10px}.guest-unit-desc{font-size:14px;line-height:1.55;color:#3f4b46;margin:8px 0}.guest-unit-amenities{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.guest-unit-amenities span{padding:5px 9px;border-radius:999px;background:#eef5f1;color:#31584b;font-size:11px}.guest-unit-thumbs{display:flex;gap:7px;overflow:auto;padding:9px 12px;border-top:1px solid #edf1ef}.guest-unit-thumbs button{border:2px solid transparent;padding:0;width:58px;height:44px;border-radius:6px;overflow:hidden;background:#fff;flex:0 0 auto;cursor:pointer}.guest-unit-thumbs button.active{border-color:#b38a3b}.guest-unit-thumbs img{width:100%;height:100%;object-fit:cover}
    `; document.head.appendChild(s);
  }

  const originalOpenForm = window.openForm;
  if (typeof originalOpenForm === "function") {
    window.openForm = function(type, item = null) {
      originalOpenForm(type, item);
      if (type !== "room") return;
      injectStyles();
      const form = $("resourceForm"); if (!form) return;

      const oldActions = form.querySelector(".form-actions");
      if (oldActions) oldActions.remove();

      const field = document.createElement("div"); field.className = "field full unit-photo-field";
      field.innerHTML = `<label>Accommodation Photos</label><div class="unit-photo-upload"><input id="unitPhotosInput" type="file" accept="image/jpeg,image/png,image/webp" multiple><p class="unit-photo-note">Upload multiple photos. The first photo is used as the main guest-facing photo. Images are resized automatically for reliable storage.</p><div id="unitPhotoGrid" class="unit-photo-grid"></div></div>`;
      form.appendChild(field);

      const actions = document.createElement("div");
      actions.className = "unit-save-actions";
      actions.innerHTML = `<button type="button" class="unit-cancel-btn" id="unitCancelBtn">Cancel</button><button type="submit" class="unit-save-btn" id="unitSaveBtn">${item ? "Save Changes" : "Save Unit"}</button>`;
      form.appendChild(actions);

      let photos = Array.isArray(item?.images) ? item.images.slice() : [];
      const grid = $("unitPhotoGrid");
      const render = () => { grid.innerHTML = photos.map((src,i)=>`<div class="unit-photo-item"><img src="${esc(src)}" alt="Accommodation photo ${i+1}"><button type="button" data-photo-index="${i}" aria-label="Remove photo">×</button></div>`).join("") || `<div class="unit-photo-note">No photos uploaded yet.</div>`; grid.querySelectorAll("[data-photo-index]").forEach(b=>b.onclick=()=>{photos.splice(Number(b.dataset.photoIndex),1);render()}); };
      render();
      $("unitPhotosInput").onchange = async e => { try { const files=[...e.target.files]; for(const f of files) photos.push(await resizeImage(f)); render(); e.target.value=""; } catch(err){ alert(err.message||"Unable to process image."); } };
      $("unitCancelBtn").onclick = () => { if(typeof closeModal === "function") closeModal(); };
      form.onsubmit = async e => {
        e.preventDefault();
        const saveBtn = $("unitSaveBtn");
        if(!token()){alert("Please sign in to the admin account first.");return;}
        if(saveBtn){saveBtn.disabled=true;saveBtn.textContent="Saving…"}
        try {
          const f=new FormData(form), body=Object.fromEntries(f.entries());
          body.price=Number(body.price); body.weekendPrice=Number(body.weekendPrice||0); body.holidayPrice=Number(body.holidayPrice||0); body.capacity=Number(body.capacity);
          body.amenities=String(body.amenities||"").split(",").map(x=>x.trim()).filter(Boolean); body.images=photos;
          const id = item?._id || window.editing?.id || null;
          const url=`${API}/rooms${id?`/${id}`:""}`;
          const r=await fetch(url,{method:id?"PUT":"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token()}`},body:JSON.stringify(body)});
          const j=await r.json(); if(!r.ok) throw Error(j.message||"Unable to save unit.");
          if(typeof closeModal === "function") closeModal();
          if(typeof load === "function") await load();
        } catch(err) { console.error(err); alert(err.message||"Unable to save unit."); }
        finally { if(saveBtn){saveBtn.disabled=false;saveBtn.textContent=item?"Save Changes":"Save Unit"} }
      };
    };
    const add=$("addRoomBtn"); if(add) add.onclick=()=>{if(typeof ensureAdmin === "function"&&ensureAdmin()) window.openForm("room")};
  }

  function resizeImage(file){
    return new Promise((resolve,reject)=>{if(!/^image\/(jpeg|png|webp)$/.test(file.type))return reject(Error("Photos must be JPG, PNG, or WEBP."));const reader=new FileReader();reader.onerror=()=>reject(Error("Unable to read image."));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(Error("Invalid image."));img.onload=()=>{const max=1000,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext("2d").drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL("image/jpeg",.78))};img.src=reader.result};reader.readAsDataURL(file)});
  }
  injectStyles();
})();
