/* Guest cancellation policy override.
 * Keeps the dashboard confirmation aligned with the server-side refund calculation.
 */
(function(){
  'use strict';

  const API = '/api';
  const TOKEN_KEY = 'guestAuthToken';
  const ACTIVE_STATUSES = new Set(['Waiting for Payment','Reserved','Pending Payment Verification','Payment Rejected','Confirmed']);
  let bookings = new Map();
  let syncTimer = null;

  const money = value => `₱${Number(value || 0).toLocaleString('en-PH')}`;
  const token = () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
  const auth = () => ({ Authorization: `Bearer ${token()}` });

  function phDateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
    return values.year && values.month && values.day ? `${values.year}-${values.month}-${values.day}` : null;
  }

  function ordinal(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key || ''))) return null;
    const [y,m,d] = key.split('-').map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  }

  function daysUntilCheckIn(checkIn) {
    const target = ordinal(phDateKey(checkIn));
    const today = ordinal(phDateKey(new Date()));
    return Number.isFinite(target) && Number.isFinite(today) ? target - today : null;
  }

  function policy(booking) {
    const total = Math.max(0, Number(booking?.totalAmount || 0));
    const days = daysUntilCheckIn(booking?.checkIn);
    const created = new Date(booking?.createdAt || Date.now());
    const minutes = Number.isNaN(created.getTime()) ? Infinity : Math.max(0, (Date.now() - created.getTime()) / 60000);

    if (days === null || days <= 0) {
      return { type:'nonrefundable', fee:total, refund:0, rule:'Cancellation on the check-in date is non-refundable' };
    }
    if (days <= 2) {
      const refund = Math.round(total * 0.5);
      return { type:'percentage', fee:Math.max(0,total-refund), refund, rule:'Cancellation 1–2 days before check-in — 50% refund' };
    }
    if (minutes <= 30) {
      const fee = Math.min(500,total);
      return { type:'fee', fee, refund:Math.max(0,total-fee), rule:'Cancellation within 30 minutes after booking — ₱500 convenience fee' };
    }
    const fee = Math.min(1000,total);
    return {
      type:'fee', fee, refund:Math.max(0,total-fee),
      rule: minutes <= 1440
        ? 'Cancellation 30 minutes to 24 hours after booking — ₱1,000 convenience fee'
        : 'Cancellation more than 24 hours after booking and more than 2 days before check-in — ₱1,000 convenience fee'
    };
  }

  function canCancel(booking) {
    const days = daysUntilCheckIn(booking?.checkIn);
    return ACTIVE_STATUSES.has(String(booking?.bookingStatus || '')) && days !== null && days >= 0 && !booking?.complimentaryNonCancellable && Number(booking?.voucherDiscountPercent || 0) !== 100;
  }

  async function loadBookings() {
    if (!token()) return;
    try {
      const response = await fetch(`${API}/guest-auth/me`, { headers:auth(), cache:'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const list = Array.isArray(payload.bookings) ? payload.bookings : [];
      bookings = new Map(list.map(item => [String(item._id || ''), item]));
      syncCards();
    } catch (_) {}
  }

  function findBookingForButton(button) {
    const card = button?.closest?.('.booking-card');
    if (!card) return null;
    return bookings.get(String(card.dataset.bookingId || '')) || null;
  }

  function confirmationText(booking) {
    const paid = booking.paymentStatus === 'Paid' || Boolean(booking.paymentProof);
    if (!paid) return `Cancel ${booking.bookingReference}?\n\nNo payment is recorded, so no refund is required.\n\nContinue?`;
    const p = policy(booking);
    if (p.type === 'nonrefundable') {
      return `Cancel ${booking.bookingReference}?\n\nRule: ${p.rule}\nRefund due: ₱0\n\nContinue?`;
    }
    if (p.type === 'percentage') {
      return `Cancel ${booking.bookingReference}?\n\nRule: ${p.rule}\nRefund due: ${money(p.refund)}\nNon-refundable amount: ${money(p.fee)}\n\nContinue?`;
    }
    return `Cancel ${booking.bookingReference}?\n\nRule: ${p.rule}\nConvenience fee: ${money(p.fee)}\nEstimated refund: ${money(p.refund)}\n\nContinue?`;
  }

  async function cancel(booking, button) {
    if (!booking || !canCancel(booking)) return;
    if (!confirm(confirmationText(booking))) return;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Cancelling...';
    try {
      const response = await fetch(`${API}/guest-auth/bookings/${encodeURIComponent(booking._id)}/cancel`, {
        method:'POST',
        headers:{ ...auth(), 'Content-Type':'application/json' },
        body:JSON.stringify({ reason:'Guest requested cancellation' })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Unable to cancel booking.');
      alert(payload.message || 'Booking cancelled.');
      window.location.reload();
    } catch (error) {
      alert(error.message || 'Unable to cancel booking.');
      button.disabled = false;
      button.textContent = original || 'Cancel Booking';
    }
  }

  function syncCards() {
    document.querySelectorAll('.booking-card').forEach(card => {
      const booking = bookings.get(String(card.dataset.bookingId || ''));
      if (!booking) return;
      const actions = card.querySelector('.booking-actions');
      if (actions && canCancel(booking) && !Array.from(actions.querySelectorAll('button')).some(b => b.textContent.trim() === 'Cancel Booking')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'danger';
        button.textContent = 'Cancel Booking';
        button.dataset.refundPolicyCancel = '1';
        actions.appendChild(button);
      }
      if (booking.bookingStatus === 'Cancelled' && booking.refundStatus === 'Not Eligible') {
        const note = card.querySelector('.details .note');
        if (note) note.textContent = `Your booking was cancelled. ${booking.refundPolicyRule || 'This cancellation is non-refundable.'}`;
        const details = card.querySelector('.details');
        if (details && !details.querySelector('[data-nonrefundable-notice]')) {
          const box = document.createElement('div');
          box.className = 'refund';
          box.dataset.nonrefundableNotice = '1';
          box.textContent = `Non-refundable cancellation. Refund due: ₱0.`;
          details.appendChild(box);
        }
      }
    });
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('.booking-actions button.danger');
    if (!button || button.textContent.trim() !== 'Cancel Booking') return;
    const booking = findBookingForButton(button);
    if (!booking) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cancel(booking, button);
  }, true);

  const observer = new MutationObserver(() => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncCards, 50);
  });

  function boot() {
    observer.observe(document.getElementById('bookingsList') || document.body, { childList:true, subtree:true });
    loadBookings();
    setTimeout(loadBookings, 800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
