document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("forgotPasswordForm");
  const btn = document.getElementById("resetButton");
  const msg = document.getElementById("message");
  if (!form || !btn || !msg) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = String(document.getElementById("email")?.value || "").trim().toLowerCase();
    btn.disabled = true;
    btn.innerHTML = "Sending...";
    msg.style.display = "none";
    try {
      const response = await fetch("/api/guest-auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await response.json().catch(() => ({}));
      msg.textContent = data.message || (response.ok ? "If an account exists, reset instructions will be sent." : "Unable to process password reset.");
      msg.style.color = response.ok ? "#0b5d4d" : "#b42318";
      msg.style.display = "block";
    } catch (err) {
      console.error("GUEST FORGOT PASSWORD ERROR:", err);
      msg.textContent = "Unable to connect to the server. Please try again.";
      msg.style.color = "#b42318";
      msg.style.display = "block";
    } finally {
      btn.disabled = false;
      btn.innerHTML = "Send Reset Link <span>→</span>";
    }
  });
});
