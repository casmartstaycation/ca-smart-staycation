(function () {
  'use strict';

  // Admin uploaded-file viewer v2: authenticated, same-origin, no base64 payloads in booking details.
  const API = '/api';
  const TOKEN_KEYS = ['caSmartAdminToken', 'adminToken', 'admin_token'];

  function getToken() {
    for (const key of TOKEN_KEYS) {
      const token = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (token) return token;
    }
    return '';
  }

  function bookingIdFromLink(link) {
    const row = link.closest('tr');
    if (row) {
      const node = row.querySelector('td:first-child .muted');
      if (node && node.textContent.trim()) return node.textContent.trim();
    }
    const href = link.getAttribute('href') || '';
    const match = href.match(/\/admin\/bookings\/([^/]+)\/file\//i);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function typeFromLink(link) {
    const type = link.getAttribute('data-file-type');
    if (type) return type;
    const href = link.getAttribute('href') || '';
    const match = href.match(/\/file\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]) : 'payment';
  }

  function rewriteLinks(root) {
    (root || document).querySelectorAll('a.proof, a[data-admin-file], a[href*="/api/uploads/"], a[href*="onrender.com/api/uploads/"]').forEach(link => {
      const href = link.getAttribute('href') || '';
      if (!href || href.startsWith('data:') || href.startsWith('blob:')) return;

      const isLegacy = /(?:onrender\.com|vercel\.app)\/api\/uploads\//i.test(href) || /\/api\/uploads\//i.test(href);
      const isAdminFile = /\/api\/admin\/bookings\/[^/]+\/file\//i.test(href);
      if (!isLegacy && !isAdminFile) return;

      const bookingId = bookingIdFromLink(link);
      if (!bookingId) return;

      let type = typeFromLink(link);
      if (isLegacy) {
        if (/payments\//i.test(href)) type = 'payment';
        else if (/government|gov/i.test(href)) type = 'government-id';
        else if (/license/i.test(href)) type = 'drivers-license';
      }

      link.href = `${API}/admin/bookings/${encodeURIComponent(bookingId)}/file/${encodeURIComponent(type)}`;
      link.dataset.adminAuthenticatedFile = '1';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
  }

  async function openFile(link) {
    const href = link.getAttribute('href') || '';
    if (!href.startsWith(`${API}/admin/bookings/`)) return false;

    const token = getToken();
    if (!token) {
      alert('Your admin session has expired. Please sign in again.');
      return true;
    }

    const popup = window.open('', '_blank');
    if (!popup) {
      alert('Your browser blocked the file window. Please allow pop-ups for this site.');
      return true;
    }
    popup.document.title = 'Loading uploaded file…';
    popup.document.body.innerHTML = '<p style="font-family:Arial;padding:24px">Loading uploaded file…</p>';

    const oldText = link.textContent;
    link.textContent = 'Opening…';

    try {
      const response = await fetch(href, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });

      const contentType = response.headers.get('content-type') || '';
      if (response.status === 401 || response.status === 403) {
        throw new Error('Admin authentication required. Please sign in again.');
      }
      if (!response.ok) {
        let message = `Unable to open uploaded file (HTTP ${response.status}).`;
        if (contentType.includes('json')) {
          const data = await response.json().catch(() => ({}));
          message = data.message || message;
        }
        throw new Error(message);
      }
      if (contentType.includes('json')) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'The uploaded file could not be opened.');
      }

      const blob = await response.blob();
      if (!blob.size) throw new Error('The uploaded file is empty.');

      const objectUrl = URL.createObjectURL(blob);
      popup.location.href = objectUrl;
      setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
    } catch (error) {
      popup.close();
      alert(error.message || 'Unable to open uploaded file.');
    } finally {
      link.textContent = oldText;
    }
    return true;
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a.proof, a[data-admin-file], a[data-admin-authenticated-file]');
    if (!link) return;

    rewriteLinks(document);
    const href = link.getAttribute('href') || '';
    if (!href.startsWith(`${API}/admin/bookings/`)) return;

    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    openFile(link);
  }, true);

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  }
  function date(value) {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' });
  }
  function dateTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-PH', { year:'numeric', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
  }
  function money(value) { return `₱${Number(value || 0).toLocaleString('en-PH')}`; }
  function fileLink(bookingId, type, label, subId = '') {
    const url = `${API}/admin/bookings/${encodeURIComponent(bookingId)}/file/${encodeURIComponent(type)}${subId ? `/${encodeURIComponent(subId)}` : ''}`;
    return `<a class="proof admin-file-link" href="${esc(url)}" data-admin-file="1" data-file-url="${esc(url)}">${label}</a>`;
  }

  // IMPORTANT: the View action must never render the lightweight booking row first.
  // It waits for /full, builds the entire modal, then reveals it once.
  window.viewBooking = async function (id) {
    const modal = document.getElementById('bookingModal');
    const details = document.getElementById('bookingDetails');
    const actions = document.getElementById('modalActions');
    if (!modal || !details) return;

    modal.hidden = true;
    details.innerHTML = '';
    if (actions) actions.innerHTML = '';

    const token = getToken();
    if (!token) {
      alert('Your admin session is not available. Please sign in again.');
      return;
    }

    try {
      const response = await fetch(`${API}/admin/bookings/${encodeURIComponent(id)}/full`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.success) throw new Error(json.message || 'Unable to load complete booking details.');

      const b = json.data || {};
      const uploads = json.uploads || {};
      const bookingId = b._id || id;
      const room = b.room ? `${b.room.unitNumber || b.room.roomNumber || 'Room'} — ${b.room.unitName || b.room.roomName || ''}` : 'None';
      const parking = b.parking ? `${b.parking.parkingNumber || 'Parking'} — ${b.parking.parkingName || ''}` : 'None';
      const type = b.parkingOnly ? 'Parking Only' : (b.parking ? 'Accommodation + Parking' : 'Accommodation Only');
      const field = (label, value) => `<div><span>${label}</span><strong>${esc(value ?? '—')}</strong></div>`;

      const history = Array.isArray(uploads.paymentProofHistory) && uploads.paymentProofHistory.length
        ? uploads.paymentProofHistory.map((item, i) => `<li>Proof ${i + 1}: ${item.filename ? fileLink(bookingId, 'payment-history', esc(item.filename), i) : 'No file'}${item.rejectedAt ? ` · ${dateTime(item.rejectedAt)}` : ''}${item.rejectionReason ? ` · ${esc(item.rejectionReason)}` : ''}</li>`).join('')
        : '<li>No previous payment proofs.</li>';

      const extraRequests = Array.isArray(uploads.extraRequests) && uploads.extraRequests.length
        ? uploads.extraRequests.map((r, i) => {
            const label = r.type === 'extra_guest' ? 'Extra Guest' : 'Extra Set of Amenities';
            const proof = r.paymentProof ? fileLink(bookingId, 'extra-request', r.paymentProofFileName ? esc(r.paymentProofFileName) : 'View Uploaded Payment', r.id) : 'No upload available.';
            const controls = r.status === 'Pending' ? `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="refresh" data-extra-action="approve" data-request-id="${esc(r.id)}">Approve</button><button type="button" class="refresh" data-extra-action="reject" data-request-id="${esc(r.id)}">Reject</button></div>` : `<div style="margin-top:8px"><strong>Status:</strong> ${esc(r.status)}${r.adminNote ? ` · ${esc(r.adminNote)}` : ''}</div>`;
            return `<div class="notes"><span>${label} Request #${i + 1}</span><p>Quantity: ${esc(r.quantity)} · Amount: ${money(r.amount)} · Submitted: ${dateTime(r.paymentSubmittedAt)}</p><p>Payment Proof: ${proof}</p>${controls}</div>`;
          }).join('')
        : '<div class="notes"><span>Additional Guest / Amenity Requests</span><p>No additional requests.</p></div>';

      const documents = `<div class="notes"><span>Government-Issued ID</span><p>${uploads.governmentId ? fileLink(bookingId, 'government-id', 'View Government-Issued ID') : 'No upload available.'}</p></div><div class="notes"><span>Driver\'s License</span><p>${uploads.driversLicense ? fileLink(bookingId, 'drivers-license', 'View Driver\'s License') : 'No upload available.'}</p></div>`;
      const currentProof = `<div class="notes"><span>Current Payment Proof</span><p>${uploads.paymentProof ? fileLink(bookingId, 'payment', 'View photo/file') : 'No upload available.'}</p></div>`;
      const rescheduleProof = `<div class="notes"><span>Reschedule Payment Proof</span><p>${uploads.reschedulePaymentProof ? fileLink(bookingId, 'reschedule-payment', 'View photo/file') : 'No upload available.'}</p></div>`;

      const html = `<div class="detail-grid">${field('First Name', b.firstName || '—')}${field('Last Name', b.lastName || '—')}${field('Email', b.email || '—')}${field('Mobile', b.mobile || '—')}${field('Complete Address', b.address || '—')}${field('Booking Type', type)}${field('Booking Status', b.bookingStatus || '—')}${field('Check-in', date(b.checkIn))}${field('Check-out', date(b.checkOut))}${field('Accommodation', room)}${field('Parking', parking)}${field('Adults', b.adults ?? 0)}${field('Children', b.children ?? 0)}${field('Payment Status', b.paymentStatus || 'Pending')}${field('Subtotal', money(b.subtotalAmount))}${field('Voucher', b.voucherCode || '—')}${field('Voucher Discount', money(b.voucherDiscountAmount))}${field('Total', money(b.totalAmount))}${field('Payment Reference', b.paymentReference || '—')}${field('Payment Date', dateTime(b.paymentDate))}${field('Payment Deadline', dateTime(b.paymentDeadline))}${field('Payment Submitted', dateTime(b.paymentProofSubmittedAt))}${field('Payment Verified', dateTime(b.paymentVerifiedAt))}${field('Created', dateTime(b.createdAt))}${field('Updated', dateTime(b.updatedAt))}</div><div class="notes"><span>Vehicle Information</span><p>Brand: ${esc(b.vehicleBrand || '—')} · Model: ${esc(b.vehicleModel || '—')} · Color: ${esc(b.vehicleColor || '—')} · Plate: ${esc(b.plateNumber || '—')}</p></div>${documents}${currentProof}<div class="notes"><span>Previous Payment Proofs</span><ul>${history}</ul></div>${rescheduleProof}${extraRequests}<div class="notes"><span>Payment Rejection Reason</span><p>${esc(b.paymentRejectionReason || '—')}</p></div><div class="notes"><span>Cancellation</span><p>${esc(b.cancellationReason || '—')} · Requested: ${dateTime(b.cancellationRequestedAt)}</p></div><div class="notes"><span>Refund</span><p>Status: ${esc(b.refundStatus || 'Not Requested')} · Amount: ${money(b.refundAmount)} · Fee: ${money(b.refundFee)} · Processed: ${dateTime(b.refundProcessedAt)}</p></div><div class="notes"><span>Reschedule History</span><p>${Array.isArray(b.rescheduleHistory) && b.rescheduleHistory.length ? b.rescheduleHistory.map(x => `${date(x.previousCheckIn)}–${date(x.previousCheckOut)} → ${date(x.newCheckIn)}–${date(x.newCheckOut)} · ${dateTime(x.changedAt)}`).join('<br>') : 'No reschedule history.'}</p></div><div class="notes"><span>Notes</span><p>${esc(b.notes || 'No notes.')}</p></div>${b.email ? `<div class="notes"><span>Guest Account</span><p><button type="button" id="resetGuestPasswordBtn" class="refresh">Reset Guest Password</button></p><small id="resetGuestPasswordStatus" aria-live="polite"></small></div>` : ''}`;

      const buttons = [];
      const eid = esc(bookingId);
      if (b.bookingStatus === 'Pending Payment Verification') {
        buttons.push(`<button class="approve" onclick="approvePayment('${eid}');closeModal()">Approve Payment</button>`);
        buttons.push(`<button class="cancel" onclick="rejectPayment('${eid}');closeModal()">Reject Payment</button>`);
      }
      if (b.bookingStatus === 'Reserved') buttons.push(`<button class="checkin" onclick="checkIn('${eid}');closeModal()">Check In</button>`);
      if (b.bookingStatus === 'Checked In') buttons.push(`<button class="checkout" onclick="checkOut('${eid}');closeModal()">Check Out</button>`);
      if (b.bookingStatus === 'Checked Out' && b.housekeepingStatus !== 'Clean') buttons.push(`<button class="clean" onclick="markClean('${eid}');closeModal()">Mark Clean</button>`);
      if (['Waiting for Payment', 'Pending Payment Verification', 'Payment Rejected'].includes(b.bookingStatus)) buttons.push(`<button class="cancel" onclick="cancelBooking('${eid}');closeModal()">Cancel Booking</button>`);

      // One final DOM write, then reveal the modal. Nothing is displayed before this point.
      document.getElementById('modalTitle').textContent = b.bookingReference || 'Booking Details';
      details.innerHTML = html;
      if (actions) actions.innerHTML = buttons.join('');
      details.onclick = event => {
        const link = event.target.closest('a[data-admin-file]');
        if (link) openFile(link);
      };
      details.querySelectorAll('[data-extra-action]').forEach(button => button.addEventListener('click', async () => {
        const requestId = button.dataset.requestId;
        const action = button.dataset.extraAction;
        let reason = '';
        if (action === 'reject') {
          reason = prompt('Enter the reason for rejecting this request:') || '';
          if (!reason.trim()) return;
        }
        const r = await fetch(`${API}/admin/bookings/${encodeURIComponent(bookingId)}/extra-requests/${encodeURIComponent(requestId)}/action`, { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body:JSON.stringify({ action, reason }), cache:'no-store' });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.success) { alert(d.message || 'Unable to process the request.'); return; }
        await window.viewBooking(bookingId);
      }));

      const resetButton = document.getElementById('resetGuestPasswordBtn');
      if (resetButton) resetButton.addEventListener('click', async () => {
        if (!confirm(`Reset the guest account password for ${b.email}?`)) return;
        resetButton.disabled = true;
        resetButton.textContent = 'Resetting…';
        const status = document.getElementById('resetGuestPasswordStatus');
        try {
          const rr = await fetch(`${API}/guest-auth/admin/reset-password`, { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body:JSON.stringify({ email:b.email }), cache:'no-store' });
          const rd = await rr.json().catch(() => ({}));
          if (!rr.ok || !rd.success) throw new Error(rd.message || 'Unable to reset guest password.');
          if (status) status.textContent = rd.message || 'Guest password reset successfully.';
        } catch (e) {
          if (status) status.textContent = e.message || 'Unable to reset guest password.';
        } finally {
          resetButton.disabled = false;
          resetButton.textContent = 'Reset Guest Password';
        }
      });

      // Reveal only after every section, document link and action has been prepared.
      modal.hidden = false;
      rewriteLinks(modal);
    } catch (error) {
      modal.hidden = true;
      details.innerHTML = '';
      if (actions) actions.innerHTML = '';
      alert(error.message || 'Unable to load complete booking details.');
    }
  };

  function scan() { rewriteLinks(document); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();

  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(scan, 1500);
})();