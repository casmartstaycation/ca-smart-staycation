/* CA Smart Staycation admin API routing/auth bridge. */
(function () {
  'use strict';

  const TOKEN_KEY = 'caSmartAdminToken';
  const GITHUB_ONLY_MODE = window.location.hostname.endsWith('github.io');
  const originalFetch = window.fetch.bind(window);

  if (!document.querySelector('link[rel~="icon"]')) {
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/svg+xml';
    favicon.href = '../favicon.svg';
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
      return !!(payload && payload.role === 'admin' && payload.email && (!payload.exp || payload.exp * 1000 > Date.now()));
    } catch (_) {
      return false;
    }
  }

  function clear() {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }

  function isApiRequest(input) {
    try {
      const raw = input instanceof Request ? input.url : String(input || '');
      const url = new URL(raw, window.location.origin);
      return url.pathname === '/api' || url.pathname.startsWith('/api/');
    } catch (_) {
      return false;
    }
  }

  function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  function showGitHubOnlyNotice() {
    if (!GITHUB_ONLY_MODE || document.getElementById('caAdminGithubOnlyNotice')) return;
    const notice = document.createElement('div');
    notice.id = 'caAdminGithubOnlyNotice';
    notice.setAttribute('role', 'status');
    notice.style.cssText = 'position:fixed;left:12px;right:12px;top:12px;z-index:99999;padding:12px 14px;border:1px solid #d5a62b;border-radius:10px;background:#fff8df;color:#5a4610;font:14px/1.45 Arial,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.12)';
    notice.innerHTML = '<strong>Temporary GitHub-only mode.</strong> The Admin Dashboard database is paused. No request will be sent to Vercel. Existing live booking records are not modified.';
    document.body.appendChild(notice);
  }

  window.fetch = function (input, init) {
    if (GITHUB_ONLY_MODE && isApiRequest(input)) {
      console.warn('[CA Smart Staycation] GitHub-only mode blocked an Admin API request; no Vercel request was sent.');
      return Promise.resolve(jsonResponse({
        success: false,
        githubOnly: true,
        message: 'Admin database features are temporarily paused while the site is running on GitHub Pages.'
      }, 503));
    }

    return originalFetch(input, init);
  };

  window.CASmartAdminAuth = {
    token: getToken,
    hasValidToken: () => !GITHUB_ONLY_MODE && validateToken(getToken()),
    clear,
    apiOrigin: GITHUB_ONLY_MODE ? null : window.location.origin,
    githubOnly: GITHUB_ONLY_MODE
  };

  if (GITHUB_ONLY_MODE) {
    clear();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showGitHubOnlyNotice, { once: true });
    } else {
      showGitHubOnlyNotice();
    }
    console.info('[CA Smart Staycation] Admin is in GitHub-only static mode. Vercel routing is disabled.');
  }
})();
