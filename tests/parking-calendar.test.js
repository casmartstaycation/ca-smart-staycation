/**
 * Unit tests for parking calendar booked-mark behavior.
 * These tests verify that isDateBooked() correctly marks dates as booked
 * for bookingType === "parking", "both", and "unit" (accommodation only).
 *
 * Runs with Node.js (no test framework required):
 *   node tests/parking-calendar.test.js
 */

'use strict';

// --- Minimal DOM stub ---
let domState = { bookingType: 'unit', room: '', parking: '' };
const document = {
  getElementById(id) {
    if (id === 'bookingType') return { value: domState.bookingType };
    if (id === 'room') return { value: domState.room };
    if (id === 'parking') return { value: domState.parking };
    return null;
  },
};
global.document = document;

// --- Helpers extracted from frontend/js/script.js (kept in sync) ---
// WARNING: These are manually duplicated from frontend/js/script.js because
// that file is written for a browser environment and cannot be require()'d
// directly. If you change the booking logic in script.js, you MUST update
// these helpers too. The CI workflow checks that key function signatures
// still exist in script.js to catch obvious drift (see fix-parking-calendar.yml).
function idOf(v) {
  if (!v) return '';
  if (typeof v === 'object') return String(v._id || v.id || '');
  return String(v);
}

function bookingHasAccommodation(b) {
  if (!b) return false;
  if (b.parkingOnly === true || String(b.parkingOnly).toLowerCase() === 'true') return false;
  if (idOf(b.room) || idOf(b.unit)) return true;
  const type = String(b.bookingType || b.type || '').trim().toLowerCase().replace(/[\s_-]/g, '');
  return type === 'unit' || type === 'accommodation' || type === 'both' || type === 'accommodationparking';
}

function bookingHasParking(b) {
  if (!b) return false;
  if (b.parkingOnly === true || String(b.parkingOnly).toLowerCase() === 'true') return true;
  if (idOf(b.parking) || idOf(b.parkingSlot) || !!String(b.parkingNumber || '').trim()) return true;
  return false;
}

const TERMINAL = new Set(['cancelled', 'checked out', 'expired']);
function bookingOverlapsDates(booking, start, end) {
  if (!booking) return false;
  const status = String(booking.bookingStatus || '').trim().toLowerCase();
  if (TERMINAL.has(status)) return false;
  const parseDate = (v) => {
    if (!v) return null;
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const [y, m, d] = s.slice(0, 10).split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const dt = new Date(v);
    return Number.isNaN(dt.getTime()) ? null : new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  };
  const bStart = parseDate(booking.checkIn);
  const bEnd = parseDate(booking.checkOut);
  if (!bStart || !bEnd) return false;
  return bStart < end && bEnd > start;
}

let bookedDates = [];
function isDateBooked(date) {
  const type = String(document.getElementById('bookingType')?.value || 'unit').trim().toLowerCase().replace(/[\s_-]/g, ''),
    selectedRoom = String(document.getElementById('room')?.value || '').trim(),
    selectedParking = String(document.getElementById('parking')?.value || '').trim();
  if (!date) return false;
  for (const booking of bookedDates) {
    if (!bookingOverlapsDates(booking, date, new Date(date.getTime() + 86400000))) continue;
    if (type === 'parking' || !selectedRoom) {
      if (bookingHasParking(booking) && (!selectedParking || idOf(booking.parking) === selectedParking)) return true;
    } else if (selectedRoom) {
      if (bookingHasAccommodation(booking) && idOf(booking.room) === selectedRoom) return true;
    }
    if (bookingHasAccommodation(booking) && bookingHasParking(booking)) {
      if (!selectedRoom && selectedParking && idOf(booking.parking) === selectedParking) return true;
      if (selectedRoom && !selectedParking && idOf(booking.room) === selectedRoom) return true;
      if (selectedRoom && selectedParking && (idOf(booking.room) === selectedRoom || idOf(booking.parking) === selectedParking)) return true;
    }
  }
  return false;
}

// --- Test runner ---
let passed = 0;
let failed = 0;
function assert(condition, msg) {
  if (condition) {
    console.log('  PASS:', msg);
    passed++;
  } else {
    console.error('  FAIL:', msg);
    failed++;
  }
}

const d = (y, m, day) => new Date(y, m - 1, day);

console.log('\n=== Parking Calendar Booked-Mark Tests ===\n');

// -- SCENARIO 1: Parking Only, selected slot matches booking --
console.log('Scenario 1: bookingType=parking, selected slot matches booking');
domState = { bookingType: 'parking', room: '', parking: 'slot-A' };
bookedDates = [
  { checkIn: '2026-08-10', checkOut: '2026-08-15', parkingOnly: true, parking: 'slot-A', bookingStatus: 'confirmed' },
];
assert(isDateBooked(d(2026, 8, 10)), 'check-in date is marked booked');
assert(isDateBooked(d(2026, 8, 12)), 'mid-range date is marked booked');
assert(isDateBooked(d(2026, 8, 14)), 'day before checkout is marked booked');
assert(!isDateBooked(d(2026, 8, 15)), 'checkout date itself is NOT booked');
assert(!isDateBooked(d(2026, 8, 9)), 'day before check-in is NOT booked');

// -- SCENARIO 2: Parking Only, no slot selected — any parking booking blocks --
console.log('\nScenario 2: bookingType=parking, no slot selected (any parking booking blocks)');
domState = { bookingType: 'parking', room: '', parking: '' };
bookedDates = [
  { checkIn: '2026-08-10', checkOut: '2026-08-15', parkingOnly: true, parking: 'slot-B', bookingStatus: 'confirmed' },
];
assert(isDateBooked(d(2026, 8, 12)), 'date is marked booked when no specific slot selected');

// -- SCENARIO 3: Parking Only, different slot — should NOT block --
console.log('\nScenario 3: bookingType=parking, different slot selected (no conflict)');
domState = { bookingType: 'parking', room: '', parking: 'slot-Z' };
bookedDates = [
  { checkIn: '2026-08-10', checkOut: '2026-08-15', parkingOnly: true, parking: 'slot-A', bookingStatus: 'confirmed' },
];
assert(!isDateBooked(d(2026, 8, 12)), 'different slot — date is NOT blocked');

// -- SCENARIO 4: bookingType=both, no room selected, parking conflict blocks --
console.log('\nScenario 4: bookingType=both, no room selected, parking conflict');
domState = { bookingType: 'both', room: '', parking: 'slot-A' };
bookedDates = [
  { checkIn: '2026-08-10', checkOut: '2026-08-15', parkingOnly: true, parking: 'slot-A', bookingStatus: 'confirmed' },
];
assert(isDateBooked(d(2026, 8, 12)), '"both" with no room — parking conflict blocks date');

// -- SCENARIO 5: bookingType=unit (accommodation), room conflict --
console.log('\nScenario 5: bookingType=unit, room conflict');
domState = { bookingType: 'unit', room: 'room-1', parking: '' };
bookedDates = [
  { checkIn: '2026-08-10', checkOut: '2026-08-15', parkingOnly: false, room: 'room-1', bookingStatus: 'confirmed' },
];
assert(isDateBooked(d(2026, 8, 12)), 'accommodation date is marked booked');

// -- SCENARIO 6: Cancelled booking must NOT block --
console.log('\nScenario 6: cancelled booking does NOT block');
domState = { bookingType: 'parking', room: '', parking: 'slot-A' };
bookedDates = [
  { checkIn: '2026-08-10', checkOut: '2026-08-15', parkingOnly: true, parking: 'slot-A', bookingStatus: 'cancelled' },
];
assert(!isDateBooked(d(2026, 8, 12)), 'cancelled booking does not block dates');

// -- SCENARIO 7: bookingType=both with room selected, room conflict blocks --
console.log('\nScenario 7: bookingType=both, room selected, room conflict');
domState = { bookingType: 'both', room: 'room-2', parking: '' };
bookedDates = [
  { checkIn: '2026-08-20', checkOut: '2026-08-25', parkingOnly: false, room: 'room-2', bookingStatus: 'confirmed' },
];
assert(isDateBooked(d(2026, 8, 22)), '"both" with room selected: room conflict blocks date');

// --- Summary ---
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
