const API = "https://ca-smart-staycation-muqd.onrender.com/api";

const form = document.getElementById("guestLoginForm");
const button = document.getElementById("loginButton");

// Wake the Render API while the guest is entering their credentials.
// This reduces the apparent login delay when the service has been idle.
fetch(`${API}/guest-auth/ping`, { method: "GET", cache: "no-store" }).catch(() => {});

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
        alert("Please enter your email and password.");
        return;
    }

    button.disabled = true;
    button.innerText = "Logging in...";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(`${API}/guest-auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ email, password }),
            cache: "no-store",
            signal: controller.signal
        });

        clearTimeout(timeout);

        let result = {};
        try {
            result = await response.json();
        } catch (_) {
            throw new Error("The server returned an invalid response.");
        }

        if (!response.ok) {
            alert(result.message || "Invalid email or password.");
            button.disabled = false;
            button.innerText = "Login";
            return;
        }

        localStorage.setItem("guestAuthToken", result.token || "");
        localStorage.setItem("guestAccount", JSON.stringify(result.account || {}));

        if (result.account?.mustChangePassword) {
            window.location.replace("change-password.html");
        } else {
            window.location.replace("guest-dashboard.html");
        }
    } catch (err) {
        clearTimeout(timeout);
        console.error(err);
        if (err.name === "AbortError") {
            alert("The server is taking too long to respond. Please try again in a few seconds.");
        } else {
            alert("Unable to connect to the server. Please try again.");
        }
        button.disabled = false;
        button.innerText = "Login";
    }
});
