// CA Smart Staycation - Booking success page
// External script so it is allowed by the site's Content Security Policy.
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    let booking = null;
    try {
      booking = JSON.parse(localStorage.getItem('guestBooking') || 'null');
    } catch (_) {
      booking = null;
    }

    if (!booking) return;

    function set(id, value) {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    }

    function money(value) {
      return '₱' + Number(value || 0).toLocaleString('en-PH');
    }

    function dateText(value) {
      if (!value) return '-';
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-PH', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    }

    // Older offline bookings may not have a reference. Generate one once and
    // persist it so the same reference remains visible on refresh.
    let reference = booking.bookingReference || localStorage.getItem('bookingReference') || '';
    if (!reference && window.CA_SMART_OFFLINE && typeof window.CA_SMART_OFFLINE.createBookingReference === 'function') {
      reference = window.CA_SMART_OFFLINE.createBookingReference();
    }
    if (!reference) {
      const random = Math.random().toString(36).slice(2, 7).toUpperCase();
      const d = new Date();
      reference = `CA-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${random}`;
    }

    booking.bookingReference = reference;
    localStorage.setItem('guestBooking', JSON.stringify(booking));
    localStorage.setItem('bookingReference', reference);

    const guests = Number(booking.adults ?? booking.guests ?? 0);
    const children = Number(booking.children ?? 0);
    const isParkingOnly = booking.parkingOnly === true || booking.bookingType === 'parking';
    const hasParking = isParkingOnly || !!booking.parking;

    set('bookingReference', reference);
    set('bookingReferenceDisplay', reference);
    set('guestName', `${booking.firstName || ''} ${booking.lastName || ''}`.trim() || booking.guestName || '-');
    set('bookingType', isParkingOnly ? 'Parking Only' : (hasParking ? 'Accommodation + Parking' : 'Accommodation Only'));
    set('roomName', booking.roomName || booking.room?.unitName || booking.room?.name || (isParkingOnly ? '—' : '-'));
    set('checkIn', booking.checkIn ? String(booking.checkIn).substring(0, 10) : '-');
    set('checkOut', booking.checkOut ? String(booking.checkOut).substring(0, 10) : '-');
    set('guests', guests || '-');
    set('children', children || '-');
    set('parking', hasParking ? 'Included' : 'No');

    set('summaryAccommodation', money(booking.roomAmount));
    set('summaryExtra', money(booking.extraGuestAmount));
    set('summaryParking', money(booking.parkingAmount));
    set('summaryDeposit', money(booking.securityDepositAmount));

    const discount = Number(booking.voucherDiscountAmount || 0);
    const voucherRow = document.getElementById('summaryVoucherRow');
    if (discount > 0 && voucherRow) {
      voucherRow.style.display = 'flex';
      set('summaryVoucherLabel', `Voucher (${booking.voucherCode || ''} — ${booking.voucherDiscountPercent || 0}%)`);
      set('summaryVoucher', '-' + money(discount));
    }

    set('totalAmount', money(booking.totalAmount));
  });
})();
