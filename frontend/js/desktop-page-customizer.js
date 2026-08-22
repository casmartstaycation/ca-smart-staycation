/* CA Smart Staycation — desktop-specific guest booking page designer runtime */
(function () {
  'use strict';

  const API_URL = '/api/settings/page-design';
  const STYLE_ID = 'ca-desktop-page-designer-style';

  function number(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  function apply(settings) {
    if (!settings || typeof settings !== 'object') return;

    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    const maxWidth = number(settings.desktopHeroContentMaxWidth, 720, 420, 1200);
    const paddingX = number(settings.desktopHeroContentPaddingX, 32, 0, 90);
    const paddingY = number(settings.desktopHeroContentPaddingY, 22, 0, 80);
    const titleSize = number(settings.desktopHeroTitleSize, 58, 30, 90);
    const titleLineHeight = number(settings.desktopHeroTitleLineHeight, 1.04, 0.85, 1.5);
    const eyebrowSize = number(settings.desktopHeroEyebrowSize, 11, 8, 20);
    const eyebrowSpacing = number(settings.desktopHeroEyebrowLetterSpacing, 3.2, 0, 8);
    const eyebrowMargin = number(settings.desktopHeroEyebrowMarginBottom, 16, 0, 40);
    const descriptionSize = number(settings.desktopHeroDescriptionSize, 16, 11, 28);
    const descriptionTop = number(settings.desktopHeroDescriptionMarginTop, 18, 0, 50);
    const descriptionBottom = number(settings.desktopHeroDescriptionMarginBottom, 24, 0, 60);
    const buttonSize = number(settings.desktopHeroButtonFontSize, 13, 10, 22);
    const loginSize = number(settings.desktopHeroLoginFontSize, 13, 10, 22);
    const verticalOffset = number(settings.desktopHeroVerticalOffset, -60, -180, 140);
    const panelOpacity = number(settings.desktopHeroPanelOpacity, 0.22, 0, 0.9);
    const panelRadius = number(settings.desktopHeroPanelRadius, 18, 0, 50);

    style.textContent = `
@media (min-width:601px){
  .hero-content{
    width:100%!important;
    max-width:${maxWidth}px!important;
    padding:${paddingY}px ${paddingX}px!important;
    transform:translateX(0)!important translateY(${verticalOffset}px)!important;
    background:rgba(10,30,20,${panelOpacity})!important;
    border-radius:${panelRadius}px!important;
    box-sizing:border-box!important;
  }
  .hero .eyebrow{
    font-size:${eyebrowSize}px!important;
    letter-spacing:${eyebrowSpacing}px!important;
    margin-bottom:${eyebrowMargin}px!important;
    line-height:1.35!important;
  }
  .hero h2{
    font-size:${titleSize}px!important;
    line-height:${titleLineHeight}!important;
    max-width:100%!important;
  }
  .hero-description{
    max-width:100%!important;
    font-size:${descriptionSize}px!important;
    line-height:1.5!important;
    margin:${descriptionTop}px 0 ${descriptionBottom}px!important;
  }
  .hero .gold-button{font-size:${buttonSize}px!important;}
  .hero-content a[href*="guest-login"]{font-size:${loginSize}px!important;}
}
`;

    document.documentElement.dataset.desktopPageDesignerReady = 'true';
  }

  async function waitForBaseSettings() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const current = window.CASmartPageDesigner?.current?.();
      if (current) {
        apply(current);
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return false;
  }

  async function load() {
    try {
      if (await waitForBaseSettings()) return;
      const response = await fetch(API_URL, { cache:'no-store', headers:{Accept:'application/json'} });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.message || `HTTP ${response.status}`);
      apply(payload.data);
    } catch (error) {
      console.warn('Desktop page designer settings unavailable; using built-in desktop hero CSS.', error);
    }
  }

  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== 'ca-smart-page-design-preview') return;
    apply(event.data.settings);
  });

  window.CASmartDesktopPageDesigner = { apply };
  document.addEventListener('DOMContentLoaded', load);
})();
