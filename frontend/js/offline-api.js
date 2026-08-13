/* CA Smart Staycation temporary GitHub Pages offline API bridge.
 * Vercel/Render are intentionally NOT used while the frontend is being completed.
 * This supplies local room, parking, settings and availability data through the
 * same fetch interface used by the existing loaders. No visual/UI changes.
 */
(function () {
  'use strict';

  const OFFLINE = true;
  if (!OFFLINE || window.__CA_OFFLINE_API__) return;
  window.__CA_OFFLINE_API__ = true;

  const ROOM_IMAGE = 'images/luxury-room-4.png';
  const rooms = [{
    _id: 'offline-unit-719',
    unitNumber: '719',
    roomNumber: '719',
    unitName: 'Barbados',
    roomName: 'Barbados',
    description: 'Private staycation accommodation at Azure North, Pampanga.',
    amenities: ['Air Conditioning', 'Wi-Fi', 'Private Bathroom', 'Kitchenette'],
    images: [ROOM_IMAGE]
  }];

  const parking = [{
    _id: 'offline-parking-1',
    parkingNumber: 'Parking 1',
    parkingName: 'Available Parking Slot',
    status: 'available'
  }];

  const bookings = [];
  const settings = {};
  const nativeFetch = window.fetch.bind(window);

  function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  function pathOf(input) {
    try { return new URL(typeof input === 'string' ? input : input.url, location.href).pathname; }
    catch (_) { return String(input || '').split('?')[0]; }
  }

  window.fetch = function (input, init) {
    const path = pathOf(input);
    const method = String(init?.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase();

    if (path.endsWith('/api/rooms')) {
      return Promise.resolve(jsonResponse({ success: true, data: rooms }));
    }
    if (path.endsWith('/api/parking')) {
      return Promise.resolve(jsonResponse({ success: true, data: parking }));
    }
    if (path.endsWith('/api/bookings') && method === 'GET') {
      return Promise.resolve(jsonResponse({ success: true, data: bookings }));
    }
    if (path.endsWith('/api/settings')) {
      return Promise.resolve(jsonResponse({ success: true, data: settings }));
    }
    if (path.endsWith('/api/bookings') && method === 'POST') {
      let payload = {};
      try { payload = JSON.parse(init?.body || '{}'); } catch (_) {}
      const reference = 'LOCAL-' + Date.now().toString(36).toUpperCase();
      const booking = { ...payload, _id: reference, bookingReference: reference, bookingStatus: 'Pending' };
      bookings.push(booking);
      return Promise.resolve(jsonResponse({ success: true, data: booking, offline: true }));
    }

    return nativeFetch(input, init);
  };
})();
