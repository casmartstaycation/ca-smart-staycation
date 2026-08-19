/*
 * CA Smart Staycation - temporary GitHub Pages mode
 *
 * GitHub Pages cannot run the Express/MongoDB API. While Vercel is paused,
 * github.io serves local room/rate data plus a privacy-safe availability
 * snapshot. No API request is sent to Vercel from GitHub Pages.
 *
 * Real booking/payment/account writes remain disabled. Guests can select dates
 * and send a prefilled email booking request for manual confirmation.
 */
(function () {
  'use strict';

  const GITHUB_ONLY_MODE = window.location.hostname.endsWith('github.io');
  const BOOKING_NOTICE_ID = 'caBookingServiceNotice';
  const SUPPORT_EMAIL = 'booking@casmartstaycation.com';

  const roomsFallback = [{
    _id: 'unit-719', id: 'unit-719', name: 'Unit 719', unitName: 'Unit 719',
    unitNumber: '719', title: 'Studio Unit 719', type: 'Studio',
    category: 'Accommodation', tower: 'Barbados Tower', floor: '7th Floor',
    roomNumber: 'Room 19', location: 'Azure North Pampanga',
    description: 'Welcome to CA Smart Staycation Unit 719, located on the 7th Floor, Room 19 of Barbados Tower at Azure North Pampanga.',
    price: 2800, nightlyRate: 2800, rate: 2800, capacity: 4, maxGuests: 4,
    status: 'Available', available: true,
    amenities: ['Air Conditioning','Private Bathroom','Wi-Fi','Kitchen','Refrigerator','Microwave','Television','Keyless Entry','Hot Water','Bedroom','Dining Area'],
    images: ['images/luxury-room-4.png'], photos: ['images/luxury-room-4.png'],
    gallery: ['images/luxury-room-4.png']
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

  /*
   * Privacy-safe snapshot taken from the last healthy live database response
   * on 2026-08-20 around 12:52 AM Asia/Manila. Only fields needed to block
   * dates are retained. No guest name, email, phone, address, ID or payment
   * document is published to GitHub Pages.
   */
  const bookingsSnapshot = [{
    _id: 'availability-snapshot-20260824',
    room: 'unit-719',
    parking: 'parking-1',
    checkIn: '2026-08-24',
    checkOut: '2026-08-25',
    bookingStatus: 'Pending Payment Verification',
    paymentStatus: 'Pending',
    staticSnapshot: true
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
    if (path === '/api/rooms') {
      return jsonResponse({ success: true, rooms: roomsFallback, data: roomsFallback, offline: true, githubOnly: true });
    }
    if (path === '/api/parking') {
      return jsonResponse({ success: true, parking: parkingFallback, slots: parkingFallback, data: parkingFallback, offline: true, githubOnly: true });
    }
    if (path === '/api/settings') {
      return jsonResponse({ success: true, settings: settingsFallback, data: settingsFallback, offline: true, githubOnly: true });
    }
    if (path === '/api/health') {
      return jsonResponse({ status: 'success', offline: true, githubOnly: true, database: 'not-connected' });
    }
    if (path === '/api/bookings') {
      return jsonResponse({
        success: true,
        bookings: bookingsSnapshot,
        data: bookingsSnapshot,
        offline: true,
        githubOnly: true,
        snapshotAt: '2026-08-20T00:52:00+08:00'
      });
    }
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

  function sendEmailBookingRequest(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const checkIn = value('checkIn');
    const checkOut = value('checkOut');
    const firstName = value('firstName');
    const lastName = value('lastName');
    const email = value('email');
    const mobile = value('mobile');
    const type = value('bookingType') || 'unit';

    if (!checkIn || !checkOut || !firstName || !lastName || !email || !mobile) {
      alert('Please complete your dates and required guest information first.');
      return;
    }

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
        '',
        'Vehicle Information:',
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

    const body = lines.join('\n');
    const subject = `Booking Request - ${checkIn} to ${checkOut}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(body).catch(function () {});
    }

    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function applyGitHubOnlyMode() {
    const form = document.getElementById('guestBookingForm');
    if (!form) return;

    const submit = form.querySelector('button[type="submit"]');
    if (submit) {
      submit.disabled = false;
      submit.innerHTML = 'Email Booking Request <span>→</span>';
      submit.title = 'Send a booking request by email for manual confirmation.';
    }

    const grid = document.getElementById('calendarGrid');
    if (grid) {
      grid.style.pointerEvents = '';
      grid.style.opacity = '';
    }

    const idSection = document.getElementById('governmentIdSection');
    if (idSection) idSection.style.display = 'none';

    let notice = document.getElementById(BOOKING_NOTICE_ID);
    if (!notice) {
      notice = document.createElement('div');
      notice.id = BOOKING_NOTICE_ID;
      notice.setAttribute('role', 'status');
      notice.style.margin = '12px 0';
      notice.style.padding = '14px 16px';
      notice.style.border = '1px solid #d5a62b';
      notice.style.borderRadius = '10px';
      notice.style.background = '#fff8df';
      notice.style.color = '#5a4610';
      notice.style.fontSize = '14px';
      notice.style.lineHeight = '1.5';
      const calendar = document.querySelector('.booking-calendar-card');
      if (calendar && calendar.parentNode) calendar.parentNode.insertBefore(notice, calendar);
      else form.insertBefore(notice, form.firstChild);
    }

    notice.innerHTML = '<strong>Temporary GitHub-only booking mode.</strong> The calendar uses a privacy-safe availability snapshot checked on <strong>August 20, 2026</strong>. Select your preferred dates, then use <strong>Email Booking Request</strong>. The host must manually confirm availability before you make any payment.';

    if (!form.dataset.caGithubSubmitHandler) {
      form.dataset.caGithubSubmitHandler = '1';
      form.addEventListener('submit', sendEmailBookingRequest, true);
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

      console.warn(`[CA Smart Staycation] GitHub-only mode blocked ${method} ${path}; no Vercel request was sent.`);
      return jsonResponse({
        success: false,
        githubOnly: true,
        message: 'Live booking/account writes are temporarily paused. Please use the email booking request option.'
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
    console.info('[CA Smart Staycation] GitHub-only mode enabled. Vercel API calls are disabled; email booking requests are active.');
  }
})();
