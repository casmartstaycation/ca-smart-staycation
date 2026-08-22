/* CA Smart Staycation — Admin Page Designer phone preview controls */
(function () {
  'use strict';

  const wrap = document.querySelector('.preview-frame-wrap');
  const desktopButton = document.getElementById('previewDesktop');
  const mobileButton = document.getElementById('previewMobile');
  const shortcut = document.getElementById('openMobilePreview');
  const preview = document.getElementById('pagePreview');

  if (!wrap || !desktopButton || !mobileButton || !preview) return;

  function sendCurrentPreview() {
    if (!preview.contentWindow) return;
    const settings = {};
    document.querySelectorAll('[data-setting]').forEach(control => {
      const key = control.dataset.setting;
      if (control.type === 'checkbox') settings[key] = control.checked;
      else if (control.type === 'number') settings[key] = Number(control.value);
      else settings[key] = control.value;
    });
    preview.contentWindow.postMessage({ type:'ca-smart-page-design-preview', settings }, window.location.origin);
  }

  function setMode(mode) {
    const mobile = mode === 'mobile';
    wrap.classList.toggle('mobile-preview', mobile);
    desktopButton.classList.toggle('active', !mobile);
    mobileButton.classList.toggle('active', mobile);
    desktopButton.setAttribute('aria-pressed', String(!mobile));
    mobileButton.setAttribute('aria-pressed', String(mobile));
    if (mobile) {
      wrap.scrollTop = 0;
      wrap.scrollLeft = 0;
    }
    setTimeout(sendCurrentPreview, 100);
  }

  desktopButton.addEventListener('click', () => setMode('desktop'));
  mobileButton.addEventListener('click', () => setMode('mobile'));
  shortcut?.addEventListener('click', () => {
    setMode('mobile');
    document.querySelector('.preview-panel')?.scrollIntoView({ behavior:'smooth', block:'start' });
  });

  setMode('desktop');
})();
