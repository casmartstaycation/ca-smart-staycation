/* CA Smart Staycation — guest account page designer runtime */
(function () {
  'use strict';

  const API_URL = '/api/settings/guest-account-design';
  const STYLE_ID = 'ca-guest-account-designer-style';
  let currentSettings = null;

  const $ = id => document.getElementById(id);
  const one = selector => document.querySelector(selector);

  function safeCssUrl(value) {
    return String(value || '').replace(/[\\'\n\r]/g, match => `\\${match}`);
  }

  function fontValue(value) {
    if (value === 'modern') return '"Trebuchet MS", Arial, sans-serif';
    if (value === 'classic') return 'Georgia, "Times New Roman", serif';
    if (value === 'luxury') return '"Times New Roman", Georgia, serif';
    return 'Arial, Helvetica, sans-serif';
  }

  function shadowValue(value) {
    if (value === 'none') return 'none';
    if (value === 'strong') return '0 20px 55px rgba(0,0,0,.20)';
    return '0 10px 30px rgba(0,0,0,.12)';
  }

  function setText(target, value) {
    const el = typeof target === 'string' ? one(target) : target;
    if (el && value !== undefined && value !== null) el.textContent = String(value);
  }

  function setButtonLabel(id, value) {
    const button = $(id);
    if (!button || value === undefined || value === null) return;
    Array.from(button.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) node.remove();
    });
    button.insertBefore(document.createTextNode(String(value) + (button.firstChild ? ' ' : '')), button.firstChild || null);
  }

  function toggle(selector, visible) {
    const el = one(selector);
    if (el) el.classList.toggle('ca-account-designer-hidden', !visible);
  }

  function applyStyles(settings) {
    let style = $(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    const pageImage = settings.backgroundImageUrl
      ? `url('${safeCssUrl(settings.backgroundImageUrl)}')`
      : 'none';
    const mobileCols = Math.max(1, Math.min(3, Number(settings.mobileToolbarColumns) || 2));

    style.textContent = `
html,body{background-color:${settings.pageBackgroundColor}!important;}
body{
  background-image:${pageImage}!important;
  background-size:cover!important;
  background-position:center!important;
  background-attachment:fixed!important;
  color:${settings.textColor}!important;
  font-family:${fontValue(settings.fontPreset)}!important;
}
.container{
  max-width:${Number(settings.containerMaxWidth)}px!important;
  background:${settings.containerBackgroundColor}!important;
  color:${settings.textColor}!important;
  padding:${Number(settings.containerPadding)}px!important;
  border-radius:${Number(settings.containerRadius)}px!important;
  box-shadow:${shadowValue(settings.shadow)}!important;
}
.container>h1,.section-title{color:${settings.primaryColor}!important;}
.subtitle,.updated,.booking-count,.summary-meta,.message small{color:${settings.mutedTextColor}!important;}
.toolbar button,button{background:${settings.primaryColor}!important;color:${settings.buttonTextColor}!important;border-radius:${Number(settings.buttonRadius)}px!important;}
.tab-button.active,.secondary{background:${settings.accentColor}!important;color:${settings.buttonTextColor}!important;}
.logout{background:${settings.logoutColor}!important;}
.danger{background:${settings.dangerColor}!important;}
.badge{background:${settings.dangerColor}!important;color:#fff!important;}
.panel{background:${settings.panelBackgroundColor}!important;border-color:${settings.borderColor}!important;border-radius:${Number(settings.cardRadius)}px!important;}
.section-title{border-color:${settings.borderColor}!important;}
.notification{background:${settings.notificationBackgroundColor}!important;border-color:${settings.borderColor}!important;border-left-color:${settings.accentColor}!important;border-radius:${Number(settings.cardRadius)}px!important;}
.message{border-color:${settings.borderColor}!important;border-radius:${Number(settings.cardRadius)}px!important;}
.message.guest{background:${settings.guestMessageBackgroundColor}!important;}
.message.admin{background:${settings.adminMessageBackgroundColor}!important;}
.booking-card{background:${settings.cardBackgroundColor}!important;border-color:${settings.borderColor}!important;border-radius:${Number(settings.cardRadius)}px!important;}
.reference{color:${settings.accentColor}!important;}
.status-pill,.refund{background:${settings.notificationBackgroundColor}!important;border-color:${settings.accentColor}!important;}
.refund.done{background:${settings.guestMessageBackgroundColor}!important;border-left-color:${settings.primaryColor}!important;}
.note{background:${settings.noteBackgroundColor}!important;border-left-color:${settings.primaryColor}!important;}
.booking-tools input,.booking-tools select,.compose textarea,.attachment{border-color:${settings.borderColor}!important;}
.attachment{background:${settings.cardBackgroundColor}!important;color:${settings.primaryColor}!important;}
.ca-account-welcome-banner{margin:0 0 18px;padding:12px 14px;border-radius:${Number(settings.cardRadius)}px;background:${settings.notificationBackgroundColor};border:1px solid ${settings.accentColor};color:${settings.textColor};text-align:center;line-height:1.5;}
.ca-account-designer-hidden{display:none!important;}
@media(max-width:700px){
  .container{margin:${Number(settings.mobileContainerMargin)}px!important;padding:${Number(settings.mobileContainerPadding)}px!important;}
  .container>h1{font-size:${Number(settings.mobileTitleSize)}px!important;line-height:1.15!important;}
  .toolbar{grid-template-columns:repeat(${mobileCols},minmax(0,1fr))!important;}
  .toolbar button{font-size:${Number(settings.mobileButtonFontSize)}px!important;}
  .booking-summary,.details,.panel,.notification,.message{padding-left:${Number(settings.mobileCardPadding)}px!important;padding-right:${Number(settings.mobileCardPadding)}px!important;}
}
${String(settings.customCss || '')}
`;
  }

  function applyContent(settings) {
    setText('.container > h1', settings.titleText);
    setText('.subtitle', settings.subtitleText);
    setButtonLabel('bookingsBtn', settings.bookingsButtonText);
    setButtonLabel('notificationBtn', settings.notificationsButtonText);
    setButtonLabel('inboxBtn', settings.inboxButtonText);
    setButtonLabel('newBookingBtn', settings.newBookingButtonText);
    setButtonLabel('settingsBtn', settings.settingsButtonText);
    setButtonLabel('logout', settings.logoutButtonText);
    setText('#notificationPanel .section-title', settings.notificationsTitleText);
    setText('#messagePanel .section-title', settings.messagesTitleText);
    setText('#bookingsPanel .section-title', settings.reservationsTitleText);
    setButtonLabel('sendMessage', settings.sendMessageButtonText);
    const messageText = $('messageText');
    if (messageText) messageText.placeholder = String(settings.messagePlaceholder || '');
    const search = $('bookingSearch');
    if (search) search.placeholder = String(settings.bookingSearchPlaceholder || '');
    setText('#bookingsPanel .note', settings.bookingNoteText);
    setButtonLabel('loadMore', settings.loadMoreText);

    const filterText = {
      all: settings.filterAllText,
      active: settings.filterActiveText,
      pending: settings.filterPendingText,
      confirmed: settings.filterConfirmedText,
      cancelled: settings.filterCancelledText,
      completed: settings.filterCompletedText
    };
    Object.entries(filterText).forEach(([value, label]) => {
      const option = document.querySelector(`#bookingFilter option[value="${value}"]`);
      if (option && label !== undefined) option.textContent = String(label);
    });

    toggle('.subtitle', settings.showSubtitle);
    toggle('.updated', settings.showUpdatedStatus);
    toggle('#bookingsPanel .note', settings.showBookingNote);

    let banner = $('guestAccountWelcomeBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'guestAccountWelcomeBanner';
      banner.className = 'ca-account-welcome-banner';
      const updated = $('updated');
      if (updated) updated.insertAdjacentElement('afterend', banner);
      else one('.subtitle')?.insertAdjacentElement('afterend', banner);
    }
    setText(banner, settings.welcomeBannerText);
    banner.classList.toggle('ca-account-designer-hidden', !settings.showWelcomeBanner || !String(settings.welcomeBannerText || '').trim());

    if (settings.titleText) document.title = `${settings.titleText} | CA Smart Staycation`;
  }

  function apply(settings) {
    if (!settings || typeof settings !== 'object') return;
    currentSettings = settings;
    applyStyles(settings);
    applyContent(settings);
    document.documentElement.dataset.guestAccountDesignerReady = 'true';
  }

  async function load() {
    try {
      const response = await fetch(API_URL, { cache:'no-store', headers:{Accept:'application/json'} });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.message || `HTTP ${response.status}`);
      apply(payload.data);
    } catch (error) {
      console.warn('Guest account design unavailable; using built-in dashboard design.', error);
    }
  }

  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== 'ca-smart-guest-account-preview') return;
    apply(event.data.settings);
  });

  window.CASmartGuestAccountDesigner = { apply, load, current: () => currentSettings };
  document.addEventListener('DOMContentLoaded', load);
})();
