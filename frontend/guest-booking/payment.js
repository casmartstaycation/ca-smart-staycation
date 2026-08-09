const uploadButton = document.getElementById("uploadPayment");

if (uploadButton) {
    uploadButton.addEventListener("click", async (e) => {
        e.preventDefault();
        uploadButton.disabled = true;
        uploadButton.innerText = "Uploading...";

        const booking = JSON.parse(localStorage.getItem("guestBooking"));
        if (!booking) {
            alert("Booking information not found. Please start a new booking.");
            uploadButton.disabled = false;
            uploadButton.innerHTML = "Submit Payment <span>→</span>";
            return;
        }

        if (booking.paymentDeadline && Date.now() >= new Date(booking.paymentDeadline).getTime()) {
            alert("This booking has expired because payment was not settled within 1 hour. Please create a new booking.");
            uploadButton.disabled = false;
            uploadButton.innerHTML = "Submit Payment <span>→</span>";
            return;
        }

        const bookingId = booking._id || booking.id;
        const fileInput = document.getElementById("paymentProof");
        const file = fileInput?.files?.[0];

        if (!bookingId) {
            alert("Booking ID is missing. Please start a new booking.");
            uploadButton.disabled = false;
            uploadButton.innerHTML = "Submit Payment <span>→</span>";
            return;
        }

        if (!file) {
            alert("Please select your payment proof.");
            uploadButton.disabled = false;
            uploadButton.innerHTML = "Submit Payment <span>→</span>";
            return;
        }

        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
        if (!allowedTypes.includes(file.type)) {
            alert("Payment proof must be JPG, PNG, WEBP, or PDF.");
            uploadButton.disabled = false;
            uploadButton.innerHTML = "Submit Payment <span>→</span>";
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            alert("Payment proof is too large. Please upload a file smaller than 10 MB.");
            uploadButton.disabled = false;
            uploadButton.innerHTML = "Submit Payment <span>→</span>";
            return;
        }

        const formData = new FormData();
        formData.append("paymentProof", file);

        const url = `https://ca-smart-staycation-muqd.onrender.com/api/bookings/${encodeURIComponent(bookingId)}/payment`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90 * 1000);

        try {
            const response = await fetch(url, {
                method: "POST",
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            let result = {};
            try {
                result = await response.json();
            } catch (_) {
                result = {};
            }

            if (!response.ok) {
                alert(result.message || "Payment upload failed. Please try again.");
                uploadButton.disabled = false;
                uploadButton.innerHTML = "Submit Payment <span>→</span>";
                return;
            }

            localStorage.setItem("guestBooking", JSON.stringify({
                ...booking,
                ...(result.data || {}),
                bookingStatus: "Pending Payment Verification",
                paymentStatus: "Pending"
            }));

            alert("Payment proof uploaded successfully. Your booking is now waiting for admin payment verification.");
            window.location.href = "booking-submitted.html";
        } catch (err) {
            clearTimeout(timeoutId);
            console.error("Payment upload error:", err);
            if (err.name === "AbortError") {
                alert("The upload is taking too long. Please check your internet connection and try again.");
            } else {
                alert("Upload failed. Please try again.");
            }
            uploadButton.disabled = false;
            uploadButton.innerHTML = "Submit Payment <span>→</span>";
        }
    });
}
