const uploadButton = document.getElementById("uploadPayment");
const fileInput = document.getElementById("paymentProof");

function resetUploadButton() {
    if (!uploadButton) return;
    uploadButton.disabled = false;
    uploadButton.innerHTML = "Submit Payment <span>→</span>";
}

if (fileInput) {
    fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        const existing = document.getElementById("paymentProofSelected");
        if (existing) existing.textContent = file ? `Selected: ${file.name}` : "";
    });
}

if (uploadButton) {
    uploadButton.addEventListener("click", async (e) => {
        e.preventDefault();
        uploadButton.disabled = true;
        uploadButton.innerText = "Uploading...";

        const booking = JSON.parse(localStorage.getItem("guestBooking"));
        if (!booking) {
            alert("Booking information not found. Please start a new booking.");
            resetUploadButton();
            return;
        }

        const isRejected = booking.bookingStatus === "Payment Rejected";
        if (!isRejected && booking.paymentDeadline && Date.now() >= new Date(booking.paymentDeadline).getTime()) {
            alert("This booking has expired because payment was not settled within 1 hour. Please create a new booking.");
            resetUploadButton();
            return;
        }

        const bookingId = booking._id || booking.id;
        const file = fileInput?.files?.[0];
        if (!bookingId) {
            alert("Booking ID is missing. Please start a new booking.");
            resetUploadButton();
            return;
        }
        if (!file) {
            alert("Please select your payment proof.");
            resetUploadButton();
            return;
        }

        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
        if (!allowedTypes.includes(file.type)) {
            alert("Payment proof must be JPG, PNG, WEBP, or PDF.");
            resetUploadButton();
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert("Payment proof is too large. Please upload a file smaller than 10 MB.");
            resetUploadButton();
            return;
        }

        const confirmUpload = window.confirm(
            `Please confirm this is the correct payment proof for booking ${booking.bookingReference}.\n\nFile: ${file.name}\n\nIf this is the wrong receipt, you can submit a replacement after admin rejects it.`
        );
        if (!confirmUpload) {
            resetUploadButton();
            return;
        }

        // Preserve the existing guest session before navigating away.
        // The guest dashboard uses this token to authenticate /guest-auth/me.
        const guestToken = localStorage.getItem("guestAuthToken");
        const guestAccount = localStorage.getItem("guestAccount");
        const returnToAccount = "guest-dashboard.html";

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
            try { result = await response.json(); } catch (_) { result = {}; }

            if (!response.ok) {
                alert(result.message || "Payment upload failed. Please try again.");
                resetUploadButton();
                return;
            }

            const updatedBooking = {
                ...booking,
                ...(result.data || {}),
                bookingStatus: "Pending Payment Verification",
                paymentStatus: "Pending"
            };
            localStorage.setItem("guestBooking", JSON.stringify(updatedBooking));

            // Never remove or replace the authenticated guest session here.
            // This is intentionally a direct return to Guest Account Management.
            if (guestToken) localStorage.setItem("guestAuthToken", guestToken);
            if (guestAccount) localStorage.setItem("guestAccount", guestAccount);

            alert("Payment proof uploaded successfully. Your booking is now waiting for admin payment verification.");
            window.location.replace(returnToAccount);
        } catch (err) {
            clearTimeout(timeoutId);
            console.error("Payment upload error:", err);
            if (err.name === "AbortError") {
                alert("The upload is taking too long. Please check your internet connection and try again.");
            } else {
                alert("Upload failed. Please try again.");
            }
            resetUploadButton();
        }
    });
}
