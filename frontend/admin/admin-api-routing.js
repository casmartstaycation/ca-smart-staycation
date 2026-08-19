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

  function requestPath(input) {
    try {
      const raw = input instanceof Request ? input.url : String(input || '');
      return new URL(raw, window.location.origin).pathname.replace(/\/+$/, '') || '/';
    } catch (_) {
      return '';
    }
  }

  function isApiRequest(input) {
    const path = requestPath(input);
    return path === '/api' || path.startsWith('/api/');
  }

  function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  function githubOnlyResponse(path) {
    if (path === '/api/admin-auth/status') {
      return jsonResponse({
        success: true,
        configured: true,
        emailConfigured: true,
        passwordConfigured: true,
        jwtConfigured: true,
        adminEmail: 'markryantamayo@gmail.com',
        githubOnly: true,
        message: 'Admin database features are temporarily paused while the site is running on GitHub Pages.'
      });
    }

    if (path === '/api/bookings') {
      return jsonResponse({ success: true, data: [], bookings: [], githubOnly: true });
    }

    if (path === '/api/notifications') {
      return jsonResponse({ success: true, data: [], notifications: [], githubOnly: true });
    }

    if (path === '/api/admin/inbox' || path === '/api/admin/messages') {
      return jsonResponse({ success: true, data: [], messages: [], githubOnly: true });
    }

    return jsonResponse({
      success: false,
      githubOnly: true,
      message: 'This admin action is temporarily unavailable while the site is running on GitHub Pages.'
    });
  }

  function showGitHubOnlyNotice() {
    if (!GITHUB_ONLY_MODE || document.getElementById('caAdminGithubOnlyNotice')) return;

    const auth = document.getElementById('adminAuth');
    const shell = document.getElementById('adminShell');
    if (shell) shell.hidden = true;

    if (auth) {
      auth.hidden = false;
      const title = auth.querySelector('h1');
      const intro = auth.querySelector('p:not(.eyebrow)');
      const form = document.getElementById('adminLoginForm');
      if (title) title.textContent = 'Admin Dashboard Temporarily Paused';
      if (intro) intro.textContent = 'The live admin database is temporarily offline while CA Smart Staycation is running from GitHub Pages.';
      if (form) form.hidden = true;

      let panel = document.getElementById('caAdminStaticPanel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'caAdminStaticPanel';
        panel.style.cssText = 'margin-top:18px;padding:16px;border:1px solid #d5a62b;border-radius:10px;background:#fff8df;color:#5a4610;font:14px/1.55 Arial,sans-serif';
        panel.innerHTML = '<strong>Temporary GitHub-only mode</strong><br>No admin login or database request is being sent to Vercel. Existing booking records remain unchanged in the live database. Booking requests received during this temporary period must be handled manually.';
        auth.appendChild(panel);
      }
    }
  }

  function blockGitHubOnlyAdminSubmit(event) {
    if (!GITHUB_ONLY_MODE) return;
    const form = event.target;
    if (!form || form.id !== 'adminLoginForm') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showGitHubOnlyNotice();
  }

  if (GITHUB_ONLY_MODE) {
    document.addEventListener('submit', blockGitHubOnlyAdminSubmit, true);
  }

  window.fetch = function (input, init) {
    if (GITHUB_ONLY_MODE && isApiRequest(input)) {
      return Promise.resolve(githubOnlyResponse(requestPath(input)));
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
    console.info('[CA Smart Staycation] Admin GitHub-only static mode active. Remote admin API calls are disabled.');
  }
})();
