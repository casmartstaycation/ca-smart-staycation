const ADMIN_DOCUMENTS_API = "https://ca-smart-staycation-muqd.onrender.com/api";

(function () {
  const originalViewBooking = window.viewBooking;
  if (typeof originalViewBooking !== "function") return;

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
