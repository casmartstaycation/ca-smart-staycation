/*
 * CA Smart Staycation - Cross-browser API bridge
 *
 * All /api/* requests use the real Vercel API first. On the production
 * domain this is same-origin; on GitHub Pages/static hosting it is routed to
 * the production API. The browser's original fetch is always used so the
 * bridge cannot recurse into itself.
 *
 * Local fallback is intentionally limited to read-only GET endpoints. POST,
 * PUT, PATCH and DELETE requests must never be silently converted into a
 * local-only booking/payment action because doing so can create browser-
 * specific data and duplicate-booking problems.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'caSmartStaycationOfflineBookings';
  const REMOTE_API = 'https://www.casmartstaycation.com/api';

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

  function readJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      if (!value) return fallback;
      const parsed = JSON.parse(value);
      return parsed == null ? fallback : parsed;
    } catch (_) { return fallback; }
  }

  function getLocalBookings() {
    const value = readJson(STORAGE_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function normalizePath(input) {
    try {
      const raw = typeof input === 'string' ? input : (input && input.url) || '';
      return new URL(raw, window.location.origin).pathname.replace(/\/+$/, '') || '/';
    } catch (_) {
      return String(input || '').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
    }
  }

  function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  function apiUrl(path) {
    const cleanPath = String(path || '/');
    const apiPath = cleanPath === '/api'
      ? ''
      : cleanPath.startsWith('/api/')
        ? cleanPath.slice(4)
        : cleanPath.startsWith('/')
          ? cleanPath
          : '/' + cleanPath;

    const host = window.location.hostname;
    const isProductionHost = host === 'www.casmartstaycation.com' ||
      host === 'casmartstaycation.com' ||
      host.endsWith('.vercel.app');

    if (isProductionHost) {
      return `${window.location.origin}/api${apiPath}`;
    }

    return `${REMOTE_API}${apiPath}`;
  }

  function isApiPath(path) {
    return path === '/api' || path.startsWith('/api/');
  }

  function fallbackGet(path) {
    if (path === '/api/rooms') {
      return jsonResponse({ success: true, rooms: roomsFallback, data: roomsFallback, offline: true });
    }
    if (path === '/api/parking') {
      return jsonResponse({ success: true, parking: parkingFallback, slots: parkingFallback, data: parkingFallback, offline: true });
    }
    if (path === '/api/settings') {
      return jsonResponse({ success: true, settings: settingsFallback, data: settingsFallback, offline: true });
    }
    if (path === '/api/health') {
      return jsonResponse({ status: 'success', offline: true, database: 'offline' });
    }
    if (path === '/api/bookings') {
      const bookings = getLocalBookings();
      return jsonResponse({ success: true, bookings, data: bookings, offline: true });
    }
    return null;
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const path = normalizePath(input);
    const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();

    if (!isApiPath(path)) {
      return originalFetch(input, init);
    }

    const target = apiUrl(path);
    const requestInit = { ...(init || {}), cache: 'no-store' };

    // Always call the captured browser fetch, never window.fetch.
    try {
      return await originalFetch(target, requestInit);
    } catch (error) {
      if (method === 'GET') {
        const fallback = fallbackGet(path);
        if (fallback) {
          console.warn(`[CA Smart Staycation] API unavailable for ${path}; using read-only local fallback.`);
          return fallback;
        }
      }
      throw error;
    }
  };

  window.CA_SMART_OFFLINE = {
    enabled: true,
    remoteFirst: true,
    rooms: roomsFallback,
    parking: parkingFallback,
    settings: settingsFallback,
    getBookings: getLocalBookings
  };

  console.info('[CA Smart Staycation] Cross-browser API bridge enabled: original fetch + real API first.');
})();
