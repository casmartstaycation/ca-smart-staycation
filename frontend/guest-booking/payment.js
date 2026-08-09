const uploadButton = document.getElementById("uploadPayment");

uploadButton.addEventListener("click", async (e) => {
    e.preventDefault();
    uploadButton.disabled = true;
    uploadButton.innerText = "Uploading...";

    const booking = JSON.parse(localStorage.getItem("guestBooking"));
    if (!booking) {
        alert("Booking information not found.");
        uploadButton.disabled = false;
        uploadButton.innerHTML = "Submit Payment <span>→</span>";
        return;
    }

    const bookingId = booking._id || booking.id;
    const file = document.getElementById("paymentProof").files[0];

    if (!file) {
        alert("No file selected.");
        uploadButton.disabled = false;
        uploadButton.innerHTML = "Submit Payment <span>→</span>";
        return;
    }

    const formData = new FormData();
    formData.append("paymentProof", file);

    const url = `https://ca-smart-staycation-muqd.onrender.com/api/bookings/${bookingId}/payment`;

    try {
        const response = await fetch(url, { method: "POST", body: formData });
        const result = await response.json();

        if (!response.ok) {
            alert(result.message || "Payment upload failed.");
            uploadButton.disabled = false;
            uploadButton.innerHTML = "Submit Payment <span>→</span>";
            return;
        }

        // Keep the booking locally so the guest can still see the reference/status
        // until the confirmation page or account page is updated.
        localStorage.setItem("guestBooking", JSON.stringify({
            ...booking,
            ...(result.data || {}),
            bookingStatus: "Pending Payment Verification",
            paymentStatus: "Pending"
        }));

        alert("Payment proof uploaded successfully. Your booking is now waiting for admin payment verification.");
        window.location.href = "booking-submitted.html";
    } catch (err) {
        console.error(err);
        alert("Upload failed. Please try again.");
        uploadButton.disabled = false;
        uploadButton.innerHTML = "Submit Payment <span>→</span>";
    }
});
