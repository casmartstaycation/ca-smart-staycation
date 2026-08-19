/*
 * CA Smart Staycation - temporary GitHub Pages mode
 * GitHub Pages cannot run the Express/MongoDB API, so this bridge provides
 * local read-only booking data and a manual booking-request workflow.
 * No request is sent to Vercel from github.io.
 */
(function () {
  'use strict';

  const GITHUB_ONLY_MODE = window.location.hostname.endsWith('github.io');
  const SUPPORT_EMAIL = 'booking@casmartstaycation.com';
  const BOOKING_NOTICE_ID = 'caBookingServiceNotice';
  const DELIVERY_PANEL_ID = 'githubBookingDeliveryPanel';

  const roomsFallback = [{
    _id: 'unit-719', id: 'unit-719', name: 'Unit 719', unitName: 'Unit 719',
    unitNumber: '719', title: 'Studio Unit 719', type: 'Studio',
    category: 'Accommodation', tower: 'Barbados Tower', floor: '7th Floor',
    roomNumber: 'Room 19', location: 'Azure North Pampanga',
    description: 'Welcome to CA Smart Staycation Unit 719, located on the 7th Floor, Room 19 of Barbados Tower at Azure North Pampanga.',
    price: 2800, nightlyRate: 2800, rate: 2800, capacity: 4, maxGuests: 4,
    status: 'Available', available: true,
    amenities: ['Air Conditioning','Private Bathroom','Wi-Fi','Kitchen','Refrigerator','Microwave','Television','Keyless Entry','Hot Water','Bedroom','Dining Area'],
    images: ['images/luxury-room-4.png'], photos: ['images/luxury-room-4.png'], gallery: ['images/luxury-room-4.png']
  }];

  const parkingFallback = [{
    _id: 'parking-1', id: 'parking-1', slot: 'P1', parkingNumber: 'SLOT 9',
    name: 'Parking Slot 1', label: 'Parking Slot 1', status: 'Available', available: true,
    price: 500, nightlyRate: 500, rate: 500
  }];

  const settingsFallback = {
    roomRate: 2800, ROOM_RATE: 2800,
    extraGuestFee: 300, EXTRA_GUEST_FEE: 300,
    parkingRate: 500, PARKING_RATE: 500,
    securityDeposit: 1000, SECURITY_DEPOSIT: 1000,
    maxGuests: 4, MAX_GUESTS: 4,
    maxFreeChildren: 2, MAX_FREE_CHILDREN: 2
  };

  /* Privacy-safe availability snapshot only; no guest personal data. */
  const bookingsSnapshot = [{
    _id: 'availability-snapshot-20260824',
    room: 'unit-719', parking: 'parking-1',
    checkIn: '2026-08-24', checkOut: '2026-08-25',
    bookingStatus: 'Pending Payment Verification',
    paymentStatus: 'Pending', staticSnapshot: true
  }];

  function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  function normalizePath(input) {
    try {
      const raw = typeof input === 'string' ? input : (input && input.url) || '';
      return new URL(raw, window.location.origin).pathname.replace(/\/+$/, '') || '/';
    } catch (_) {
      return String(input || '').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
    }
  }

  function isApiPath(path) {
    return path === '/api' || path.startsWith('/api/');
  }

  function fallbackGet(path) {
    if (path === '/api/rooms') return jsonResponse({ success: true, rooms: roomsFallback, data: roomsFallback, offline: true, githubOnly: true });
    if (path === '/api/parking') return jsonResponse({ success: true, parking: parkingFallback, slots: parkingFallback, data: parkingFallback, offline: true, githubOnly: true });
    if (path === '/api/settings') return jsonResponse({ success: true, settings: settingsFallback, data: settingsFallback, offline: true, githubOnly: true });
    if (path === '/api/health') return jsonResponse({ status: 'success', offline: true, githubOnly: true, database: 'not-connected' });
    if (path === '/api/bookings') return jsonResponse({
      success: true, bookings: bookingsSnapshot, data: bookingsSnapshot,
      offline: true, githubOnly: true, snapshotAt: '2026-08-20T00:52:00+08:00'
    });
    return null;
  }

  function value(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function text(id) {
    const el = document.getElementById(id);
    return el ? String(el.textContent || '').trim() : '';
  }

  function bookingTypeLabel(type) {
    if (type === 'parking') return 'Parking Only';
    if (type === 'both') return 'Accommodation + Parking';
    return 'Accommodation Only';
  }

  function buildBookingRequest() {
    const checkIn = value('checkIn');
    const checkOut = value('checkOut');
    const firstName = value('firstName');
    const lastName = value('lastName');
    const email = value('email');
    const mobile = value('mobile');
    const type = value('bookingType') || 'unit';

    if (!checkIn || !checkOut || !firstName || !lastName || !email || !mobile) return null;

    const roomSelect = document.getElementById('room');
    const roomName = roomSelect && roomSelect.selectedOptions && roomSelect.selectedOptions[0]
      ? roomSelect.selectedOptions[0].textContent.trim()
      : '';

    const lines = [
      'CA Smart Staycation - Booking Request',
      '',
      'IMPORTANT: This is a booking request only. The host must manually confirm availability before payment.',
      '',
      `Booking Type: ${bookingTypeLabel(type)}`,
      `Accommodation: ${type === 'parking' ? 'N/A' : (roomName || 'Unit 719')}`,
      `Check-in: ${checkIn}`,
      `Check-out: ${checkOut}`,
      `Guests (3+): ${type === 'parking' ? 'N/A' : (value('guests') || '0')}`,
      `Children (0-2): ${type === 'parking' ? 'N/A' : (value('children') || '0')}`,
      `Parking Requested: ${type === 'parking' || type === 'both' ? 'Yes' : 'No'}`,
      `Displayed Total: ${text('totalAmount') || 'Please confirm'}`,
      '',
      `Guest Name: ${firstName} ${lastName}`,
      `Email: ${email}`,
      `Mobile: ${mobile}`,
      `Address: ${value('address') || 'Not provided'}`
    ];

    if (type === 'parking' || type === 'both') {
      lines.push(
        '', 'Vehicle Information:',
        `Brand: ${value('vehicleBrand') || 'Not provided'}`,
        `Model: ${value('vehicleModel') || 'Not provided'}`,
        `Color: ${value('vehicleColor') || 'Not provided'}`,
        `Plate Number: ${value('plateNumber') || 'Not provided'}`
      );
    }

    lines.push(
      '',
      'Please reply to confirm the dates and provide the next payment/ID instructions.',
      '',
      'Sent from the temporary CA Smart Staycation GitHub Pages booking form.'
    );

    return {
      body: lines.join('\n'),
      subject: `Booking Request - ${checkIn} to ${checkOut}`
    };
  }

  function copyRequest(body, textarea, status) {
    const done = () => {
      status.textContent = 'Booking request copied. Paste it into Gmail, Messenger, SMS, or another app.';
      status.style.color = '#0b5d4d';
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(body).then(done).catch(() => {
        textarea.focus(); textarea.select();
        try { document.execCommand('copy'); done(); }
        catch (_) { status.textContent = 'Select the request text and copy it manually.'; status.style.color = '#b42318'; }
      });
      return;
    }

    textarea.focus(); textarea.select();
    try { document.execCommand('copy'); done(); }
    catch (_) { status.textContent = 'Select the request text and copy it manually.'; status.style.color = '#b42318'; }
  }

  function showDeliveryPanel(request) {
    let panel = document.getElementById(DELIVERY_PANEL_ID);
    const form = document.getElementById('guestBookingForm');
    if (!form) return;

    if (!panel) {
      panel = document.createElement('section');
      panel.id = DELIVERY_PANEL_ID;
      panel.style.cssText = 'margin:22px 0;padding:22px;background:#fff;border:2px solid #c9a44c;border-radius:14px;box-shadow:0 8px 24px rgba(6,59,50,.12);';
      panel.innerHTML = `
        <h3 style="margin:0 0 8px;color:#063b32;">Booking Request Ready</h3>
        <p style="margin:0 0 14px;line-height:1.55;color:#5f6b67;"><strong>Your request has been prepared but has not been sent yet.</strong> Choose how you want to send it.</p>
        <div style="padding:12px 14px;margin-bottom:14px;background:#fff8df;border:1px solid #d5a62b;border-radius:9px;color:#5a4610;line-height:1.5;">Send this request to <strong>${SUPPORT_EMAIL}</strong>. The host must manually confirm availability before payment.</div>
        <textarea id="githubBookingRequestText" readonly style="width:100%;box-sizing:border-box;min-height:280px;padding:12px;border:1px solid #ccd5d1;border-radius:8px;font:13px/1.5 monospace;background:#fafcfb;"></textarea>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
          <button type="button" id="githubOpenGmail" class="continue-button" style="flex:1;min-width:150px;">Open Gmail</button>
          <button type="button" id="githubOpenEmailApp" class="continue-button" style="flex:1;min-width:150px;">Open Email App</button>
          <button type="button" id="githubCopyRequest" class="continue-button" style="flex:1;min-width:150px;">Copy Request</button>
        </div>
        <p id="githubBookingDeliveryStatus" role="status" aria-live="polite" style="margin:12px 0 0;font-size:13px;color:#68736e;"></p>
      `;
      form.insertAdjacentElement('afterend', panel);
    }

    const textarea = panel.querySelector('#githubBookingRequestText');
    const status = panel.querySelector('#githubBookingDeliveryStatus');
    textarea.value = request.body;
    status.textContent = 'Choose Gmail, your email app, or Copy Request.';
    status.style.color = '#68736e';

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}&su=${encodeURIComponent(request.subject)}&body=${encodeURIComponent(request.body)}`;
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(request.subject)}&body=${encodeURIComponent(request.body)}`;

    panel.querySelector('#githubOpenGmail').onclick = function () {
      const opened = window.open(gmailUrl, '_blank', 'noopener');
      status.textContent = opened ? 'Gmail opened. Review the message and press Send.' : 'Your browser blocked the Gmail tab. Use Copy Request instead.';
      status.style.color = opened ? '#0b5d4d' : '#b42318';
    };

    panel.querySelector('#githubOpenEmailApp').onclick = function () {
      status.textContent = 'Opening your email app. If nothing opens, use Open Gmail or Copy Request.';
      status.style.color = '#0b5d4d';
      window.location.href = mailtoUrl;
    };

    panel.querySelector('#githubCopyRequest').onclick = function () {
      copyRequest(request.body, textarea, status);
    };

    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function submitBookingRequest(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const request = buildBookingRequest();
    if (!request) {
      alert('Please complete your dates and required guest information first.');
      return;
    }

    showDeliveryPanel(request);
  }

  function applyGitHubOnlyMode() {
    const form = document.getElementById('guestBookingForm');
    if (!form) return;

    const submit = form.querySelector('button[type="submit"]');
    if (submit) {
      submit.disabled = false;
      submit.innerHTML = 'Submit Booking Request <span>→</span>';
      submit.title = 'Prepare your booking request for manual confirmation.';
    }

    const grid = document.getElementById('calendarGrid');
    if (grid) { grid.style.pointerEvents = ''; grid.style.opacity = ''; }

    const idSection = document.getElementById('governmentIdSection');
    if (idSection) idSection.style.display = 'none';

    let notice = document.getElementById(BOOKING_NOTICE_ID);
    if (!notice) {
      notice = document.createElement('div');
      notice.id = BOOKING_NOTICE_ID;
      notice.setAttribute('role', 'status');
      notice.style.cssText = 'margin:12px 0;padding:14px 16px;border:1px solid #d5a62b;border-radius:10px;background:#fff8df;color:#5a4610;font-size:14px;line-height:1.5;';
      const calendar = document.querySelector('.booking-calendar-card');
      if (calendar && calendar.parentNode) calendar.parentNode.insertBefore(notice, calendar);
      else form.insertBefore(notice, form.firstChild);
    }

    notice.innerHTML = '<strong>Temporary GitHub-only booking mode.</strong> Select your preferred dates, complete your information, then use <strong>Submit Booking Request</strong>. A request panel will appear on this page. Nothing is sent automatically.';

    if (!form.dataset.caGithubSubmitHandlerV9) {
      form.dataset.caGithubSubmitHandlerV9 = '1';
      form.addEventListener('submit', submitBookingRequest, true);
    }
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const path = normalizePath(input);
    const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();

    if (!isApiPath(path)) return originalFetch(input, init);

    if (GITHUB_ONLY_MODE) {
      if (method === 'GET') {
        const fallback = fallbackGet(path);
        if (fallback) return fallback;
      }
      console.warn(`[CA Smart Staycation] GitHub-only mode blocked ${method} ${path}; no backend request was sent.`);
      return jsonResponse({
        success: false, githubOnly: true,
        message: 'Live booking/account writes are temporarily paused. Use Submit Booking Request instead.'
      }, 503);
    }

    return originalFetch(input, init);
  };

  window.CA_SMART_API = '/api';
  window.CA_SMART_OFFLINE = {
    enabled: GITHUB_ONLY_MODE,
    githubOnly: GITHUB_ONLY_MODE,
    remoteFirst: false,
    remoteApi: null,
    rooms: roomsFallback,
    parking: parkingFallback,
    settings: settingsFallback,
    getBookings: function () { return bookingsSnapshot.slice(); },
    lockBookingService: applyGitHubOnlyMode,
    unlockBookingService: function () {}
  };

  if (GITHUB_ONLY_MODE) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyGitHubOnlyMode, { once: true });
    else applyGitHubOnlyMode();
    console.info('[CA Smart Staycation] GitHub-only mode v9 enabled. Booking requests open an on-page delivery panel; nothing is sent automatically.');
  }
})();
