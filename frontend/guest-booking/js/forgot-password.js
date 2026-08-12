const API = window.CA_SMART_API || '/api';

const form = document.getElementById('forgotPasswordForm');
const btn = document.getElementById('resetButton');
const msg = document.getElementById('message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim().toLowerCase();
  if (!email) return;

  btn.disabled = true;
  btn.innerHTML = 'Sending...';
  msg.style.display = 'none';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${API}/guest-auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email }),
      cache: 'no-store',
      signal: controller.signal
    });

    clearTimeout(timeout);

    let result = {};
    try {
      result = await response.json();
    } catch (_) {
      throw new Error(`The server returned an invalid response (${response.status}).`);
    }

    msg.textContent = result.message ||
      'If an account exists for that email, a password reset link has been sent.';
    msg.style.color = response.ok ? '#0b5d4d' : '#b42318';
    msg.style.display = 'block';
  } catch (err) {
    clearTimeout(timeout);
    console.error('Forgot password request failed:', err);

    if (err.name === 'AbortError') {
      msg.textContent = 'The server is taking too long to respond. Please try again in a few seconds.';
    } else {
      msg.textContent = 'Unable to connect to the server. Please try again.';
    }

    msg.style.color = '#b42318';
    msg.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Send Reset Link <span>→</span>';
  }
});
