(() => {
  const API = "https://ca-smart-staycation-muqd.onrender.com/api";
  const token = () => sessionStorage.getItem("caSmartAdminToken") || "";
  const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });

  function addTab() {
    const nav = document.querySelector(".admin-nav");
    if (!nav || document.getElementById("voucherManagementTab")) return;
    const resources = Array.from(nav.querySelectorAll("a")).find(a => /Units & Parking Management/i.test(a.textContent));
    const tab = document.createElement("a");
    tab.id = "voucherManagementTab";
    tab.href = "#voucherManagement";
    tab.textContent = "Voucher Management";
    tab.className = "voucher-management-tab";
    if (resources) resources.insertAdjacentElement("afterend", tab); else nav.appendChild(tab);
    tab.addEventListener("click", e => { e.preventDefault(); showTab(true); });
  }

  function addStyles() {
    if (document.getElementById("voucherTabStyles")) return;
    const s = document.createElement("style"); s.id = "voucherTabStyles";
    s.textContent = `.voucher-management-tab{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 14px;border-radius:7px;background:#eef3f0;color:#173f35;border:1px solid #d7e1dc;text-decoration:none;font-weight:700}.voucher-management-tab.active{background:#173f35;color:#fff;border-color:#173f35}#voucherAdminCard.voucher-tab-panel{display:none!important;margin-top:18px}#voucherAdminCard.voucher-tab-panel.active{display:block!important}.voucher-delete-btn{background:#fff!important;color:#a1261f!important;border:1px solid #d9b1ad!important}.voucher-delete-btn:hover{background:#fff4f3!important}`;
    document.head.appendChild(s);
  }

  function getCard() { return document.getElementById("voucherAdminCard"); }

  function showTab(active) {
    const card = getCard();
    const tab = document.getElementById("voucherManagementTab");
    if (!card || !tab) return;
    card.classList.add("voucher-tab-panel");
    card.classList.toggle("active", !!active);
    tab.classList.toggle("active", !!active);
    if (active) {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(addDeleteButtons, 100);
      setTimeout(replaceCertificateButtons, 120);
    }
  }

  function hideTab() {
    const card = getCard();
    const tab = document.getElementById("voucherManagementTab");
    if (card) { card.classList.add("voucher-tab-panel"); card.classList.remove("active"); }
    if (tab) tab.classList.remove("active");
  }

  async function deleteVoucher(id, code) {
    if (!confirm(`Delete voucher ${code}? This cannot be undone.`)) return;
    try {
      const r = await fetch(`${API}/vouchers/${id}`, { method: "DELETE", headers: headers() });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Unable to delete voucher.");
      const refresh = window.loadAdminVouchers;
      if (typeof refresh === "function") await refresh();
      setTimeout(addDeleteButtons, 100);
      setTimeout(replaceCertificateButtons, 120);
    } catch (e) { alert(e.message || "Unable to delete voucher."); }
  }

  function addDeleteButtons() {
    const list = document.getElementById("voucherAdminList");
    if (!list) return;
    list.querySelectorAll(".voucher-admin-item").forEach(row => {
      if (row.querySelector(".voucher-delete-btn")) return;
      const buttons = row.querySelectorAll("button[data-voucher-id]");
      const id = buttons[0]?.dataset.voucherId;
      if (!id) return;
      row.dataset.voucherId = id;
      const code = row.querySelector("strong")?.textContent?.trim() || "this voucher";
      const actions = row.querySelector(".voucher-admin-actions");
      if (!actions) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "voucher-delete-btn";
      btn.textContent = "Delete";
      btn.addEventListener("click", () => deleteVoucher(id, code));
      actions.appendChild(btn);
    });
  }

  /*
   * The generated certificate is created by voucher-admin.js.  Its original
   * Generate Certificate handler is attached inside that file's closure, so
   * changing a separate certificate helper does not affect the actual button.
   * We therefore replace each generated button after the voucher list renders.
   * The replacement keeps the voucher data/API behavior but uses a visibly
   * different, elegant European hotel certificate frame.
   */
  function loadQr(text) {
    return new Promise((resolve, reject) => {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => resolve(img); img.onerror = () => reject(new Error("Unable to load QR code."));
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(text)}`;
    });
  }

  function drawCertificate(v, guest) {
    return loadQr("https://casmartstaycation.github.io/cassbooking/").then(qr => {
      const c = document.createElement("canvas"), x = c.getContext("2d");
      c.width = 1600; c.height = 760;
      x.fillStyle = "#f8f3e8"; x.fillRect(0, 0, c.width, c.height);

      // New certificate border: ivory field + double emerald/gold frame +
      // corner medallions and fine inner keyline. This is intentionally
      // different from the previous solid emerald royal border.
      x.strokeStyle = "#123d32"; x.lineWidth = 22; x.strokeRect(22, 22, 1556, 716);
      x.strokeStyle = "#c8a34d"; x.lineWidth = 4; x.strokeRect(43, 43, 1514, 674);
      x.strokeStyle = "#123d32"; x.lineWidth = 1.5; x.strokeRect(53, 53, 1494, 654);
      x.strokeStyle = "#d6b867"; x.lineWidth = 1; x.strokeRect(60, 60, 1480, 640);

      function corner(px, py, rot) {
        x.save(); x.translate(px, py); x.rotate(rot);
        x.strokeStyle = "#b38a35"; x.fillStyle = "#c8a34d"; x.lineWidth = 2;
        x.beginPath(); x.moveTo(0,0); x.bezierCurveTo(18,3,30,14,39,32); x.bezierCurveTo(51,18,65,10,88,9); x.bezierCurveTo(69,24,58,43,53,65); x.bezierCurveTo(35,48,20,36,0,32); x.stroke();
        x.beginPath(); x.moveTo(8,8); x.bezierCurveTo(27,13,38,26,45,47); x.bezierCurveTo(57,31,69,23,82,20); x.stroke();
        x.beginPath(); x.arc(43,16,4,0,Math.PI*2); x.fill(); x.restore();
      }
      corner(64,64,0); corner(1536,64,Math.PI/2); corner(1536,696,Math.PI); corner(64,696,-Math.PI/2);

      x.textAlign = "center";
      x.fillStyle = "#123d32"; x.font = "bold 21px Georgia"; x.fillText("CA SMART STAYCATION", 800, 112);
      x.fillStyle = "#a77d2d"; x.font = "13px Georgia"; x.fillText("SPECIAL GUEST PRIVILEGE", 800, 136);
      x.fillStyle = "#123d32"; x.font = "bold 47px Georgia"; x.fillText(v.certificateTitle || "SPECIAL GUEST VOUCHER", 800, 205);
      x.fillStyle = "#a77d2d"; x.font = "bold 60px Georgia"; x.fillText(`${v.discountPercent}% OFF`, 800, 282);
      x.fillStyle = "#535b56"; x.font = "21px Georgia"; x.fillText("Presented exclusively to", 800, 326);
      x.fillStyle = "#123d32"; x.font = "bold 40px Georgia"; x.fillText(guest || "Special Guest", 800, 378);
      x.fillStyle = "#a77d2d"; x.font = "bold 18px Arial"; x.fillText(`VOUCHER CODE  •  ${v.code}`, 800, 426);
      x.fillStyle = "#535b56"; x.font = "17px Arial"; x.fillText(v.maxNights ? `Valid for up to ${v.maxNights} night${v.maxNights === 1 ? "" : "s"}` : "No night limit", 800, 458);
      x.fillText(v.expiresAt ? `Valid until ${new Date(v.expiresAt).toLocaleDateString("en-PH", {year:"numeric",month:"long",day:"numeric"})}` : "No expiration date", 800, 486);
      x.fillStyle = "#8f6b2a"; x.font = "bold 16px Arial"; x.fillText(v.discountPercent === 100 ? "COMPLIMENTARY STAY  •  NON-REFUNDABLE  •  NON-CANCELLABLE" : "SPECIAL GUEST PRIVILEGE", 800, 526);

      x.textAlign = "left"; x.fillStyle = "#123d32"; x.font = "bold 14px Arial"; x.fillText("BOOK YOUR STAY", 100, 574);
      x.fillStyle = "#8f6b2a"; x.font = "bold 15px Arial"; x.fillText("casmartstaycation.github.io/cassbooking/", 100, 598);
      x.fillStyle = "#535b56"; x.font = "13px Arial"; x.fillText("Scan the QR code or visit the website to book.", 100, 622);
      x.fillStyle = "#8f6b2a"; x.font = "italic 15px Georgia"; x.fillText("Elegance • Comfort • Exceptional Stay", 100, 680);

      x.fillStyle = "#fff"; x.fillRect(1320, 120, 190, 190); x.strokeStyle = "#c8a34d"; x.lineWidth = 2; x.strokeRect(1320, 120, 190, 190); x.drawImage(qr, 1330, 130, 170, 170);
      x.fillStyle = "#123d32"; x.textAlign = "center"; x.font = "bold 14px Arial"; x.fillText("SCAN TO BOOK", 1415, 337);
      return c.toDataURL("image/png");
    });
  }

  async function generateCertificate(button) {
    const id = button.dataset.voucherId;
    if (!id) return;
    try {
      const r = await fetch(`${API}/vouchers`, { headers: headers(), cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Unable to load voucher.");
      const v = (j.data || []).find(x => String(x._id) === String(id));
      if (!v) throw new Error("Voucher not found.");
      const guest = prompt("Enter the special guest name for this voucher:", v.specialGuestName || "");
      if (guest === null) return;
      const update = await fetch(`${API}/vouchers/${id}`, { method:"PUT", headers:headers(), body:JSON.stringify({specialGuestName:guest}) });
      if (!update.ok) throw new Error("Unable to save special guest name.");
      const a = document.createElement("a");
      a.href = await drawCertificate({...v, specialGuestName:guest}, guest);
      a.download = `${v.code}-special-guest-voucher.png`;
      a.click();
    } catch (e) { alert(e.message || "Unable to generate certificate."); }
  }

  function replaceCertificateButtons() {
    const list = document.getElementById("voucherAdminList");
    if (!list) return;
    list.querySelectorAll(".certificate-btn").forEach(old => {
      if (old.dataset.elegantCertificate === "true") return;
      const button = old.cloneNode(true);
      button.dataset.elegantCertificate = "true";
      button.addEventListener("click", () => generateCertificate(button));
      old.replaceWith(button);
    });
  }

  function patchLoader() {
    if (typeof window.loadAdminVouchers !== "function" || window.loadAdminVouchers.__patched) return;
    const original = window.loadAdminVouchers;
    async function wrapped() {
      const result = await original();
      setTimeout(addDeleteButtons, 0);
      setTimeout(replaceCertificateButtons, 20);
      return result;
    }
    wrapped.__patched = true;
    window.loadAdminVouchers = wrapped;
  }

  function init() {
    addStyles();
    addTab();
    patchLoader();
    hideTab();
    setTimeout(() => { addTab(); patchLoader(); hideTab(); replaceCertificateButtons(); }, 500);
    setTimeout(() => { addTab(); patchLoader(); hideTab(); replaceCertificateButtons(); }, 1500);
  }

  document.addEventListener("DOMContentLoaded", init);
  const observer = new MutationObserver(() => {
    addStyles(); addTab(); patchLoader();
    const card = getCard(); const tab = document.getElementById("voucherManagementTab");
    if (card && tab && !tab.classList.contains("active")) hideTab();
    addDeleteButtons(); replaceCertificateButtons();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();