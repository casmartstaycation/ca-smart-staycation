/* CA Smart Staycation — phone-specific guest booking page designer runtime */
(function () {
  'use strict';

  const API_URL = '/api/settings/page-design';
  const STYLE_ID = 'ca-mobile-page-designer-style';

  function number(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  function option(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
  }

  function apply(settings) {
    if (!settings || typeof settings !== 'object') return;

    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    const heroMinHeight = number(settings.mobileHeroMinHeight, 480, 320, 900);
    const contentPaddingX = number(settings.mobileHeroContentPaddingX, 16, 0, 40);
    const contentPaddingY = number(settings.mobileHeroContentPaddingY, 18, 0, 60);
    const titleSize = number(settings.mobileHeroTitleSize, 36, 22, 60);
    const titleLineHeight = number(settings.mobileHeroTitleLineHeight, 1.06, 0.9, 1.5);
    const eyebrowSize = number(settings.mobileHeroEyebrowSize, 10, 8, 18);
    const eyebrowSpacing = number(settings.mobileHeroEyebrowLetterSpacing, 2, 0, 6);
    const eyebrowMargin = number(settings.mobileHeroEyebrowMarginBottom, 12, 0, 30);
    const descriptionSize = number(settings.mobileHeroDescriptionSize, 13, 10, 22);
    const descriptionTop = number(settings.mobileHeroDescriptionMarginTop, 14, 0, 40);
    const descriptionBottom = number(settings.mobileHeroDescriptionMarginBottom, 18, 0, 50);
    const buttonSize = number(settings.mobileHeroButtonFontSize, 12, 9, 20);
    const loginSize = number(settings.mobileHeroLoginFontSize, 12, 9, 20);
    const headerTitleSize = number(settings.mobileHeaderTitleSize, 18, 14, 28);
    const headerButtonSize = number(settings.mobileHeaderButtonSize, 11, 9, 18);
    const bookingTitleSize = number(settings.mobileBookingTitleSize, 30, 22, 44);
    const bookingPaddingX = number(settings.mobileBookingPaddingX, 10, 6, 30);
    const cardPadding = number(settings.mobileCardPadding, 14, 8, 32);
    const imagePosition = option(settings.mobileHeroImagePosition, ['left', 'center', 'right'], 'center');
    const textAlign = option(settings.mobileHeroTextAlign, ['left', 'center'], 'left');
    const stackActions = Boolean(settings.mobileStackHeroActions);

    const actionLayout = stackActions
      ? `
.hero .gold-button{display:block!important;width:100%!important;margin:0 0 10px!important;text-align:center!important;}
.hero-content a[href*="guest-login"]{display:block!important;width:100%!important;margin:0!important;text-align:center!important;}
`
      : `
.hero .gold-button{display:inline-block!important;width:auto!important;margin:0!important;}
.hero-content a[href*="guest-login"]{display:inline-block!important;width:auto!important;margin-left:10px!important;}
`;

    style.textContent = `
@media (max-width:600px){
  .header .logo-area h1{font-size:${headerTitleSize}px!important;line-height:1.15!important;}
  .header .header-button{font-size:${headerButtonSize}px!important;}
  .hero{min-height:${heroMinHeight}px!important;height:auto!important;padding-top:0!important;align-items:center!important;}
  .hero-overlay{padding-left:12px!important;padding-right:12px!important;}
  .hero-content{max-width:100%!important;padding:${contentPaddingY}px ${contentPaddingX}px!important;transform:none!important;text-align:${textAlign}!important;}
  .hero::before{background-position:${imagePosition} center!important;}
  .hero .eyebrow{font-size:${eyebrowSize}px!important;letter-spacing:${eyebrowSpacing}px!important;margin-bottom:${eyebrowMargin}px!important;line-height:1.35!important;}
  .hero h2{font-size:${titleSize}px!important;line-height:${titleLineHeight}!important;max-width:100%!important;overflow-wrap:normal!important;word-break:normal!important;}
  .hero-description{font-size:${descriptionSize}px!important;line-height:1.5!important;margin:${descriptionTop}px 0 ${descriptionBottom}px!important;max-width:100%!important;}
  .hero .gold-button{font-size:${buttonSize}px!important;padding:11px 14px!important;}
  .hero-content a[href*="guest-login"]{font-size:${loginSize}px!important;line-height:1.35!important;}
  .booking-container{padding-left:${bookingPaddingX}px!important;padding-right:${bookingPaddingX}px!important;}
  .booking-heading h2{font-size:${bookingTitleSize}px!important;line-height:1.12!important;}
  .form-card{padding:${cardPadding}px!important;}
  ${actionLayout}
}
`;

    document.documentElement.dataset.mobilePageDesignerReady = 'true';
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
      const response = await fetch(API_URL, { cache: 'no-store', headers: { Accept: 'application/json' } });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.message || `HTTP ${response.status}`);
      apply(payload.data);
    } catch (error) {
      console.warn('Mobile page designer settings unavailable; using built-in responsive CSS.', error);
    }
  }

  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== 'ca-smart-page-design-preview') return;
    apply(event.data.settings);
  });

  window.CASmartMobilePageDesigner = { apply };
  document.addEventListener('DOMContentLoaded', load);
})();
