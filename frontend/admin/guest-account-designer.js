/* CA Smart Staycation — Admin Guest Account Page Designer */
(function () {
  'use strict';

  const API = '/api/settings/guest-account-design';
  const statusEl = document.getElementById('designerStatus');
  const preview = document.getElementById('pagePreview');
  const previewWrap = document.querySelector('.preview-frame-wrap');

  const PRESETS = {
    current:{primaryColor:'#0b5d4d',accentColor:'#c9a44c',pageBackgroundColor:'#f4f6f8',containerBackgroundColor:'#ffffff',panelBackgroundColor:'#fafcfb',cardBackgroundColor:'#ffffff',textColor:'#333333',mutedTextColor:'#666666',borderColor:'#dddddd',notificationBackgroundColor:'#fff8e8',guestMessageBackgroundColor:'#e9f3ee',adminMessageBackgroundColor:'#eef2f5',noteBackgroundColor:'#f7faf9',dangerColor:'#b42318',logoutColor:'#777777',buttonTextColor:'#ffffff'},
    navy:{primaryColor:'#173b5f',accentColor:'#c6a15b',pageBackgroundColor:'#eef3f8',containerBackgroundColor:'#ffffff',panelBackgroundColor:'#f7f9fc',cardBackgroundColor:'#ffffff',textColor:'#213344',mutedTextColor:'#657587',borderColor:'#d5dfe8',notificationBackgroundColor:'#fff8e8',guestMessageBackgroundColor:'#e9f1f7',adminMessageBackgroundColor:'#f0f3f6',noteBackgroundColor:'#f5f8fb',dangerColor:'#b42318',logoutColor:'#65717c',buttonTextColor:'#ffffff'},
    burgundy:{primaryColor:'#6b2737',accentColor:'#c7a24b',pageBackgroundColor:'#f7f0f1',containerBackgroundColor:'#ffffff',panelBackgroundColor:'#fcf8f9',cardBackgroundColor:'#ffffff',textColor:'#412d32',mutedTextColor:'#79676b',borderColor:'#e1d3d6',notificationBackgroundColor:'#fff8e8',guestMessageBackgroundColor:'#f4e9ec',adminMessageBackgroundColor:'#f3f0f1',noteBackgroundColor:'#faf6f7',dangerColor:'#a92727',logoutColor:'#73676a',buttonTextColor:'#ffffff'},
    charcoal:{primaryColor:'#30343a',accentColor:'#c9a44c',pageBackgroundColor:'#eceff1',containerBackgroundColor:'#ffffff',panelBackgroundColor:'#f7f8f8',cardBackgroundColor:'#ffffff',textColor:'#2c3034',mutedTextColor:'#6e7378',borderColor:'#d7dadc',notificationBackgroundColor:'#fff8e8',guestMessageBackgroundColor:'#edf1ef',adminMessageBackgroundColor:'#eff1f3',noteBackgroundColor:'#f5f6f6',dangerColor:'#b42318',logoutColor:'#666a6f',buttonTextColor:'#ffffff'},
    light:{primaryColor:'#31594d',accentColor:'#a9853f',pageBackgroundColor:'#fafaf7',containerBackgroundColor:'#ffffff',panelBackgroundColor:'#ffffff',cardBackgroundColor:'#ffffff',textColor:'#28332f',mutedTextColor:'#747d79',borderColor:'#dde2df',notificationBackgroundColor:'#fffaf0',guestMessageBackgroundColor:'#eef6f2',adminMessageBackgroundColor:'#f4f6f7',noteBackgroundColor:'#f8faf9',dangerColor:'#b64238',logoutColor:'#7a817e',buttonTextColor:'#ffffff'}
  };

  function controls() {
    return Array.from(document.querySelectorAll('[data-setting]'));
  }

  function setStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = 'status' + (type ? ` ${type}` : '');
  }

  function fill(settings) {
    controls().forEach(control => {
      const value = settings?.[control.dataset.setting];
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
    preview.contentWindow.postMessage({ type:'ca-smart-guest-account-preview', settings:collect() }, window.location.origin);
  }

  function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;
    Object.entries(preset).forEach(([key, value]) => {
      const control = document.querySelector(`[data-setting="${key}"]`);
      if (control) control.value = value;
    });
    sendPreview();
    setStatus('Theme preset applied to preview. Click Save Changes to publish.', 'success');
  }

  async function loadSettings() {
    try {
      const response = await fetch(API, { cache:'no-store', headers:{Accept:'application/json'} });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.message || `HTTP ${response.status}`);
      fill(payload.data);
      setStatus('Guest Account Designer ready. Changes are preview-only until you click Save Changes.', 'success');
      setTimeout(sendPreview, 250);
    } catch (error) {
      console.error('Guest Account Designer load:', error);
      setStatus(error.message || 'Unable to load guest account design.', 'error');
    }
  }

  async function saveSettings() {
    const button = document.getElementById('saveDesign');
    button.disabled = true;
    setStatus('Saving guest account design…');
    try {
      const response = await fetch(API, { method:'PUT', headers:{'Content-Type':'application/json',Accept:'application/json'}, body:JSON.stringify(collect()) });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.message || `HTTP ${response.status}`);
      fill(payload.data);
      sendPreview();
      setStatus('Saved. The live guest account now uses these settings.', 'success');
    } catch (error) {
      console.error('Guest Account Designer save:', error);
      setStatus(error.message || 'Unable to save guest account design.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function resetSettings() {
    if (!confirm('Restore the guest account to its current working default design? Guest accounts, bookings, messages, and payments will not be changed.')) return;
    const button = document.getElementById('resetDesign');
    button.disabled = true;
    setStatus('Restoring guest account design…');
    try {
      const response = await fetch(`${API}/reset`, { method:'POST', headers:{Accept:'application/json'} });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.message || `HTTP ${response.status}`);
      fill(payload.data);
      sendPreview();
      setStatus('Guest account restored to the current working design.', 'success');
    } catch (error) {
      setStatus(error.message || 'Unable to restore guest account design.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function uploadImage(button) {
    const fileInput = document.getElementById(button.dataset.file);
    const file = fileInput?.files?.[0];
    const targetInput = document.querySelector(`[data-setting="${button.dataset.target}"]`);
    if (!file) return setStatus('Choose an image first.', 'error');
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
      setStatus('Background image uploaded. Click Save Changes to publish it.', 'success');
    } catch (error) {
      setStatus(error.message || 'Image upload failed.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  function setPreviewMode(mode) {
    const mobile = mode === 'mobile';
    previewWrap?.classList.toggle('mobile-preview', mobile);
    const desktopButton = document.getElementById('previewDesktop');
    const mobileButton = document.getElementById('previewMobile');
    desktopButton?.classList.toggle('active', !mobile);
    mobileButton?.classList.toggle('active', mobile);
    desktopButton?.setAttribute('aria-pressed', String(!mobile));
    mobileButton?.setAttribute('aria-pressed', String(mobile));
    setTimeout(sendPreview, 100);
  }

  function refreshPreview() {
    preview.src = 'guest-account-preview.html?designerPreview=1&t=' + Date.now();
  }

  if (!window.CASmartAdminAuth?.hasValidToken()) {
    window.location.replace('bookings.html?return=guest-account-designer');
    return;
  }

  document.getElementById('saveDesign').addEventListener('click', saveSettings);
  document.getElementById('resetDesign').addEventListener('click', resetSettings);
  document.getElementById('refreshPreview').addEventListener('click', refreshPreview);
  document.getElementById('previewDesktop').addEventListener('click', () => setPreviewMode('desktop'));
  document.getElementById('previewMobile').addEventListener('click', () => setPreviewMode('mobile'));
  document.getElementById('themePreset').addEventListener('change', event => applyPreset(event.target.value));
  document.querySelectorAll('.upload-image').forEach(button => button.addEventListener('click', () => uploadImage(button)));
  document.addEventListener('input', event => { if (event.target.matches('[data-setting]')) sendPreview(); });
  document.addEventListener('change', event => { if (event.target.matches('[data-setting]')) sendPreview(); });
  preview.addEventListener('load', () => setTimeout(sendPreview, 300));

  loadSettings();
})();
