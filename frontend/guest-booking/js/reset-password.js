document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const form = document.getElementById("resetForm");
  const button = document.getElementById("resetButton");
  const message = document.getElementById("message");
  const newPasswordInput = document.getElementById("newPassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");

  if (!form || !button || !message || !newPasswordInput || !confirmPasswordInput) return;

  const token = new URLSearchParams(window.location.search).get("token") || "";

  function showMessage(text, ok) {
    message.textContent = text;
    message.style.display = "block";
    message.style.color = ok ? "#0b5d4d" : "#b42318";
    message.style.background = ok ? "#e9f3ee" : "#fff0ef";
    message.style.border = ok ? "1px solid #b9d7ca" : "1px solid #efc5c1";
  }

  function setBusy(busy) {
    button.disabled = busy;
    button.innerHTML = busy ? "Resetting Password..." : "Reset Password <span>→</span>";
  }

  document.querySelectorAll(".show-password[data-target]").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const input = document.getElementById(toggle.dataset.target);
      if (!input) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      toggle.textContent = showing ? "Show" : "Hide";
    });
  });

  if (!token) {
    showMessage("This password reset link is missing its security token. Please request a new reset link.", false);
    button.disabled = true;
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (newPassword.length < 8) {
      showMessage("Your new password must be at least 8 characters.", false);
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage("New password and confirmation do not match.", false);
      return;
    }

    setBusy(true);
    message.style.display = "none";

    try {
      const response = await fetch("/api/guest-auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
        cache: "no-store"
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showMessage(data.message || "Unable to reset password. Please request a new reset link.", false);
        setBusy(false);
        return;
      }

      showMessage(data.message || "Password reset successfully. You can now log in.", true);
      form.reset();
      setTimeout(() => {
        window.location.replace("guest-login.html");
      }, 1200);
    } catch (error) {
      console.error("GUEST RESET PASSWORD ERROR:", error);
      showMessage("Unable to connect to the server. Please try again.", false);
      setBusy(false);
    }
  });
});
