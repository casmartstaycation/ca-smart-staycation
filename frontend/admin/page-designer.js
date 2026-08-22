/* CA Smart Staycation — Admin Page Designer */
(function () {
  'use strict';

  const API = '/api/settings/page-design';
  const statusEl = document.getElementById('designerStatus');
  const preview = document.getElementById('pagePreview');
  let loadedSettings = null;

  const FIELD_GROUPS = {
    brandFields: [
      ['logoMark','Logo Mark','text'],['brandName','Business Name','text'],['brandTagline','Brand Tagline','text'],
      ['headerGuestLoginLabel','Header Guest Login Button','text'],['headerBookLabel','Header Booking Button','text'],
      ['heroEyebrow','Hero Eyebrow','text'],['heroTitle','Hero Main Title','textarea'],['heroDescription','Hero Description','textarea'],
      ['heroPrimaryButton','Hero Primary Button','text'],['heroLoginText','Hero Guest Login Text','text']
    ],
    bookingFields: [
      ['bookingSectionLabel','Booking Section Label','text'],['bookingTitle','Booking Section Title','text'],['bookingDescription','Booking Section Description','textarea'],
      ['bookingStepTitle','Step 1 Title','text'],['bookingStepDescription','Step 1 Description','text'],
      ['guestStepTitle','Step 2 Title','text'],['guestStepDescription','Step 2 Description','text'],
      ['idStepTitle','Step 3 Title','text'],['idStepDescription','Step 3 Description','text'],
      ['summaryStepTitle','Step 4 Title','text'],['summaryStepDescription','Step 4 Description','text'],
      ['bookingTypeLabel','Booking Type Label','text'],['parkingLabel','Parking Label','text'],['accommodationLabel','Accommodation Label','text'],
      ['datesLabel','Stay Dates Label','text'],['guestsLabel','Guests Label','text'],['childrenLabel','Children Label','text'],
      ['firstNameLabel','First Name Label','text'],['lastNameLabel','Last Name Label','text'],['emailLabel','Email Label','text'],
      ['mobileLabel','Mobile Label','text'],['addressLabel','Address Label','text'],['governmentUploadLabel','Government ID Upload Label','text'],
      ['governmentUploadHelp','Government ID Help Text','text'],['summaryAccommodationLabel','Summary Accommodation Label','text'],
      ['summaryExtraGuestLabel','Summary Extra Guest Label','text'],['summaryParkingLabel','Summary Parking Label','text'],
      ['summaryDepositLabel','Summary Deposit Label','text'],['summaryTotalLabel','Summary Total Label','text']
    ],
    informationFields: [
      ['bookingInfoTitle','Booking Information Heading','text'],
      ['securityInfoTitle','Security Deposit Card Title','text'],['securityInfoText','Security Deposit Card Text','textarea'],
      ['extraGuestInfoTitle','Additional Guest Card Title','text'],['extraGuestInfoText','Additional Guest Card Text','textarea'],
      ['childrenInfoTitle','Children Card Title','text'],['childrenInfoText','Children Card Text','textarea'],
      ['capacityInfoTitle','Capacity Card Title','text'],['capacityInfoText','Capacity Card Text','textarea'],
      ['vehicleTitle','Vehicle Section Title','text'],['vehicleNoticeTitle','Vehicle Notice Title','text'],
      ['vehicleNoticeText','Vehicle Notice Text','textarea'],['vehicleNoParkingText','No Parking Notice','textarea'],
      ['driversLicenseLabel',"Driver's License Label",'text'],['vehicleBrandLabel','Vehicle Brand Label','text'],
      ['vehicleModelLabel','Vehicle Model Label','text'],['vehicleColorLabel','Vehicle Color Label','text'],['plateNumberLabel','Plate Number Label','text']
    ],
    footerFields: [
      ['submitButtonLabel','Submit Button Label','text'],['submitNote','Submit Note','textarea'],
      ['footerTitle','Footer Title','text'],['footerDescription','Footer Description','textarea'],['footerCopyright','Footer Copyright','text']
    ]
  };

  const PRESETS = {
    current:{primaryColor:'#063b32',secondaryColor:'#0b5d4d',accentColor:'#c9a44c',accentLightColor:'#ead79c',pageBackgroundColor:'#eef3ee',cardBackgroundColor:'#ffffff',textColor:'#18332d',mutedTextColor:'#6b746f',inputBorderColor:'#ded7c5',buttonTextColor:'#063b32'},
    navy:{primaryColor:'#102a43',secondaryColor:'#1f4e79',accentColor:'#c6a15b',accentLightColor:'#f0ddb0',pageBackgroundColor:'#edf2f7',cardBackgroundColor:'#ffffff',textColor:'#102a43',mutedTextColor:'#66788a',inputBorderColor:'#cbd5df',buttonTextColor:'#102a43'},
    burgundy:{primaryColor:'#5b1f2a',secondaryColor:'#7a2f3d',accentColor:'#c7a24b',accentLightColor:'#ead69b',pageBackgroundColor:'#f5efee',cardBackgroundColor:'#ffffff',textColor:'#40262a',mutedTextColor:'#78686b',inputBorderColor:'#ddcecf',buttonTextColor:'#4b1c25'},
    charcoal:{primaryColor:'#242424',secondaryColor:'#3b3b3b',accentColor:'#c9a44c',accentLightColor:'#ead79c',pageBackgroundColor:'#ecebe7',cardBackgroundColor:'#ffffff',textColor:'#2c2c2c',mutedTextColor:'#6e6e6e',inputBorderColor:'#d1d1ce',buttonTextColor:'#242424'},
    light:{primaryColor:'#29433b',secondaryColor:'#52766b',accentColor:'#a9853f',accentLightColor:'#f2e7cb',pageBackgroundColor:'#f7f7f4',cardBackgroundColor:'#ffffff',textColor:'#28332f',mutedTextColor:'#707975',inputBorderColor:'#d8ddda',buttonTextColor:'#ffffff'}
  };

  function setStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = 'status' + (type ? ` ${type}` : '');
  }

  function makeField([key, label, type]) {
    const wrapper = document.createElement('label');
    wrapper.textContent = label;
    const control = type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
    if (type === 'textarea') control.rows = 3;
    else control.type = 'text';
    control.dataset.setting = key;
    wrapper.appendChild(control);
    return wrapper;
  }

  function renderGeneratedFields() {
    Object.entries(FIELD_GROUPS).forEach(([containerId, fields]) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      fields.forEach(field => container.appendChild(makeField(field)));
    });
  }

  function controls() {
    return Array.from(document.querySelectorAll('[data-setting]'));
  }

  function fill(settings) {
    controls().forEach(control => {
      const key = control.dataset.setting;
      const value = settings?.[key];
      if (control.type === 'checkbox') control.checked = Boolean(value);
      else if (value !== undefined && value !== null) control.value = value;
    });
  }

  function collect() {
    const result = {};
    controls().forEach(control => {
      const key = control.dataset.setting;
      if (control.type === 'checkbox') result[key] = control.checked;
      else if (control.type === 'number') result[key] = Number(control.value);
      else result[key] = control.value;
    });
    return result;
  }

  function sendPreview() {
    if (!preview?.contentWindow) return;
    preview.contentWindow.postMessage({ type:'ca-smart-page-design-preview', settings:collect() }, window.location.origin);
  }

  async function loadSettings() {
    try {
      const response = await fetch(API, { cache:'no-store', headers:{Accept:'application/json'} });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.message || `HTTP ${response.status}`);
      loadedSettings = payload.data;
      fill(payload.data);
      setStatus('Page Designer ready. Changes are previewed before saving.', 'success');
      setTimeout(sendPreview, 250);
    } catch (error) {
      console.error('Page Designer load:', error);
      setStatus(error.message || 'Unable to load page design settings.', 'error');
    }
  }

  async function saveSettings() {
    const button = document.getElementById('saveDesign');
    button.disabled = true;
    setStatus('Saving guest booking page design…');
    try {
      const response = await fetch(API, { method:'PUT', headers:{'Content-Type':'application/json',Accept:'application/json'}, body:JSON.stringify(collect()) });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.message || `HTTP ${response.status}`);
      loadedSettings = payload.data;
      fill(payload.data);
      sendPreview();
      setStatus('Saved. The live guest booking page now uses these settings.', 'success');
    } catch (error) {
      console.error('Page Designer save:', error);
      setStatus(error.message || 'Unable to save page design.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function resetSettings() {
    if (!confirm('Restore the guest booking page appearance to the August 22, 2026 working design? Booking records, rates, and availability will not be changed.')) return;
    const button = document.getElementById('resetDesign');
    button.disabled = true;
    setStatus('Restoring the August 22 working design…');
    try {
      const response = await fetch(`${API}/reset`, { method:'POST', headers:{Accept:'application/json'} });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.message || `HTTP ${response.status}`);
      loadedSettings = payload.data;
      fill(payload.data);
      sendPreview();
      setStatus('Restored to the August 22, 2026 working design.', 'success');
    } catch (error) {
      setStatus(error.message || 'Unable to restore the page design.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function uploadImage(button) {
    const fileInput = document.getElementById(button.dataset.file);
    const file = fileInput?.files?.[0];
    const target = button.dataset.target;
    if (!file) return setStatus('Choose an image first.', 'error');
    const targetInput = document.querySelector(`[data-setting="${target}"]`);
    button.disabled = true;
    setStatus(`Uploading ${file.name}…`);
    try {
      const form = new FormData();
      form.append('image', file);
      const response = await fetch(`${API}/upload`, { method:'POST', body:form, headers:{Accept:'application/json'} });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.message || `HTTP ${response.status}`);
      targetInput.value = payload.url;
      fileInput.value = '';
      sendPreview();
      setStatus('Image uploaded. Click Save Changes to publish it.', 'success');
    } catch (error) {
      setStatus(error.message || 'Image upload failed.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;
    Object.entries(preset).forEach(([key,value]) => {
      const control = document.querySelector(`[data-setting="${key}"]`);
      if (control) control.value = value;
    });
    sendPreview();
    setStatus('Theme preset applied to the preview. Click Save Changes to publish.', 'success');
  }

  function refreshPreview() {
    preview.src = '/?designerPreview=1&t=' + Date.now();
  }

  renderGeneratedFields();

  if (!window.CASmartAdminAuth?.hasValidToken()) {
    window.location.replace('bookings.html?return=page-designer');
    return;
  }

  document.getElementById('saveDesign').addEventListener('click', saveSettings);
  document.getElementById('resetDesign').addEventListener('click', resetSettings);
  document.getElementById('refreshPreview').addEventListener('click', refreshPreview);
  document.getElementById('themePreset').addEventListener('change', event => applyPreset(event.target.value));
  document.querySelectorAll('.upload-image').forEach(button => button.addEventListener('click', () => uploadImage(button)));
  document.addEventListener('input', event => { if (event.target.matches('[data-setting]')) sendPreview(); });
  document.addEventListener('change', event => { if (event.target.matches('[data-setting]')) sendPreview(); });
  preview.addEventListener('load', () => setTimeout(sendPreview, 350));
  window.addEventListener('beforeunload', () => { loadedSettings = loadedSettings; });

  loadSettings();
})();
