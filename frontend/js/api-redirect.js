/* CA Smart Staycation API routing.
 * Use same-origin /api when the site is served from the Vercel custom domain.
 * Keep the Vercel deployment URL as a fallback for GitHub Pages/local previews.
 */
(function () {
  'use strict';

  const VERCEL_API = 'https://ca-smart-staycation.vercel.app/api';
  const LEGACY_API = 'https://ca-smart-staycation-muqd.onrender.com/api';
  const SAME_ORIGIN_API = '/api';
  const hostname = window.location.hostname;
  const useSameOrigin = hostname === 'casmartstaycation.com' || hostname === 'www.casmartstaycation.com';
  const API_BASE = useSameOrigin ? SAME_ORIGIN_API : VERCEL_API;
  const originalFetch = window.fetch.bind(window);

  function redirectUrl(url) {
    if (!url) return url;

    if (url.startsWith(LEGACY_API)) {
      return API_BASE + url.slice(LEGACY_API.length);
    }

    if (url.startsWith(VERCEL_API)) {
      return API_BASE + url.slice(VERCEL_API.length);
    }

    return url;
  }

  window.fetch = function (input, init) {
    if (typeof input === 'string') {
      input = redirectUrl(input);
    } else if (input && typeof input.url === 'string') {
      const redirected = redirectUrl(input.url);
      if (redirected !== input.url) {
        input = new Request(redirected, input);
      }
    }

    return originalFetch(input, init);
  };

  window.CA_SMART_API = API_BASE;
})();
