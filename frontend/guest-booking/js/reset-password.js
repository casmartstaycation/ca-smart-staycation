document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const form = document.getElementById('resetForm');
  const button = document.getElementById('resetButton');
  const message = document.getElementById('message');
  const newPassword = document.getElementById('newPassword');
  const confirmPassword = document.getElementById('confirmPassword');
  if (!form || !button || !message) return;

  function showPaused() {
    if (newPassword) newPassword.disabled = true;
    if (confirmPassword) confirmPassword.disabled = true;
    document.querySelectorAll('.show-password').forEach((toggle) => { toggle.disabled = true; });
    button.disabled = true;
    button.textContent = 'Password Reset Temporarily Paused';
    message.innerHTML = 'Password reset requires the secure guest database, which is temporarily offline in GitHub-only mode. No API request will be sent. For account assistance, email <a href="mailto:booking@casmartstaycation.com">booking@casmartstaycation.com</a>.';
    message.style.display = 'block';
    message.style.color = '#5a4610';
    message.style.background = '#fff8df';
    message.style.border = '1px solid #d5a62b';
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    showPaused();
  }, true);

  showPaused();
  console.info('[CA Smart Staycation] Reset Password is paused in GitHub-only mode. No API request will be sent.');
});
