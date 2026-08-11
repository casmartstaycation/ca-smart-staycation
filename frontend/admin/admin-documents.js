const ADMIN_DOCUMENTS_API = "https://ca-smart-staycation-muqd.onrender.com/api";

(function () {
  const originalViewBooking = window.viewBooking;
  if (typeof originalViewBooking !== "function") return;

  const style = document.createElement("style");
  style.textContent = `.admin-documents-panel{margin-top:18px;padding:18px;border:1px solid #e3e8e5;border-radius:10px;background:#fbfcfb}.admin-documents-heading{margin-bottom:14px}.admin-documents-label{display:block;color:#8b6b2e;font-size:10px;font-weight:800;letter-spacing:1.2px;margin-bottom:5px}.admin-documents-heading h3{margin:0;color:#173f35;font-size:19px}.admin-documents-heading p{margin:5px 0 0;color:#68736e;font-size:12px}.admin-documents-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.admin-document-card{border:1px solid #e1e6e3;border-radius:8px;background:#fff;padding:10px;min-width:0}.admin-document-card.missing{background:#f5f6f5}.admin-document-title{font-weight:700;color:#173f35;font-size:13px;margin-bottom:8px}.admin-document-preview{display:block;width:100%;height:150px;object-fit:contain;background:#f1f3f2;border-radius:6px;border:1px solid #e1e6e3}.admin-document-file{height:150px;display:flex;align-items:center;justify-content:center;text-align:center;background:#f1f3f2;border-radius:6px;color:#68736e;font-size:11px;padding:8px;word-break:break-word}.admin-document-open{display:inline-block;margin-top:9px;color:#1d624d;font-size:12px;font-weight:700;text-decoration:none}.admin-document-missing{color:#a33a35;font-size:12px;padding:10px 0}.admin-vehicle-info{margin-top:12px;padding:10px 12px;background:#fff;border:1px solid #e1e6e3;border-radius:8px;font-size:12px;color:#68736e}.admin-vehicle-info strong{color:#173f35;margin-right:8px}.admin-documents-error{margin-top:18px}@media(max-width:700px){.admin-documents-grid{grid-template-columns:1fr}}`;
  document.head.appendChild(style);

  window.viewBooking = async function (id) {
    originalViewBooking(id);

    const details = document.getElementById("bookingDetails");
    if (!details) return;

    let booking;
    try {
      const response = await fetch(`${ADMIN_DOCUMENTS_API}/bookings/${encodeURIComponent(id)}`, {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message || "Unable to load guest documents.");
      booking = json.data;
    } catch (error) {
      const errorBox = document.createElement("div");
      errorBox.className = "notes admin-documents-error";
      errorBox.innerHTML = `<span>Guest Documents</span><p>Unable to load submitted documents. Please try again.</p>`;
      details.appendChild(errorBox);
      console.error("ADMIN DOCUMENT LOAD ERROR:", error);
      return;
    }

    const section = document.createElement("section");
    section.className = "admin-documents-panel";
    section.innerHTML = `
      <div class="admin-documents-heading">
        <div>
          <span class="admin-documents-label">REQUIRED FOR BUILDING RECEPTION</span>
          <h3>Guest Submitted Documents</h3>
          <p>Review these documents before requesting the building/unit access pass from reception.</p>
        </div>
      </div>
      <div class="admin-documents-grid">
        ${documentCard("Government-Issued ID", booking.governmentId, `${ADMIN_DOCUMENTS_API}/bookings/${encodeURIComponent(id)}/documents/governmentId`)}
        ${documentCard("Driver's License", booking.driversLicense, `${ADMIN_DOCUMENTS_API}/bookings/${encodeURIComponent(id)}/documents/driversLicense`)}
        ${documentCard("Payment Proof", booking.paymentProof, `${ADMIN_DOCUMENTS_API}/uploads/payments/${encodeURIComponent(booking.paymentProof || "")}`)}
      </div>
      ${booking.parking ? `<div class="admin-vehicle-info"><strong>Vehicle Information</strong><span>${escapeHtml(booking.vehicleBrand || "—")} ${escapeHtml(booking.vehicleModel || "")} · ${escapeHtml(booking.vehicleColor || "")} · Plate ${escapeHtml(booking.plateNumber || "—")}</span></div>` : ""}
    `;

    details.appendChild(section);
  };

  function documentCard(label, filename, url) {
    if (!filename) {
      return `<div class="admin-document-card missing"><div class="admin-document-title">${label}</div><div class="admin-document-missing">Not submitted</div></div>`;
    }
    const safeUrl = String(url).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const ext = String(filename).split(".").pop().toLowerCase();
    const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
    return `<div class="admin-document-card"><div class="admin-document-title">${label}</div>${isImage ? `<a href="${safeUrl}" target="_blank" rel="noopener"><img class="admin-document-preview" src="${safeUrl}" alt="${label}"></a>` : `<div class="admin-document-file">${escapeHtml(String(filename))}</div>`}<a class="admin-document-open" href="${safeUrl}" target="_blank" rel="noopener">Open full document</a></div>`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  }
})();
