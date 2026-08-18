/* Guest Account inbox: messaging API + attachment rendering. */
(function(){
  'use strict';
  const API='/api';
  const auth=()=>({Authorization:`Bearer ${localStorage.getItem('guestAuthToken')||''}`,'Content-Type':'application/json'});
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  function attachmentMarkup(a){
    const url=typeof a?.url==='string'?a.url:(typeof a?.data==='string'?a.data:'');
    const name=String(a?.name||'Attachment');
    const type=String(a?.type||'').toLowerCase();
    if(!url)return '';
    const image=type.startsWith('image/')||/^data:image\//i.test(url)||/\.(jpe?g|png|webp|gif|bmp|svg)(?:$|[?#])/i.test(name)||/\.(jpe?g|png|webp|gif|bmp|svg)(?:$|[?#])/i.test(url);
    if(image)return `<a class="message-image-attachment" href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="${esc(name)}" loading="lazy" decoding="async"><span>${esc(name)}</span></a>`;
    return `<a class="message-file-attachment" href="${esc(url)}" target="_blank" rel="noopener">📎 ${esc(name)}</a>`;
  }
  function renderMessages(messages){
    const list=document.getElementById('messagesList');
    if(!list)return;
    list.innerHTML=(messages||[]).map(m=>`<div class="message ${esc(m.senderType||'')}" data-message-id="${esc(m._id||'')}"><small>${esc(m.senderName||m.senderType||'Guest')} · ${new Date(m.createdAt).toLocaleString('en-PH')}</small><div>${esc(m.message||'')}</div><div class="message-attachments">${(m.attachments||[]).map(attachmentMarkup).join('')}</div></div>`).join('')||'<div class="empty">No messages yet.</div>';
  }
  function updateBadge(messages){const badge=document.getElementById('messageBadge');if(!badge)return;const unread=(messages||[]).filter(m=>!m.readByGuest).length;badge.textContent=unread;badge.hidden=!unread;}
  async function loadGuestInboxDirect(){
    try{
      const response=await fetch(`${API}/guest/inbox`,{headers:auth(),cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||'Authentication required.');
      renderMessages(data.messages||[]);
      updateBadge(data.messages||[]);
      return data;
    }catch(error){console.warn('Guest inbox attachment loader:',error);return null;}
  }
  function keepMessagePanelOpen(){
    const bookings=document.getElementById('bookingsPanel');
    const notifications=document.getElementById('notificationPanel');
    const messages=document.getElementById('messagePanel');
    if(bookings)bookings.style.display='none';
    if(notifications){notifications.style.display='none';notifications.classList.remove('open');}
    if(messages){messages.style.display='block';messages.classList.add('open');}
    document.querySelectorAll('.tab-button').forEach(b=>b.classList.remove('active'));
    const inbox=document.getElementById('inboxBtn');
    if(inbox)inbox.classList.add('active');
  }
  async function sendGuestMessage(){
    const text=(document.getElementById('messageText')?.value||'').trim();
    const input=document.getElementById('messageFiles');
    const files=[...(input?.files||[])];
    if(!text&&!files.length){alert('Enter a message or attach a file.');return;}
    if(files.length>3){alert('You can attach up to 3 files.');return;}
    try{
      const attachments=await Promise.all(files.map(file=>new Promise((resolve,reject)=>{
        if(file.size>4*1024*1024){reject(new Error(`${file.name} is larger than 4 MB.`));return;}
        const reader=new FileReader();
        reader.onload=()=>resolve({name:file.name,type:file.type,data:reader.result});
        reader.onerror=()=>reject(new Error(`Unable to read ${file.name}.`));
        reader.readAsDataURL(file);
      })));
      const response=await fetch(`${API}/guest/messages`,{method:'POST',headers:auth(),body:JSON.stringify({message:text,attachments}),cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||'Unable to send message.');
      if(document.getElementById('messageText'))document.getElementById('messageText').value='';
      if(input)input.value='';
      await loadGuestInboxDirect();
      keepMessagePanelOpen();
    }catch(error){
      alert(error.message||'Unable to send message.');
      keepMessagePanelOpen();
    }
  }
  async function markInboxRead(){try{await fetch(`${API}/guest/inbox/read`,{method:'PUT',headers:auth(),cache:'no-store'});await loadGuestInboxDirect();}catch(error){console.warn('Guest inbox read status:',error);}}
  function install(){
    const send=document.getElementById('sendMessage');
    if(send){send.onclick=null;send.addEventListener('click',function(event){event.preventDefault();event.stopImmediatePropagation();sendGuestMessage();},true);}
    window.guestDashboardSendMessage=sendGuestMessage;
    window.guestDashboardMarkInboxRead=markInboxRead;
    document.addEventListener('click',function(event){const button=event.target.closest&&event.target.closest('#inboxBtn');if(button){setTimeout(function(){loadGuestInboxDirect();markInboxRead();},100);}},true);
    const style=document.createElement('style');style.textContent='.message-image-attachment{display:block;max-width:min(420px,100%);margin:8px 0;border:1px solid #d7e0dc;border-radius:8px;background:#fff;overflow:hidden;text-decoration:none;color:#0b5d4d}.message-image-attachment img{display:block;width:100%;height:auto;max-height:420px;object-fit:contain;background:#f7faf9}.message-image-attachment span{display:block;padding:7px 9px;font-size:12px;overflow-wrap:anywhere}.message-file-attachment{display:inline-block;margin:8px 6px 0 0;padding:7px 10px;border:1px solid #d7e0dc;border-radius:7px;background:#fff;color:#0b5d4d;text-decoration:none}';document.head.appendChild(style);
    loadGuestInboxDirect();
    setInterval(loadGuestInboxDirect,10000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();