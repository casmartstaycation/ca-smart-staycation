/* CA Smart Staycation - temporary GitHub-only guest portal mode
 * No login request is sent to Vercel or any API while the backend is paused.
 */
(function () {
  'use strict';

  const SUPPORT_EMAIL = 'booking@casmartstaycation.com';
  const form = document.getElementById('guestLoginForm');
  const button = document.getElementById('loginButton');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  function showTemporaryNotice() {
    if (!form) return;

    if (emailInput) emailInput.disabled = true;
    if (passwordInput) passwordInput.disabled = true;

    if (button) {
      button.disabled = true;
      button.textContent = 'Guest Login Temporarily Paused';
    }

    let notice = document.getElementById('githubOnlyGuestNotice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'githubOnlyGuestNotice';
      notice.className = 'login-help';
      notice.setAttribute('role', 'status');
      notice.style.marginTop = '14px';
      notice.innerHTML =
        '<strong>Guest Portal temporarily unavailable.</strong><br>' +
        'CA Smart Staycation is currently operating in GitHub-only mode, so secure guest account login is paused. ' +
        'No login request is being sent to Vercel or any external API. ' +
        'For your booking status or reservation details, email ' +
        '<a href="mailto:' + SUPPORT_EMAIL + '">' + SUPPORT_EMAIL + '</a>.';
      if (button) button.insertAdjacentElement('afterend', notice);
      else form.appendChild(notice);
    }
  }

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showTemporaryNotice();
      return false;
    }, true);
  }

  // Remove stale cached guest credentials so a bookmarked dashboard cannot
  // accidentally attempt backend calls while GitHub-only mode is active.
  localStorage.removeItem('guestAuthToken');
  localStorage.removeItem('guestAccount');
  sessionStorage.removeItem('guestAuthToken');
  sessionStorage.removeItem('guestAccount');

  showTemporaryNotice();
  console.info('[CA Smart Staycation] Guest Login is in GitHub-only mode. No API login request will be sent.');
})();
