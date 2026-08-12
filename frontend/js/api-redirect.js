/* CA Smart Staycation API routing: keep API requests same-origin. */
(function () {
  'use strict';

  // Keep browser API calls on the page's own origin. This avoids CORS entirely
  // and lets Vercel route /api/* to the deployed backend function.
  const LEGACY_API = 'https://ca-smart-staycation-muqd.onrender.com/api';
  const VERCEL_API = 'https://ca-smart-staycation.vercel.app/api';
  const originalFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    let url = '';
    const isString = typeof input === 'string';

    if (isString) {
      url = input;
    } else if (input && typeof input.url === 'string') {
      url = input.url;
    }

    // Do not rewrite relative /api/* URLs. They must stay same-origin.
    // This is the important fix for casmartstaycation.com.
    if (url.startsWith(LEGACY_API)) {
      const path = url.slice(LEGACY_API.length) || '';
      input = isString ? `/api${path}` : new Request(`/api${path}`, input);
    } else if (url.startsWith(VERCEL_API)) {
      const path = url.slice(VERCEL_API.length) || '';
      input = isString ? `/api${path}` : new Request(`/api${path}`, input);
    }

    return originalFetch(input, init);
  };

  // Keep this relative as well so modules can use the same-origin API base.
  window.CA_SMART_API = '/api';
})();
