/* CA Smart Staycation - reliable GitHub-only booking request delivery */
(function () {
  'use strict';

  if (!window.location.hostname.endsWith('github.io')) return;

  const SUPPORT_EMAIL = 'booking@casmartstaycation.com';
  const form = document.getElementById('guestBookingForm');
  if (!form) return;

  const value = (id) => {
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  };

  const text = (id) => {
    const el = document.getElementById(id);
    return el ? String(el.textContent || '').trim() : '';
  };

  function bookingTypeLabel(type) {
    if (type === 'parking') return 'Parking Only';
    if (type === 'both') return 'Accommodation + Parking';
    return 'Accommodation Only';
  }

  function buildRequest() {
    const checkIn = value('checkIn');
    const checkOut = value('checkOut');
    const firstName = value('firstName');
    const lastName = value('lastName');
    const email = value('email');
    const mobile = value('mobile');
    const type = value('bookingType') || 'unit';

    if (!checkIn || !checkOut || !firstName || !lastName || !email || !mobile) {
      return null;
    }

    const roomSelect = document.getElementById('room');
    const roomName = roomSelect && roomSelect.selectedOptions && roomSelect.selectedOptions[0]
      ? roomSelect.selectedOptions[0].textContent.trim()
      : '';

    const lines = [
      'CA Smart Staycation - Booking Request',
      '',
      'IMPORTANT: This is a booking request only. The host must manually confirm availability before payment.',
      '',
      `Booking Type: ${bookingTypeLabel(type)}`,
      `Accommodation: ${type === 'parking' ? 'N/A' : (roomName || 'Unit 719')}`,
      `Check-in: ${checkIn}`,
      `Check-out: ${checkOut}`,
      `Guests (3+): ${type === 'parking' ? 'N/A' : (value('guests') || '0')}`,
      `Children (0-2): ${type === 'parking' ? 'N/A' : (value('children') || '0')}`,
      `Parking Requested: ${type === 'parking' || type === 'both' ? 'Yes' : 'No'}`,
      `Displayed Total: ${text('totalAmount') || 'Please confirm'}`,
      '',
      `Guest Name: ${firstName} ${lastName}`,
      `Email: ${email}`,
      `Mobile: ${mobile}`,
      `Address: ${value('address') || 'Not provided'}`
    ];

    if (type === 'parking' || type === 'both') {
      lines.push(
        '',
        'Vehicle Information:',
        `Brand: ${value('vehicleBrand') || 'Not provided'}`,
        `Model: ${value('vehicleModel') || 'Not provided'}`,
        `Color: ${value('vehicleColor') || 'Not provided'}`,
        `Plate Number: ${value('plateNumber') || 'Not provided'}`
      );
    }

    lines.push(
      '',
      'Please reply to confirm the dates and provide the next payment/ID instructions.',
      '',
      'Sent from the temporary CA Smart Staycation GitHub Pages booking form.'
    );

    return {
      body: lines.join('\n'),
      subject: `Booking Request - ${checkIn} to ${checkOut}`
    };
  }

  function copyText(textValue, textarea, status) {
    const success = () => {
      status.textContent = 'Booking request copied. You can paste it into any email or messaging app.';
      status.style.color = '#0b5d4d';
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textValue).then(success).catch(() => {
        textarea.focus();
        textarea.select();
        try {
          document.execCommand('copy');
          success();
        } catch (_) {
          status.textContent = 'Select the request text and copy it manually.';
          status.style.color = '#b42318';
        }
      });
      return;
    }

    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      success();
    } catch (_) {
      status.textContent = 'Select the request text and copy it manually.';
      status.style.color = '#b42318';
    }
  }

  function showDeliveryPanel(request) {
    let panel = document.getElementById('githubBookingDeliveryPanel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'githubBookingDeliveryPanel';
      panel.style.cssText = 'margin:22px 0;padding:22px;background:#fff;border:2px solid #c9a44c;border-radius:14px;box-shadow:0 8px 24px rgba(6,59,50,.12);';
      panel.innerHTML = `
        <h3 style="margin:0 0 8px;color:#063b32;">Booking Request Ready</h3>
        <p style="margin:0 0 14px;line-height:1.55;color:#5f6b67;"><strong>Your request has been prepared but has not been sent yet.</strong> Choose one of the sending options below.</p>
        <div style="padding:12px 14px;margin-bottom:14px;background:#fff8df;border:1px solid #d5a62b;border-radius:9px;color:#5a4610;line-height:1.5;">Send this request to <strong>${SUPPORT_EMAIL}</strong>. The host must manually confirm availability before payment.</div>
        <textarea id="githubBookingRequestText" readonly style="width:100%;box-sizing:border-box;min-height:280px;padding:12px;border:1px solid #ccd5d1;border-radius:8px;font:13px/1.5 monospace;background:#fafcfb;"></textarea>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
          <button type="button" id="githubOpenGmail" class="continue-button" style="flex:1;min-width:150px;">Open Gmail</button>
          <button type="button" id="githubOpenEmailApp" class="continue-button" style="flex:1;min-width:150px;">Open Email App</button>
          <button type="button" id="githubCopyRequest" class="continue-button" style="flex:1;min-width:150px;">Copy Request</button>
        </div>
        <p id="githubBookingDeliveryStatus" role="status" aria-live="polite" style="margin:12px 0 0;font-size:13px;color:#68736e;"></p>
      `;
      form.insertAdjacentElement('afterend', panel);
    }

    const textarea = panel.querySelector('#githubBookingRequestText');
    const status = panel.querySelector('#githubBookingDeliveryStatus');
    textarea.value = request.body;
    status.textContent = 'Choose Gmail, your email app, or copy the request.';
    status.style.color = '#68736e';

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}&su=${encodeURIComponent(request.subject)}&body=${encodeURIComponent(request.body)}`;
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(request.subject)}&body=${encodeURIComponent(request.body)}`;

    panel.querySelector('#githubOpenGmail').onclick = () => {
      const opened = window.open(gmailUrl, '_blank', 'noopener');
      status.textContent = opened ? 'Gmail opened in a new tab. Review the message, then press Send.' : 'Your browser blocked the new tab. Use Copy Request instead.';
      status.style.color = opened ? '#0b5d4d' : '#b42318';
    };

    panel.querySelector('#githubOpenEmailApp').onclick = () => {
      status.textContent = 'Opening your default email app. If nothing opens, use Open Gmail or Copy Request.';
      status.style.color = '#0b5d4d';
      window.location.href = mailtoUrl;
    };

    panel.querySelector('#githubCopyRequest').onclick = () => copyText(request.body, textarea, status);

    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const request = buildRequest();
    if (!request) {
      alert('Please complete your dates and required guest information first.');
      return;
    }

    showDeliveryPanel(request);
  }, true);

  console.info('[CA Smart Staycation] Reliable GitHub booking request delivery is enabled.');
})();
