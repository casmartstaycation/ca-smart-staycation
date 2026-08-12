/* CA Smart Staycation API routing: same-origin API on Vercel. */
(function () {
  'use strict';
  const SAME_ORIGIN_API = '/api';
  const VERCEL_API = 'https://ca-smart-staycation.vercel.app/api';
  const LEGACY_API = 'https://ca-smart-staycation-muqd.onrender.com/api';
  const originalFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    let url = '';
    let isString = typeof input === 'string';
    if (isString) url = input;
    else if (input && typeof input.url === 'string') url = input.url;

    if (url.startsWith(VERCEL_API)) {
      const relative = SAME_ORIGIN_API + url.slice(VERCEL_API.length);
      if (isString) input = relative;
      else input = new Request(relative, input);
    } else if (url.startsWith(LEGACY_API)) {
      const relative = SAME_ORIGIN_API + url.slice(LEGACY_API.length);
      if (isString) input = relative;
      else input = new Request(relative, input);
    }

    return originalFetch(input, init);
  };

  window.CA_SMART_API = SAME_ORIGIN_API;
})();
