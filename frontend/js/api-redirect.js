/* CA Smart Staycation API routing: use the verified Vercel API directly. */
(function () {
  'use strict';

  // Use the verified Vercel deployment directly. This avoids the
  // casmartstaycation.com -> www redirect path for API calls while the
  // backend CORS configuration allows the site's origins.
  const VERCEL_API = 'https://ca-smart-staycation.vercel.app/api';
  const LEGACY_API = 'https://ca-smart-staycation-muqd.onrender.com/api';
  const originalFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    let url = '';
    const isString = typeof input === 'string';

    if (isString) {
      url = input;
    } else if (input && typeof input.url === 'string') {
      url = input.url;
    }

    // Route all relative API requests directly to the verified Vercel API.
    if (url.startsWith('/api')) {
      const absolute = VERCEL_API + url.slice('/api'.length);
      input = isString ? absolute : new Request(absolute, input);
    } else if (url.startsWith(LEGACY_API)) {
      const absolute = VERCEL_API + url.slice(LEGACY_API.length);
      input = isString ? absolute : new Request(absolute, input);
    }

    return originalFetch(input, init);
  };

  window.CA_SMART_API = VERCEL_API;
})();
