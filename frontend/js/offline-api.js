/*
 * CA Smart Staycation - temporary GitHub Pages static mode
 *
 * GitHub Pages is a static host and cannot run the Express/MongoDB API.
 * While Vercel is paused, this bridge serves safe read-only fallback data
 * locally and NEVER sends API requests to Vercel from github.io.
 *
 * Booking/payment/account writes are intentionally blocked so a reservation
 * cannot appear successful only in one browser and create double bookings.
 */
(function () {
  'use strict';

  const GITHUB_ONLY_MODE = window.location.hostname.endsWith('github.io');
  const BOOKING_NOTICE_ID = 'caBookingServiceNotice';

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
    _id: 'parking-1', id: 'parking-1', slot: 'P1', name: 'Parking Slot 1',
    label: 'Parking Slot 1', status: 'Available', available: true,
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

  function serviceHoldBooking() {
    return {
      _id: 'ca-github-static-hold',
      bookingReference: 'GITHUB-STATIC-MODE',
      room: 'unit-719',
      parking: 'parking-1',
      checkIn: '2000-01-01',
      checkOut: '2100-01-01',
      bookingStatus: 'Reserved',
      paymentStatus: 'Pending',
      offlineSafetyHold: true
    };
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
      return jsonResponse({ success: true, bookings: [serviceHoldBooking()], data: [serviceHoldBooking()], offline: true, githubOnly: true, safetyLocked: true });
    }
    return null;
  }

  function applyBookingServiceLock() {
    const form = document.getElementById('guestBookingForm');
    if (!form) return;

    const submit = form.querySelector('button[type="submit"]');
    if (submit) {
      submit.disabled = true;
      submit.innerHTML = 'Online Booking Temporarily Paused';
      submit.title = 'The GitHub Pages site is temporarily running without the live booking database.';
    }

    const grid = document.getElementById('calendarGrid');
    if (grid) {
      grid.style.pointerEvents = 'none';
      grid.style.opacity = '0.65';
    }

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

    notice.innerHTML = '<strong>Temporary GitHub-only mode.</strong> Live availability and online booking are paused while the booking server is offline. Please contact <a href="mailto:booking@casmartstaycation.com">booking@casmartstaycation.com</a> before reserving.';
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

      applyBookingServiceLock();
      console.warn(`[CA Smart Staycation] GitHub-only mode blocked ${method} ${path}; no Vercel request was sent.`);
      return jsonResponse({
        success: false,
        githubOnly: true,
        message: 'Online booking/account service is temporarily paused while CA Smart Staycation is using GitHub Pages only.'
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
    getBookings: function () { return []; },
    lockBookingService: applyBookingServiceLock,
    unlockBookingService: function () {}
  };

  if (GITHUB_ONLY_MODE) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyBookingServiceLock, { once: true });
    else applyBookingServiceLock();
    console.info('[CA Smart Staycation] GitHub-only static mode enabled. Vercel API calls are disabled.');
  }
})();
