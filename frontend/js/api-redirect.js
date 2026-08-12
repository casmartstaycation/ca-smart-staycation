/* CA Smart Staycation API routing: always use the live Vercel API. */
(function () {
  'use strict';

  // The apex domain can currently serve an old GitHub Pages response for /api/*.
  // The www domain is the verified Vercel production domain, so API calls are
  // explicitly routed there instead of relying on the apex-domain redirect.
  const CANONICAL_API = 'https://www.casmartstaycation.com/api';
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

    // Route relative /api/* requests away from the apex domain, which can
    // still return the old GitHub Pages 404, to the verified Vercel domain.
    if (url.startsWith('/api')) {
      const absolute = CANONICAL_API + url.slice('/api'.length);
      input = isString ? absolute : new Request(absolute, input);
    } else if (url.startsWith(VERCEL_API)) {
      const relative = CANONICAL_API + url.slice(VERCEL_API.length);
      if (isString) input = relative;
      else input = new Request(relative, input);
    } else if (url.startsWith(LEGACY_API)) {
      const relative = CANONICAL_API + url.slice(LEGACY_API.length);
      if (isString) input = relative;
      else input = new Request(relative, input);
    }

    return originalFetch(input, init);
  };

  window.CA_SMART_API = CANONICAL_API;
})();
