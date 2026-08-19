/*
 * CA Smart Staycation - Cross-browser API bridge
 *
 * Static hosts such as GitHub Pages cannot serve /api/* routes. Requests made
 * to /api/* are therefore forwarded directly to the canonical Vercel
 * production API host. On the custom production domain or a Vercel deployment,
 * same-origin /api/* remains in use.
 *
 * Local fallback is intentionally limited to read-only GET endpoints. POST,
 * PUT, PATCH and DELETE requests must never be silently converted into a
 * local-only booking/payment action because doing so can create browser-
 * specific data and duplicate-booking problems.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'caSmartStaycationOfflineBookings';
  const BOOKING_NOTICE_ID = 'caBookingServiceNotice';
  const REMOTE_API = String(window.CA_SMART_REMOTE_API || 'https://www.casmartstaycation.com/api').replace(/\/+$/, '');

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

  function getSafetyBookings() {
    const local = getLocalBookings();
    const safetyHold = {
      _id: 'ca-api-safety-hold',
      bookingReference: 'SERVICE-HOLD',
      room: 'unit-719',
      parking: 'parking-1',
      checkIn: '2000-01-01',
      checkOut: '2100-01-01',
      bookingStatus: 'Reserved',
      paymentStatus: 'Pending',
      offlineSafetyHold: true
    };
    return [...local, safetyHold];
  }

  function applyBookingServiceLock(message) {
    const form = document.getElementById('guestBookingForm');
    if (!form) return;

    const submit = form.querySelector('button[type="submit"]');
    if (submit) {
      if (!submit.dataset.caApiOriginalText) submit.dataset.caApiOriginalText = submit.innerHTML;
      submit.dataset.caApiLock = '1';
      submit.disabled = true;
      submit.innerHTML = 'Booking Temporarily Unavailable';
      submit.title = 'Live availability cannot be verified right now.';
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
      notice.style.padding = '12px 14px';
      notice.style.border = '1px solid #d5a62b';
      notice.style.borderRadius = '10px';
      notice.style.background = '#fff8df';
      notice.style.color = '#5a4610';
      notice.style.fontSize = '14px';
      notice.style.lineHeight = '1.45';
      const calendar = document.querySelector('.booking-calendar-card');
      if (calendar && calendar.parentNode) calendar.parentNode.insertBefore(notice, calendar);
      else form.insertBefore(notice, form.firstChild);
    }
    notice.textContent = message || 'Live availability is temporarily unavailable. Online booking is paused to prevent duplicate reservations. Please try again shortly.';
  }

  function lockBookingService(message) {
    const apply = () => applyBookingServiceLock(message);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
    else apply();
  }

  function unlockBookingService() {
    const apply = () => {
      const form = document.getElementById('guestBookingForm');
      const submit = form && form.querySelector('button[type="submit"]');
      if (submit && submit.dataset.caApiLock === '1') {
        submit.disabled = false;
        submit.innerHTML = submit.dataset.caApiOriginalText || 'Submit Booking <span>→</span>';
        submit.title = '';
        delete submit.dataset.caApiLock;
      }

      const grid = document.getElementById('calendarGrid');
      if (grid) {
        grid.style.pointerEvents = '';
        grid.style.opacity = '';
      }

      const notice = document.getElementById(BOOKING_NOTICE_ID);
      if (notice) notice.remove();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
    else apply();
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
      lockBookingService('Live availability is temporarily unavailable. Online booking is paused to prevent duplicate reservations. Please try again shortly.');
      const bookings = getSafetyBookings();
      return jsonResponse({ success: true, bookings, data: bookings, offline: true, safetyLocked: true });
    }
    return null;
  }

  async function describeErrorResponse(response) {
    try {
      const clone = response.clone();
      const type = String(clone.headers.get('content-type') || '');
      if (type.includes('application/json')) {
        const payload = await clone.json();
        return payload && (payload.detail || payload.message || payload.error || JSON.stringify(payload));
      }
      const text = (await clone.text()).trim();
      return text ? text.slice(0, 800) : '';
    } catch (_) {
      return '';
    }
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

    try {
      const response = await originalFetch(target, requestInit);

      if (!response.ok) {
        const detail = await describeErrorResponse(response);
        console.error(`[CA Smart Staycation] API ${response.status} for ${path}${detail ? `: ${detail}` : ''}`);

        if (method === 'GET') {
          const fallback = fallbackGet(path);
          if (fallback) {
            console.warn(`[CA Smart Staycation] Remote API returned HTTP ${response.status} for ${path}; using read-only local fallback.`);
            return fallback;
          }
        }
      } else if (method === 'GET' && path === '/api/bookings') {
        unlockBookingService();
      }

      return response;
    } catch (error) {
      console.error(`[CA Smart Staycation] Network/CORS failure for ${path}:`, error);
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

  window.CA_SMART_API = window.location.hostname.endsWith('github.io') ? REMOTE_API : '/api';
  window.CA_SMART_OFFLINE = {
    enabled: true,
    remoteFirst: true,
    remoteApi: REMOTE_API,
    rooms: roomsFallback,
    parking: parkingFallback,
    settings: settingsFallback,
    getBookings: getLocalBookings,
    lockBookingService,
    unlockBookingService
  };

  lockBookingService('Checking live availability…');
  console.info(`[CA Smart Staycation] API bridge enabled: ${window.CA_SMART_API}`);
})();
