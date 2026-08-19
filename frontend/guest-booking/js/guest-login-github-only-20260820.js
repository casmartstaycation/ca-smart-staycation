(() => {
  'use strict';

  const form = document.getElementById('guestLoginForm');
  const button = document.getElementById('loginButton');

  function showNotice() {
    if (!form) return;

    if (button) {
      button.disabled = true;
      button.textContent = 'Guest Login Temporarily Paused';
      button.title = 'Guest accounts require the live database, which is temporarily offline.';
    }

    const inputs = form.querySelectorAll('input');
    inputs.forEach((input) => {
      input.disabled = true;
    });

    let notice = document.getElementById('githubOnlyGuestNotice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'githubOnlyGuestNotice';
      notice.className = 'login-help';
      notice.style.marginTop = '14px';
      notice.innerHTML = '<strong>Temporary GitHub-only mode.</strong><br>Guest Login is paused because account access requires the live database. This page will not contact Vercel. For booking assistance, email <a href="mailto:booking@casmartstaycation.com">booking@casmartstaycation.com</a>.';
      form.appendChild(notice);
    }
  }

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      showNotice();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showNotice, { once: true });
  } else {
    showNotice();
  }

  console.info('[CA Smart Staycation] Guest Login is in GitHub-only static mode. No backend request will be sent.');
})();
