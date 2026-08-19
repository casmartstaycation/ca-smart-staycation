/* CA Smart Staycation admin API routing/auth bridge. */
(function () {
  const TOKEN_KEY = 'caSmartAdminToken';
  const API_ORIGIN = 'https://ca-smart-staycation.vercel.app';
  const GITHUB_PAGES_ORIGIN = 'https://casmartstaycation.github.io';
  const LEGACY_ORIGIN = 'https://ca-smart-staycation-muqd.onrender.com';
  const originalFetch = window.fetch.bind(window);

  // Admin pages historically had no favicon declaration, causing browsers to
  // probe /favicon.ico. Use the existing SVG asset instead.
  if (!document.querySelector('link[rel~="icon"]')) {
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/svg+xml';
    favicon.href = '/favicon.svg';
    document.head.appendChild(favicon);
  }

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '';
  }

  function validateToken(token) {
    if (!token) return false;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return !!(
        payload &&
        payload.role === 'admin' &&
        payload.email &&
        (!payload.exp || payload.exp * 1000 > Date.now())
      );
    } catch (_) {
      return false;
    }
  }

  function clear() {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }

  function clearInvalidToken(token) {
    if (token && !validateToken(token)) {
      clear();
      return '';
    }
    return token;
  }

  function rawUrl(input) {
    return input instanceof Request ? input.url : String(input || '');
  }

  function resolveApiUrl(input) {
    const raw = rawUrl(input);
    if (!raw) return null;

    try {
      const url = new URL(raw, window.location.origin);
      if (!(url.pathname === '/api' || url.pathname.startsWith('/api/'))) return null;

      // GitHub Pages is static and cannot serve /api/*. Send those calls to Vercel.
      if (url.origin === GITHUB_PAGES_ORIGIN || url.origin === LEGACY_ORIGIN) {
        return new URL(url.pathname + url.search, API_ORIGIN).href;
      }

      // Allow calls already aimed at the Vercel API, and same-origin calls on
      // casmartstaycation.com / Vercel-hosted pages.
      if (url.origin === API_ORIGIN || url.origin === window.location.origin) {
        return url.href;
      }
    } catch (_) {
      return null;
    }

    return null;
  }

  function withAuth(input, init, targetUrl) {
    let request;
    try {
      request = input instanceof Request
        ? new Request(targetUrl || input.url, input)
        : new Request(targetUrl || String(input), init || {});
    } catch (_) {
      return null;
    }

    const token = clearInvalidToken(getToken());
    if (!token) return request;

    const headers = new Headers(request.headers);
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return new Request(request, { headers });
  }

  window.fetch = function (input, init) {
    const targetUrl = resolveApiUrl(input);
    if (!targetUrl) return originalFetch(input, init);

    const request = withAuth(input, init, targetUrl);
    const promise = request ? originalFetch(request) : originalFetch(targetUrl, init);

    return promise.then(response => {
      if (response.status === 401) {
        clear();
        if (!location.pathname.endsWith('/admin/index.html') && !location.pathname.endsWith('/admin/')) {
          location.replace('/admin/index.html?session=expired');
        }
      }
      return response;
    });
  };

  window.CASmartAdminAuth = {
    token: getToken,
    hasValidToken: () => validateToken(getToken()),
    clear,
    apiOrigin: window.location.origin === GITHUB_PAGES_ORIGIN ? API_ORIGIN : window.location.origin
  };
})();
