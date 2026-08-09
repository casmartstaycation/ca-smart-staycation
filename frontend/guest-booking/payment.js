const uploadButton = document.getElementById("uploadPayment");

uploadButton.addEventListener("click", async (e) => {

    e.preventDefault();

    uploadButton.disabled = true;
    uploadButton.innerText = "Uploading...";

    console.log("UPLOAD CLICKED");

    const booking = JSON.parse(localStorage.getItem("guestBooking"));

    if (!booking) {

    alert("Booking information not found.");

    uploadButton.disabled = false;
    uploadButton.innerHTML = "Submit Payment <span>→</span>";

    return;

    }

    const bookingId = booking._id || booking.id;

    const file = document.getElementById("paymentProof").files[0];

    console.log("BOOKING ID:", bookingId);
    console.log("FILE:", file);

    if (!file) {

        alert("No file selected.");

        uploadButton.disabled = false;
        uploadButton.innerHTML = "Submit Payment <span>→</span>";

        return;

    }

    const formData = new FormData();
    formData.append("paymentProof", file);

    const url =
        `https://ca-smart-staycation-muqd.onrender.com/api/bookings/${bookingId}/payment`;

    console.log("UPLOAD URL:", url);

    try {

        console.log("BEFORE FETCH");

        const response = await fetch(url, {
            method: "POST",
            body: formData
        });

        console.log("STATUS:", response.status);
        console.log("OK:", response.ok);

        const result = await response.json();

        console.log(result);

        if (!response.ok) {
            alert(result.message);
            uploadButton.disabled = false;
            uploadButton.innerHTML = "Submit Payment <span>→</span>";
            return;
        }

        alert("Payment uploaded successfully.");

        localStorage.removeItem("guestBooking");

        window.location.href = "../index.html";

    } catch (err) {

        console.error(err);

        alert("Upload failed.");

        uploadButton.disabled = false;
        uploadButton.innerHTML = "Submit Payment <span>→</span>";

    }

});