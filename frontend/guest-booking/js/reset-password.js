const API = window.CA_SMART_API || '/api';
const token = new URLSearchParams(location.search).get("token");

document.getElementById("resetForm").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = document.getElementById("message"), btn = document.getElementById("resetButton");
  if (!token) { msg.textContent = "This reset link is invalid or missing."; msg.style.color = "#b42318"; return; }
  btn.disabled = true; btn.textContent = "Resetting...";
  try {
    const r = await fetch(`${API}/guest-auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: document.getElementById("newPassword").value, confirmPassword: document.getElementById("confirmPassword").value })
    });
    const d = await r.json();
    msg.textContent = d.message || "Password reset complete.";
    msg.style.color = r.ok ? "#0b5d4d" : "#b42318";
    if (r.ok) { document.getElementById("resetForm").reset(); setTimeout(() => location.href = "guest-login.html", 1500); }
  } catch (err) {
    msg.textContent = "Unable to connect to the server. Please try again.";
    msg.style.color = "#b42318";
  } finally {
    btn.disabled = false; btn.textContent = "Reset Password";
  }
});
