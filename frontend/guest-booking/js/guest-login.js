// Use same-origin API when hosted on casmartstaycation.com; fall back to Vercel or public API for other hosts.
const API = window.CA_SMART_API || (/(^|\.)casmartstaycation\.com$/i.test(window.location.hostname) ? '/api' : (/(^|\.)vercel\.app$/i.test(window.location.hostname) ? `${window.location.origin}/api` : 'https://ca-smart-staycation.vercel.app/api'));

const form = document.getElementById("guestLoginForm");
const button = document.getElementById("loginButton");

const warmApi = () => fetch(`${API}/health`, {
    method: "GET",
    cache: "no-store",
    headers: { "Accept": "application/json" }
}).catch(() => null);

let apiWarmup = warmApi();

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
        alert("Please enter your email and password.");
        return;
    }

    button.disabled = true;
    button.innerText = "Connecting...";

    try {
        // Allow the serverless function to finish a cold start, but don't block forever.
        await Promise.race([
            apiWarmup,
            new Promise(resolve => setTimeout(resolve, 12000))
        ]);
    } catch (_) {}

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
        button.innerText = "Logging in...";

        const response = await fetch(`${API}/guest-auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ email, password }),
            cache: "no-store",
            signal: controller.signal
        });

        clearTimeout(timeout);

        let result = {};
        try {
            result = await response.json();
        } catch (_) {
            throw new Error(`The server returned an invalid response (${response.status}).`);
        }

        if (!response.ok) {
            alert(result.message || "Invalid email or password.");
            button.disabled = false;
            button.innerText = "Login";
            apiWarmup = warmApi();
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
        console.error("Guest login request failed:", err);

        if (err.name === "AbortError") {
            alert("The server is taking too long to respond. Please try again in a few seconds.");
        } else {
            alert("Unable to connect to the server. Please try again.");
        }

        button.disabled = false;
        button.innerText = "Login";
        apiWarmup = warmApi();
    }
});
