const API = window.CA_SMART_API || '/api';

document.getElementById("forgotPasswordForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = document.getElementById("resetButton"), msg = document.getElementById("message");
  btn.disabled = true; btn.innerHTML = "Sending..."; msg.style.display = "none";
  try {
    const r = await fetch(`${API}/guest-auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: document.getElementById("email").value.trim().toLowerCase() })
    });
    const d = await r.json();
    msg.textContent = d.message || "If an account exists, reset instructions will be sent.";
    msg.style.color = r.ok ? "#0b5d4d" : "#b42318"; msg.style.display = "block";
  } catch (err) {
    msg.textContent = "Unable to connect to the server. Please try again."; msg.style.color = "#b42318"; msg.style.display = "block";
  } finally {
    btn.disabled = false; btn.innerHTML = "Send Reset Link <span>→</span>";
  }
});
