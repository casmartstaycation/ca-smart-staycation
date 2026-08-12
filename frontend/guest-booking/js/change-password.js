const API = window.CA_SMART_API || '/api';
const token = localStorage.getItem("guestAuthToken");
if (!token) location.href = "guest-login.html";

document.getElementById("changePasswordForm").addEventListener("submit", async e => {
  e.preventDefault();
  const button = document.getElementById("changeButton");
  const message = document.getElementById("message");
  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  message.className = ""; message.textContent = "";
  if (newPassword.length < 8) { message.className = "error"; message.textContent = "New password must be at least 8 characters."; return; }
  if (newPassword !== confirmPassword) { message.className = "error"; message.textContent = "New passwords do not match."; return; }
  button.disabled = true; button.textContent = "Changing Password...";
  try {
    const response = await fetch(`${API}/guest-auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });
    const result = await response.json();
    if (!response.ok) { message.className = "error"; message.textContent = result.message || "Unable to change password."; button.disabled = false; button.textContent = "Change Password"; return; }
    localStorage.setItem("guestAccount", JSON.stringify(result.account || {}));
    message.className = "success"; message.textContent = "Password changed successfully. Redirecting...";
    setTimeout(() => location.href = "guest-dashboard.html", 700);
  } catch (err) {
    console.error(err); message.className = "error"; message.textContent = "Unable to connect to the server."; button.disabled = false; button.textContent = "Change Password";
  }
});
