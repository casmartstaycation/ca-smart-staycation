document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const form = document.getElementById('forgotPasswordForm');
  const btn = document.getElementById('resetButton');
  const msg = document.getElementById('message');
  const email = document.getElementById('email');
  if (!form || !btn || !msg) return;

  function showPaused() {
    if (email) email.disabled = true;
    btn.disabled = true;
    btn.textContent = 'Password Reset Temporarily Paused';
    msg.innerHTML = 'Password reset requires the secure guest database, which is temporarily offline in GitHub-only mode. No API request will be sent. For account assistance, email <a href="mailto:booking@casmartstaycation.com">booking@casmartstaycation.com</a>.';
    msg.style.color = '#5a4610';
    msg.style.background = '#fff8df';
    msg.style.border = '1px solid #d5a62b';
    msg.style.display = 'block';
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    showPaused();
  }, true);

  showPaused();
  console.info('[CA Smart Staycation] Forgot Password is paused in GitHub-only mode. No API request will be sent.');
});
