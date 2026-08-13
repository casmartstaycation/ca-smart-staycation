/*
 * CA Smart Staycation
 * Temporary GitHub Pages offline API bridge.
 *
 * PURPOSE:
 * - Keeps the webpage working while Vercel/Render backend is offline.
 * - Intercepts /api/* requests before the existing frontend scripts run.
 * - Does NOT connect to Vercel or Render.
 * - Does NOT change the page design.
 *
 * IMPORTANT:
 * This is temporary development data only.
 * Bookings are stored in localStorage and are NOT sent to a server/database.
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
      title: 'Studio Unit 719',
      type: 'Studio',
      category: 'Accommodation',
      tower: 'Barbados Tower',
      location: 'Azure North Pampanga',
      description:
        'A comfortable private studio stay at Azure North Pampanga.',
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
        'TV',
        'Keyless Entry'
      ],
      photos: [
        'images/luxury-room-4.png'
      ],
      gallery: [
        'images/luxury-room-4.png'
      ]
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
      console.warn(
        'CA Smart Staycation offline bookings could not be read:',
        error
      );
      return [];
    }
  }

  function saveBooking(booking) {
    const bookings = getBookings();

    bookings.push({
      ...booking,
      _id:
        booking._id ||
        'offline-' +
          Date.now() +
          '-' +
          Math.random().toString(36).slice(2, 8),
      offline: true,
      createdAt: new Date().toISOString()
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));

    return bookings[bookings.length - 1];
  }

  function normalizePath(input) {
    try {
      const url = new URL(input, window.location.origin);
      return url.pathname;
    } catch {
      return String(input || '').split('?')[0];
    }
  }

  function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  function getRoomResponse() {
    return {
      success: true,
      rooms: rooms,
      data: rooms
    };
  }

  function getParkingResponse() {
    return {
      success: true,
      parking: parking,
      slots: parking,
      data: parking
    };
  }

  function getBookingsResponse() {
    const bookings = getBookings();

    return {
      success: true,
      bookings: bookings,
      data: bookings
    };
  }

  function getSettingsResponse() {
    return {
      success: true,
      settings: defaultSettings,
      data: defaultSettings
    };
  }

  function getHealthResponse() {
    return {
      status: 'success',
      offline: true,
      database: 'offline',
      message: 'Temporary GitHub Pages offline development mode.'
    };
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const requestUrl =
      typeof input === 'string'
        ? input
        : input && input.url
          ? input.url
          : '';

    const path = normalizePath(requestUrl);

    const method = String(
      (init && init.method) ||
        (input && input.method) ||
        'GET'
    ).toUpperCase();

    /*
     * Intercept every legacy API request locally.
     *
     * This is deliberately checked BEFORE calling the real fetch,
     * so the browser never attempts to contact Render/Vercel.
     */

    if (path === '/api/rooms') {
      console.info(
        '[CA Smart Staycation] Offline API: /api/rooms'
      );

      return jsonResponse(getRoomResponse());
    }

    if (path === '/api/parking') {
      console.info(
        '[CA Smart Staycation] Offline API: /api/parking'
      );

      return jsonResponse(getParkingResponse());
    }

    if (path === '/api/bookings') {
      console.info(
        '[CA Smart Staycation] Offline API: /api/bookings'
      );

      if (method === 'GET') {
        return jsonResponse(getBookingsResponse());
      }

      if (
        method === 'POST' ||
        method === 'PUT' ||
        method === 'PATCH'
      ) {
        let body = {};

        try {
          if (init && init.body) {
            if (typeof init.body === 'string') {
              body = JSON.parse(init.body);
            } else {
              body = init.body;
            }
          }
        } catch (error) {
          console.warn(
            '[CA Smart Staycation] Could not parse offline booking:',
            error
          );
        }

        const booking = saveBooking(body);

        return jsonResponse(
          {
            success: true,
            offline: true,
            message:
              'Booking saved temporarily on this device.',
            booking: booking,
            data: booking
          },
          201
        );
      }
    }

    if (path === '/api/settings') {
      console.info(
        '[CA Smart Staycation] Offline API: /api/settings'
      );

      return jsonResponse(getSettingsResponse());
    }

    if (path === '/api/health') {
      console.info(
        '[CA Smart Staycation] Offline API: /api/health'
      );

      return jsonResponse(getHealthResponse());
    }

    /*
     * Anything that is not an API request continues normally.
     *
     * This means CSS, images, HTML, local JavaScript, etc.
     * are completely unaffected.
     */
    return originalFetch(input, init);
  };

  /*
   * Expose the data for other frontend code that may need
   * direct access without making an API request.
   */
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

  console.info(
    '[CA Smart Staycation] Temporary offline API enabled.'
  );
})();
