const GUEST_BOOKING_DOC_API = "https://ca-smart-staycation-muqd.onrender.com/api";

async function submitGuestBookingWithDocuments(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const form = event.currentTarget;
    const bookingType = document.getElementById("bookingType")?.value || "unit";
    const room = document.getElementById("room")?.value || "";
    const checkIn = document.getElementById("checkIn")?.value || "";
    const checkOut = document.getElementById("checkOut")?.value || "";
    const adults = Math.max(0, Number(document.getElementById("guests")?.value || 0));
    const children = Math.max(0, Number(document.getElementById("children")?.value || 0));
    const firstName = document.getElementById("firstName")?.value.trim() || "";
    const lastName = document.getElementById("lastName")?.value.trim() || "";
    const email = document.getElementById("email")?.value.trim() || "";
    const mobile = document.getElementById("mobile")?.value.trim() || "";
    const address = document.getElementById("address")?.value.trim() || "";
    const governmentId = document.getElementById("governmentId")?.files?.[0];
    const driversLicense = document.getElementById("driversLicense")?.files?.[0];
    const vehicleBrand = document.getElementById("vehicleBrand")?.value.trim() || "";
    const vehicleModel = document.getElementById("vehicleModel")?.value.trim() || "";
    const vehicleColor = document.getElementById("vehicleColor")?.value.trim() || "";
    const plateNumber = document.getElementById("plateNumber")?.value.trim() || "";

    if (!checkIn || !checkOut || !firstName || !lastName || !email || !mobile || !address) {
        alert("Please complete all required fields.");
        return;
    }
    if (bookingType !== "parking" && !room) {
        alert("Please select an accommodation.");
        return;
    }
    if (!governmentId) {
        alert("Please upload a clear government-issued ID.");
        return;
    }
    if ((bookingType === "parking" || bookingType === "both") && !driversLicense) {
        alert("Please upload the driver's license required for parking.");
        return;
    }
    if ((bookingType === "parking" || bookingType === "both") && (!vehicleBrand || !vehicleModel || !vehicleColor || !plateNumber)) {
        alert("Please complete all vehicle information.");
        return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    for (const file of [governmentId, driversLicense].filter(Boolean)) {
        if (!allowed.includes(file.type)) {
            alert("Documents must be JPG, PNG, WEBP, or PDF.");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert("Each uploaded document must be smaller than 10 MB.");
            return;
        }
    }

    const submitButton = form.querySelector("button[type=submit]");
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Submitting…";
    }

    try {
        const parkingResponse = await fetch(`${GUEST_BOOKING_DOC_API}/parking`, { cache: "no-store" });
        const parkingJson = await parkingResponse.json();
        const parkingSlots = Array.isArray(parkingJson.data) ? parkingJson.data : [];
        const preferred = parkingSlots.find(slot =>
            String(slot.parkingNumber || "").trim().toUpperCase() === "SLOT 9" ||
            String(slot.parkingName || "").trim().toUpperCase() === "BAY 4"
        ) || parkingSlots[0] || null;
        const parking = (bookingType === "parking" || bookingType === "both") ? preferred?._id || null : null;
        if ((bookingType === "parking" || bookingType === "both") && !parking) {
            throw new Error("Parking is currently unavailable. Please try again shortly.");
        }

        const totalAmount = Number((document.getElementById("totalAmount")?.innerText || "0").replace("₱", "").replace(/,/g, "")) || 0;
        const bookingData = {
            firstName, lastName, email, mobile, address,
            room: bookingType === "parking" ? null : room,
            parking,
            parkingOnly: bookingType === "parking",
            checkIn, checkOut,
            adults,
            children,
            totalAmount,
            vehicleBrand,
            vehicleModel,
            vehicleColor,
            plateNumber
        };

        const bookingResponse = await fetch(`${GUEST_BOOKING_DOC_API}/bookings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bookingData)
        });
        const bookingJson = await bookingResponse.json();
        if (!bookingResponse.ok) throw new Error(bookingJson.message || "Booking failed.");

        const booking = bookingJson.data;
        const documents = new FormData();
        documents.append("governmentId", governmentId);
        if (driversLicense) documents.append("driversLicense", driversLicense);
        documents.append("vehicleBrand", vehicleBrand);
        documents.append("vehicleModel", vehicleModel);
        documents.append("vehicleColor", vehicleColor);
        documents.append("plateNumber", plateNumber);

        const documentResponse = await fetch(`${GUEST_BOOKING_DOC_API}/bookings/${encodeURIComponent(booking._id)}/documents`, {
            method: "POST",
            body: documents
        });
        const documentJson = await documentResponse.json();
        if (!documentResponse.ok) throw new Error(documentJson.message || "Guest document upload failed.");

        const savedBooking = { ...booking, ...documentJson.data, bookingType };
        localStorage.setItem("guestBooking", JSON.stringify(savedBooking));
        localStorage.setItem("bookingReference", booking.bookingReference || "");
        window.location.href = "guest-booking/booking-success.html";
    } catch (err) {
        console.error("GUEST BOOKING ERROR:", err);
        alert(err.message || "Unable to complete the booking. Please try again.");
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = "Submit Booking <span>→</span>";
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("guestBookingForm");
    if (form) form.addEventListener("submit", submitGuestBookingWithDocuments, true);
});
