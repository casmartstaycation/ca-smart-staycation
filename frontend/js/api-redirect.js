/* CA Smart Staycation API routing: use Vercel backend instead of legacy Render backend. */
(function () {
  'use strict';
  const VERCEL_API = 'https://ca-smart-staycation.vercel.app/api';
  const LEGACY_API = 'https://ca-smart-staycation-muqd.onrender.com/api';
  const originalFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    let url = '';
    if (typeof input === 'string') url = input;
    else if (input && typeof input.url === 'string') url = input.url;

    if (url.startsWith(LEGACY_API)) {
      const redirected = VERCEL_API + url.slice(LEGACY_API.length);
      if (typeof input === 'string') input = redirected;
      else input = new Request(redirected, input);
    }
    return originalFetch(input, init);
  };

  window.CA_SMART_API = VERCEL_API;
})();
