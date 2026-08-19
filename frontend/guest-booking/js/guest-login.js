const API = "/api";
const form = document.getElementById("guestLoginForm");
const button = document.getElementById("loginButton");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value.trim();

    button.disabled = true;
    button.innerText = "Logging in...";

    try {
        const response = await fetch(`${API}/guest-auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
            cache: "no-store"
        });

        const result = await response.json();

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
        console.error(err);
        alert("Unable to connect to the server.");
        button.disabled = false;
        button.innerText = "Login";
    }
});