const API = "https://ca-smart-staycation-muqd.onrender.com/api";

document
.getElementById("guestLoginForm")
.addEventListener("submit", async (e) => {

    e.preventDefault();

    const bookingReference =
        document.getElementById("bookingReference").value.trim();

    const email =
        document.getElementById("email").value.trim().toLowerCase();

    try {

        const response = await fetch(`${API}/bookings`);

        const result = await response.json();

        const booking = result.data.find(item =>
            item.bookingReference === bookingReference &&
            item.email.toLowerCase() === email
        );

        if (!booking) {

            alert("Booking not found.");

            return;

        }

        localStorage.setItem(
            "guestBooking",
            JSON.stringify(booking)
        );

        window.location.href = "booking-success.html";

    } catch (err) {

        console.error(err);

        alert("Unable to connect to the server.");

    }

});