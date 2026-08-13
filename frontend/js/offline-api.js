/*
 * CA Smart Staycation
 * Temporary GitHub Pages Offline API Bridge
 *
 * PURPOSE:
 * - Keeps the webpage working while Vercel/Render backend is offline.
 * - Intercepts /api/* requests locally.
 * - Does NOT connect to Vercel.
 * - Does NOT connect to Render.
 * - Does NOT change the webpage design.
 *
 * IMPORTANT:
 * - This is temporary development mode.
 * - Bookings are stored only in this browser's localStorage.
 * - Bookings are NOT sent to a real database.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'caSmartStaycationOfflineBookings';

  const rooms = [
    {
      _id: 'unit-719',
      id: 'unit-719',
      name: 'Unit 719',
      unitName: 'Unit 719',
      unitNumber: '719',
      title: 'Studio Unit 719',
      type: 'Studio',
      category: 'Accommodation',
      tower: 'Barbados Tower',
      floor: '7th Floor',
      roomNumber: 'Room 19',
      location: 'Azure North Pampanga',
      description: 'Welcome to CA Smart Staycation Unit 719, located on the 7th Floor, Room 19 of Barbados Tower at Azure North Pampanga. Enjoy a comfortable and relaxing studio stay with convenient access to the amenities and attractions of Azure North. The unit accommodates up to 4 adults. Children ages 0–2 are not counted toward the guest limit.',
      price: 2800,
      nightlyRate: 2800,
      rate: 2800,
      capacity: 4,
      maxGuests: 4,
      status: 'Available',
      available: true,
      amenities: [
        'Air Conditioning',
        'Private Bathroom',
        'Wi-Fi',
        'Kitchen',
        'Refrigerator',
        'Microwave',
        'Television',
        'Keyless Entry',
        'Hot Water',
        'Bedroom',
        'Dining Area'
      ],
      images: ['images/luxury-room-4.png'],
      photos: ['images/luxury-room-4.png'],
      gallery: ['images/luxury-room-4.png']
    }
  ];

  const parking = [
    {
      _id: 'parking-1',
      id: 'parking-1',
      slot: 'P1',
      name: 'Parking Slot 1',
      label: 'Parking Slot 1',
      status: 'Available',
      available: true,
      price: 500,
      nightlyRate: 500,
      rate: 500
    }
  ];

  const defaultSettings = {
    roomRate: 2800,
    ROOM_RATE: 2800,
    extraGuestFee: 300,
    EXTRA_GUEST_FEE: 300,
    parkingRate: 500,
    PARKING_RATE: 500,
    securityDeposit: 1000,
    SECURITY_DEPOSIT: 1000,
    maxGuests: 4,
    MAX_GUESTS: 4,
    maxFreeChildren: 2,
    MAX_FREE_CHILDREN: 2
  };

  function getBookings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('[CA Smart Staycation] Unable to read offline bookings:', error);
      return [];
    }
  }

  function saveBooking(booking) {
    const bookings = getBookings();
    const savedBooking = {
      ...(booking || {}),
      _id: booking && booking._id ? booking._id : 'offline-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      offline: true,
      createdAt: new Date().toISOString()
    };
    bookings.push(savedBooking);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
    return savedBooking;
  }

  function normalizePath(input) {
    try {
      return new URL(input, window.location.origin).pathname;
    } catch (error) {
      return String(input || '').split('?')[0];
    }
  }

  function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const requestUrl = typeof input === 'string' ? input : input && input.url ? input.url : '';
    const path = normalizePath(requestUrl);
    const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();

    if (path === '/api/rooms') {
      console.info('[CA Smart Staycation] Offline API: /api/rooms');
      return jsonResponse({ success: true, rooms: rooms, data: rooms });
    }

    if (path === '/api/parking') {
      console.info('[CA Smart Staycation] Offline API: /api/parking');
      return jsonResponse({ success: true, parking: parking, slots: parking, data: parking });
    }

    if (path === '/api/bookings') {
      console.info('[CA Smart Staycation] Offline API: /api/bookings');

      if (method === 'GET') {
        const bookings = getBookings();
        return jsonResponse({ success: true, bookings: bookings, data: bookings });
      }

      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        let body = {};
        try {
          if (init && init.body) {
            body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
          }
        } catch (error) {
          console.warn('[CA Smart Staycation] Unable to parse offline booking:', error);
        }
        const booking = saveBooking(body);
        return jsonResponse({
          success: true,
          offline: true,
          message: 'Booking saved temporarily on this device.',
          booking: booking,
          data: booking
        }, 201);
      }
    }

    if (path === '/api/settings') {
      console.info('[CA Smart Staycation] Offline API: /api/settings');
      return jsonResponse({ success: true, settings: defaultSettings, data: defaultSettings });
    }

    if (path === '/api/health') {
      console.info('[CA Smart Staycation] Offline API: /api/health');
      return jsonResponse({ status: 'success', offline: true, database: 'offline', message: 'Temporary GitHub Pages offline development mode.' });
    }

    return originalFetch(input, init);
  };

  window.CA_SMART_OFFLINE = {
    enabled: true,
    rooms: rooms,
    parking: parking,
    settings: defaultSettings,
    getBookings: getBookings,
    saveBooking: saveBooking,
    clearBookings: function () {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  console.info('[CA Smart Staycation] Temporary offline API enabled.');
})();
