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

  /*
   * ============================================================
   * ACCOMMODATION DATA
   * ============================================================
   *
   * unit-gallery.js expects the property `images`.
   * Keep `photos` and `gallery` as aliases for compatibility
   * with other existing frontend code.
   */

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

      description:
        'Welcome to CA Smart Staycation Unit 719, located on the 7th Floor, Room 19 of Barbados Tower at Azure North Pampanga. Enjoy a comfortable and relaxing studio stay with convenient access to the amenities and attractions of Azure North.',

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

      /*
       * IMPORTANT:
       * unit-gallery.js reads `images`.
       *
       * Currently the repository contains:
       * frontend/images/luxury-room-4.png
       *
       * Additional photos can be added here later when their
       * actual files are restored to the repository.
       */
      images: [
        'images/luxury-room-4.png'
      ],

      /*
       * Compatibility aliases.
       */
      photos: [
        'images/luxury-room-4.png'
      ],

      gallery: [
        'images/luxury-room-4.png'
      ]
    }
  ];

  /*
   * ============================================================
   * PARKING DATA
   * ============================================================
   */

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

  /*
   * ============================================================
   * DEFAULT SETTINGS
   * ============================================================
   */

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

  /*
   * ============================================================
   * BOOKING STORAGE
   * ============================================================
   */

  function getBookings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed;
    } catch (error) {
      console.warn(
        '[CA Smart Staycation] Unable to read offline bookings:',
        error
      );

      return [];
    }
  }

  function saveBooking(booking) {
    const bookings = getBookings();

    const savedBooking = {
      ...(booking || {}),

      _id:
        booking && booking._id
          ? booking._id
          : 'offline-' +
            Date.now() +
            '-' +
            Math.random()
              .toString(36)
              .slice(2, 8),

      offline: true,

      createdAt: new Date().toISOString()
    };

    bookings.push(savedBooking);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(bookings)
    );

    return savedBooking;
  }

  /*
   * ============================================================
   * URL / RESPONSE HELPERS
   * ============================================================
   */

  function normalizePath(input) {
    try {
      const url = new URL(
        input,
        window.location.origin
      );

      return url.pathname;
    } catch (error) {
      return String(input || '').split('?')[0];
    }
  }

  function jsonResponse(data, status) {
    return new Response(
      JSON.stringify(data),
      {
        status: status || 200,

        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }

  /*
   * ============================================================
   * API RESPONSES
   * ============================================================
   */

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

      message:
        'Temporary GitHub Pages offline development mode.'
    };
  }

  /*
   * ============================================================
   * INTERCEPT FETCH
   * ============================================================
   *
   * This is the important part.
   *
   * Existing scripts can continue doing:
   *
   * fetch('/api/rooms')
   * fetch('/api/parking')
   * fetch('/api/bookings')
   * fetch('/api/settings')
   *
   * but those requests are handled locally.
   *
   * No request is sent to Render or Vercel.
   */

  const originalFetch =
    window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const requestUrl =
      typeof input === 'string'
        ? input
        : input && input.url
          ? input.url
          : '';

    const path =
      normalizePath(requestUrl);

    const method = String(
      (init && init.method) ||
        (input && input.method) ||
        'GET'
    ).toUpperCase();

    /*
     * ----------------------------------------------------------
     * ROOMS
     * ----------------------------------------------------------
     */

    if (path === '/api/rooms') {
      console.info(
        '[CA Smart Staycation] Offline API: /api/rooms'
      );

      return jsonResponse(
        getRoomResponse()
      );
    }

    /*
     * ----------------------------------------------------------
     * PARKING
     * ----------------------------------------------------------
     */

    if (path === '/api/parking') {
      console.info(
        '[CA Smart Staycation] Offline API: /api/parking'
      );

      return jsonResponse(
        getParkingResponse()
      );
    }

    /*
     * ----------------------------------------------------------
     * BOOKINGS
     * ----------------------------------------------------------
     */

    if (path === '/api/bookings') {
      console.info(
        '[CA Smart Staycation] Offline API: /api/bookings'
      );

      /*
       * GET BOOKINGS
       */

      if (method === 'GET') {
        return jsonResponse(
          getBookingsResponse()
        );
      }

      /*
       * SAVE BOOKING LOCALLY
       */

      if (
        method === 'POST' ||
        method === 'PUT' ||
        method === 'PATCH'
      ) {
        let body = {};

        try {
          if (
            init &&
            init.body
          ) {
            if (
              typeof init.body ===
              'string'
            ) {
              body = JSON.parse(
                init.body
              );
            } else {
              body = init.body;
            }
          }
        } catch (error) {
          console.warn(
            '[CA Smart Staycation] Unable to parse offline booking:',
            error
          );
        }

        const booking =
          saveBooking(body);

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

    /*
     * ----------------------------------------------------------
     * SETTINGS
     * ----------------------------------------------------------
     */

    if (path === '/api/settings') {
      console.info(
        '[CA Smart Staycation] Offline API: /api/settings'
      );

      return jsonResponse(
        getSettingsResponse()
      );
    }

    /*
     * ----------------------------------------------------------
     * HEALTH
     * ----------------------------------------------------------
     */

    if (path === '/api/health') {
      console.info(
        '[CA Smart Staycation] Offline API: /api/health'
      );

      return jsonResponse(
        getHealthResponse()
      );
    }

    /*
     * ----------------------------------------------------------
     * NON-API REQUESTS
     * ----------------------------------------------------------
     *
     * CSS, HTML, images and JavaScript continue normally.
     */

    return originalFetch(
      input,
      init
    );
  };

  /*
   * ============================================================
   * GLOBAL OFFLINE OBJECT
   * ============================================================
   *
   * Allows other frontend scripts to access the temporary
   * data directly if needed.
   */

  window.CA_SMART_OFFLINE = {
    enabled: true,

    rooms: rooms,

    parking: parking,

    settings:
      defaultSettings,

    getBookings:
      getBookings,

    saveBooking:
      saveBooking,

    clearBookings:
      function () {
        localStorage.removeItem(
          STORAGE_KEY
        );
      }
  };

  /*
   * ============================================================
   * STARTUP MESSAGE
   * ============================================================
   */

  console.info(
    '[CA Smart Staycation] Temporary offline API enabled.'
  );

})();
