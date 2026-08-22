/* CA Smart Staycation — guest booking page designer runtime */
(function () {
  'use strict';

  const API_URL = '/api/settings/page-design';
  const STYLE_ID = 'ca-page-designer-style';
  let currentSettings = null;

  const $ = id => document.getElementById(id);
  const one = selector => document.querySelector(selector);
  const all = selector => Array.from(document.querySelectorAll(selector));

  function text(selector, value) {
    const el = typeof selector === 'string' ? one(selector) : selector;
    if (el && value !== undefined && value !== null) el.textContent = String(value);
  }

  function multiline(selector, value) {
    const el = typeof selector === 'string' ? one(selector) : selector;
    if (!el || value === undefined || value === null) return;
    el.replaceChildren();
    String(value).split(/\r?\n/).forEach((line, index) => {
      if (index) el.appendChild(document.createElement('br'));
      el.appendChild(document.createTextNode(line));
    });
  }

  function labelFor(id, value) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label && value !== undefined) label.textContent = String(value);
  }

  function summaryLabel(amountId, value) {
    const amount = $(amountId);
    const row = amount?.closest('.summary-row');
    const label = row?.querySelector('span:first-child, strong:first-child');
    if (label && value !== undefined) label.textContent = String(value);
  }

  function setButtonLabel(button, value, arrow) {
    if (!button || value === undefined) return;
    button.replaceChildren(document.createTextNode(String(value) + ' '));
    if (arrow) {
      const span = document.createElement('span');
      span.textContent = arrow;
      button.appendChild(span);
    }
  }

  function safeCssUrl(value) {
    return String(value || '').replace(/[\\'\n\r]/g, match => `\\${match}`);
  }

  function hexToRgba(hex, opacity) {
    const match = /^#([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!match) return `rgba(0,0,0,${Number(opacity) || 0})`;
    const value = parseInt(match[1], 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r},${g},${b},${Math.min(.9, Math.max(0, Number(opacity) || 0))})`;
  }

  function shadowValue(value) {
    if (value === 'none') return 'none';
    if (value === 'strong') return '0 22px 55px rgba(6,59,50,.22)';
    return '0 15px 35px rgba(0,0,0,.08)';
  }

  function fontValue(value) {
    if (value === 'modern') return '"Trebuchet MS", Arial, sans-serif';
    if (value === 'clean') return 'Arial, Helvetica, sans-serif';
    if (value === 'luxury') return '"Times New Roman", Georgia, serif';
    return 'Georgia, "Times New Roman", serif';
  }

  function applyStyles(settings) {
    let style = $(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    const overlay = hexToRgba(settings.heroOverlayColor, settings.heroOverlayOpacity);
    const heroImage = settings.heroImageUrl
      ? `linear-gradient(${overlay},${overlay}),url('${safeCssUrl(settings.heroImageUrl)}')`
      : `linear-gradient(${overlay},${overlay})`;
    const pageImage = settings.pageBackgroundImageUrl
      ? `url('${safeCssUrl(settings.pageBackgroundImageUrl)}')`
      : 'none';

    style.textContent = `
:root{
  --emerald-dark:${settings.primaryColor};
  --emerald:${settings.secondaryColor};
  --emerald-light:${settings.secondaryColor};
  --gold-dark:${settings.accentColor};
  --gold:${settings.accentColor};
  --gold-light:${settings.accentLightColor};
  --cream:${settings.pageBackgroundColor};
  --white:${settings.cardBackgroundColor};
  --text-dark:${settings.textColor};
  --text-light:${settings.mutedTextColor};
  --border:${settings.inputBorderColor};
}
body{
  background-color:${settings.pageBackgroundColor}!important;
  background-image:${pageImage}!important;
  background-size:cover!important;
  background-position:center!important;
  background-attachment:fixed!important;
  color:${settings.textColor}!important;
  font-family:${fontValue(settings.fontPreset)}!important;
}
.hero::before{
  background-image:${heroImage}!important;
  background-size:cover!important;
  background-position:center!important;
  filter:none!important;
}
.hero::after{background:linear-gradient(to bottom,rgba(248,246,242,0),${settings.pageBackgroundColor})!important;}
.booking-container{background:${settings.cardBackgroundColor}!important;border-radius:${Number(settings.containerRadius)}px!important;}
.form-card,.summary-box,.booking-calendar-card{border-radius:${Number(settings.cardRadius)}px!important;}
.form-card{background:${settings.cardBackgroundColor}!important;box-shadow:${shadowValue(settings.cardShadow)}!important;}
input,select,textarea{border-color:${settings.inputBorderColor}!important;}
.gold-button,.continue-button{border-radius:${Number(settings.buttonRadius)}px!important;color:${settings.buttonTextColor}!important;}
.page-announcement{margin:0 auto 26px;padding:14px 18px;border:1px solid ${settings.accentColor};border-radius:${Math.max(8, Number(settings.buttonRadius))}px;background:${settings.accentLightColor};color:${settings.primaryColor};font-family:Arial,sans-serif;text-align:center;font-weight:700;}
.ca-page-designer-hidden{display:none!important;}
${String(settings.customCss || '')}
`;
  }

  function applyContent(settings) {
    text('.logo-icon', settings.logoMark);
    text('.logo-area h1', settings.brandName);
    text('.logo-area p', settings.brandTagline);

    const headerButtons = all('.header .header-button');
    if (headerButtons[0]) text(headerButtons[0], settings.headerGuestLoginLabel);
    if (headerButtons[1]) text(headerButtons[1], settings.headerBookLabel);

    text('.hero .eyebrow', settings.heroEyebrow);
    multiline('.hero h2', settings.heroTitle);
    text('.hero-description', settings.heroDescription);
    text('.hero .gold-button', settings.heroPrimaryButton);
    const heroLogin = one('.hero-content a[href*="guest-login"]');
    if (heroLogin) text(heroLogin, settings.heroLoginText);

    text('.booking-heading .section-label', settings.bookingSectionLabel);
    text('.booking-heading h2', settings.bookingTitle);
    text('.booking-heading > p:not(.section-label)', settings.bookingDescription);

    const cards = all('#guestBookingForm > .form-card');
    const stepValues = [
      [settings.bookingStepTitle, settings.bookingStepDescription],
      [settings.guestStepTitle, settings.guestStepDescription],
      [settings.idStepTitle, settings.idStepDescription],
      [settings.summaryStepTitle, settings.summaryStepDescription]
    ];
    stepValues.forEach((pair, index) => {
      const card = cards[index];
      if (!card) return;
      text(card.querySelector('.step-title h3'), pair[0]);
      text(card.querySelector('.step-title p'), pair[1]);
    });

    labelFor('bookingType', settings.bookingTypeLabel);
    labelFor('parking', settings.parkingLabel);
    labelFor('room', settings.accommodationLabel);
    const datesLabel = $('checkIn')?.parentElement?.querySelector(':scope > label');
    if (datesLabel) text(datesLabel, settings.datesLabel);
    labelFor('guests', settings.guestsLabel);
    labelFor('children', settings.childrenLabel);
    labelFor('firstName', settings.firstNameLabel);
    labelFor('lastName', settings.lastNameLabel);
    labelFor('email', settings.emailLabel);
    labelFor('mobile', settings.mobileLabel);
    labelFor('address', settings.addressLabel);

    const upload = one('#governmentIdSection .upload-box');
    text(upload?.querySelector('strong'), settings.governmentUploadLabel);
    text(upload?.querySelector('small'), settings.governmentUploadHelp);

    summaryLabel('roomAmount', settings.summaryAccommodationLabel);
    summaryLabel('extraGuestAmount', settings.summaryExtraGuestLabel);
    summaryLabel('parkingAmount', settings.summaryParkingLabel);
    summaryLabel('securityDepositAmount', settings.summaryDepositLabel);
    summaryLabel('totalAmount', settings.summaryTotalLabel);

    const summary = $('bookingSummary');
    text(summary?.querySelector(':scope > h3'), settings.bookingInfoTitle);
    const infoCards = summary ? Array.from(summary.querySelectorAll('.booking-info-card')) : [];
    const infoValues = [
      [settings.securityInfoTitle, settings.securityInfoText],
      [settings.extraGuestInfoTitle, settings.extraGuestInfoText],
      [settings.childrenInfoTitle, settings.childrenInfoText],
      [settings.capacityInfoTitle, settings.capacityInfoText]
    ];
    infoValues.forEach((pair, index) => {
      const card = infoCards[index];
      if (!card) return;
      text(card.querySelector('h4'), pair[0]);
      text(card.querySelector('p'), pair[1]);
    });

    const vehicle = $('vehicleSection');
    text(vehicle?.querySelector(':scope > h3'), settings.vehicleTitle);
    const notice = vehicle?.querySelector('.vehicle-note');
    text(notice?.querySelector('strong'), settings.vehicleNoticeTitle);
    const noticeParagraphs = notice ? notice.querySelectorAll('p') : [];
    if (noticeParagraphs[0]) text(noticeParagraphs[0], settings.vehicleNoticeText);
    if (noticeParagraphs[1]) text(noticeParagraphs[1], settings.vehicleNoParkingText);
    const vehicleLabels = vehicle ? vehicle.querySelectorAll(':scope > label') : [];
    const vehicleLabelValues = [settings.driversLicenseLabel, settings.vehicleBrandLabel, settings.vehicleModelLabel, settings.vehicleColorLabel, settings.plateNumberLabel];
    vehicleLabelValues.forEach((value, index) => { if (vehicleLabels[index]) text(vehicleLabels[index], value); });

    const submit = one('.form-action .continue-button');
    setButtonLabel(submit, settings.submitButtonLabel, '→');
    text('.form-action > p', settings.submitNote);

    const footer = one('footer');
    text(footer?.querySelector('div > h3'), settings.footerTitle);
    const footerParagraphs = footer?.querySelectorAll('div > p');
    if (footerParagraphs?.[0]) text(footerParagraphs[0], settings.footerDescription);
    text(footer?.querySelector(':scope > p'), settings.footerCopyright);

    const hero = one('.hero');
    const headerLogin = headerButtons[0];
    hero?.classList.toggle('ca-page-designer-hidden', !settings.showHero);
    footer?.classList.toggle('ca-page-designer-hidden', !settings.showFooter);
    headerLogin?.classList.toggle('ca-page-designer-hidden', !settings.showGuestLoginLinks);
    heroLogin?.classList.toggle('ca-page-designer-hidden', !settings.showGuestLoginLinks);

    const infoTitle = summary?.querySelector(':scope > h3');
    const infoDivider = summary ? Array.from(summary.querySelectorAll(':scope > hr')).at(-1) : null;
    [infoTitle, infoDivider, ...infoCards].forEach(el => el?.classList.toggle('ca-page-designer-hidden', !settings.showBookingInfo));

    let announcement = $('pageAnnouncement');
    if (!announcement) {
      announcement = document.createElement('div');
      announcement.id = 'pageAnnouncement';
      announcement.className = 'page-announcement';
      const heading = one('.booking-heading');
      heading?.insertAdjacentElement('afterend', announcement);
    }
    text(announcement, settings.announcementText);
    announcement.classList.toggle('ca-page-designer-hidden', !settings.showAnnouncement || !String(settings.announcementText || '').trim());
  }

  function apply(settings) {
    if (!settings || typeof settings !== 'object') return;
    currentSettings = settings;
    applyStyles(settings);
    applyContent(settings);
    document.documentElement.dataset.pageDesignerReady = 'true';
  }

  async function load() {
    try {
      const response = await fetch(API_URL, { cache: 'no-store', headers: { Accept: 'application/json' } });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.message || `HTTP ${response.status}`);
      apply(payload.data);
    } catch (error) {
      console.warn('Guest page designer settings unavailable; using built-in page design.', error);
    }
  }

  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== 'ca-smart-page-design-preview') return;
    apply(event.data.settings);
  });

  window.CASmartPageDesigner = { apply, load, current: () => currentSettings };
  document.addEventListener('DOMContentLoaded', load);
})();
