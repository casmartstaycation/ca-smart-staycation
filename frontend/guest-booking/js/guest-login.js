const isGitHubOnlyMode = window.location.hostname.endsWith("github.io");
const API = "/api";

const form = document.getElementById("guestLoginForm");
const button = document.getElementById("loginButton");

function showGitHubOnlyNotice() {
    if (!form) return;

    button.disabled = true;
    button.innerText = "Guest Login Temporarily Paused";

    let notice = document.getElementById("githubOnlyGuestNotice");
    if (!notice) {
        notice = document.createElement("div");
        notice.id = "githubOnlyGuestNotice";
        notice.className = "login-help";
        notice.style.marginTop = "14px";
        notice.innerHTML = '<strong>Temporary GitHub-only mode.</strong><br>The live guest account database is currently offline. No request will be sent to Vercel. For booking assistance, email <a href="mailto:booking@casmartstaycation.com">booking@casmartstaycation.com</a>.';
        button.insertAdjacentElement("afterend", notice);
    }
}

if (isGitHubOnlyMode) {
    showGitHubOnlyNotice();
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (isGitHubOnlyMode) {
        showGitHubOnlyNotice();
        return;
    }

    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value.trim();

    button.disabled = true;
    button.innerText = "Logging in...";

    try {
        const body = new URLSearchParams({ email, password });
        const response = await fetch(`${API}/guest-auth/login`, {
            method: "POST",
            body,
            cache: "no-store"
        });

        const raw = await response.text();
        let result = {};
        try {
            result = raw ? JSON.parse(raw) : {};
        } catch (_) {
            console.error("Guest login returned a non-JSON response:", raw.slice(0, 300));
            throw new Error(`Login server returned an invalid response (HTTP ${response.status}).`);
        }

        if (!response.ok) {
            alert(result.message || "Invalid email or password.");
            button.disabled = false;
            button.innerText = "Login";
            return;
        }

        localStorage.setItem("guestAuthToken", result.token || "");
        localStorage.setItem("guestAccount", JSON.stringify(result.account || {}));
        if (Array.isArray(result.bookings)) {
            localStorage.setItem("guestBookingsCache", JSON.stringify({ savedAt: Date.now(), bookings: result.bookings }));
        }

        const booking = result.bookings?.[0];
        if (booking) localStorage.setItem("guestBooking", JSON.stringify(booking));

        if (result.account?.mustChangePassword) {
            window.location.href = "change-password.html";
        } else {
            const params = new URLSearchParams(window.location.search);
            const next = params.get("next");
            const safeNext = next === "guest-dashboard.html" ? next : "guest-dashboard.html";
            window.location.replace(safeNext);
        }
    } catch (err) {
        console.error("Guest login error:", err);
        alert(err?.message || "Unable to connect to the server.");
        button.disabled = false;
        button.innerText = "Login";
    }
});
