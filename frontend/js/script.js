/* =========================================
   CA SMART STAYCATION
   GUEST BOOKING WEBSITE
========================================= */

// Backend API
const API = "https://ca-smart-staycation-muqd.onrender.com/api";

/* =========================================
   GOVERNMENT ID UPLOAD
========================================= */

const governmentIdInput = document.getElementById("governmentId");
const governmentIdName = document.getElementById("governmentIdName");

if (governmentIdInput && governmentIdName) {

    governmentIdInput.addEventListener("change", function () {

        if (this.files && this.files.length > 0) {

            governmentIdName.textContent = this.files[0].name;

        } else {

            governmentIdName.textContent = "No file selected";

        }

    });

}

/* =========================================
   GLOBAL VARIABLES
========================================= */

let settings = {
    extraAdultFee: 300,
    parkingRate: 500,
    securityDeposit: 1000
};

let rooms = [];
let parkingSlots = [];
let selectedParkingId = null;
let bookedDates = [];

let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();

let selectedCheckIn = null;
let selectedCheckOut = null;

/* =========================================
   SET MINIMUM DATES
========================================= */

function setMinimumDates() {

    const checkIn =
        document.getElementById("checkIn");

    const checkOut =
        document.getElementById("checkOut");

    if (!checkIn || !checkOut) return;

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const minDate =
        today.toISOString().split("T")[0];

    checkIn.min = minDate;
    checkOut.min = minDate;

}

/* =========================================
   START WEBSITE
========================================= */

document.addEventListener("DOMContentLoaded", async () => {

    try {

        setMinimumDates();

        await loadSettings();
        await loadRooms();
        await loadParkingSlots();
        await loadBookedDates();

        setupEvents();

    const form = document.getElementById("guestBookingForm");

    if (form) {
    form.addEventListener("submit", submitBooking);
}    

    } catch (err) {

        console.error(err);

    }

});

window.addEventListener("load", () => {

    renderCalendar();

});

/* =========================================
   LOAD SETTINGS
========================================= */

async function loadSettings() {

    try {

        const res = await fetch(`${API}/settings`);

        const json = await res.json();

        if (res.ok && json.data) {

            settings = {
                ...settings,
                ...json.data
            };

        }

    } catch (err) {

        console.warn("Unable to load settings. Using defaults.");

    }

}

/* =========================================
   LOAD ROOMS
========================================= */

async function loadRooms() {

    console.log("1. loadRooms started");

    try {

        console.log("2. fetching...");

        const res = await fetch(`${API}/rooms`);

        console.log("3. response received");

        const json = await res.json();

        console.log("4. json", json);

        rooms = json.data || [];

        console.log("5. rooms", rooms);

        const roomSelect = document.getElementById("room");

        console.log("6. select", roomSelect);

        roomSelect.innerHTML =
            '<option value="">Select Accommodation</option>';

        rooms.forEach(room => {

            console.log("Adding room:", room);

            const number =
                room.unitNumber ||
                room.roomNumber ||
                "";

            const name =
                room.unitName ||
                room.roomName ||
                "Room";

            roomSelect.innerHTML += `
                <option value="${room._id}">
                    ${number} - ${name}
                </option>
            `;
        });

        console.log("7. Finished");

    } catch (err) {

        console.error("loadRooms ERROR:", err);

    }

}

/* =========================================
   LOAD PARKING SLOTS
========================================= */

async function loadParkingSlots() {

    try {

        const res = await fetch(`${API}/parking`);
        const json = await res.json();

        if (!res.ok) {
            throw new Error(json.message || "Unable to load parking slots.");
        }

        parkingSlots = Array.isArray(json.data)
            ? json.data
            : [];

        // Prefer the existing business slot by name/number, but always
        // use its ID from the active database instead of hardcoding an ID.
        const preferredParking = parkingSlots.find(slot =>
            String(slot.parkingNumber || "").trim().toUpperCase() === "SLOT 9" ||
            String(slot.parkingName || "").trim().toUpperCase() === "BAY 4"
        );

        const parking = preferredParking || parkingSlots[0] || null;

        selectedParkingId = parking?._id || null;

        console.log("PARKING SLOTS:", parkingSlots);
        console.log("SELECTED PARKING:", parking);

        if (!selectedParkingId) {
            console.warn("No parking slot is available from /api/parking.");
        }

    } catch (err) {

        parkingSlots = [];
        selectedParkingId = null;

        console.error("Failed to load parking slots:", err);

    }

}

/* =========================================
   LOAD BOOKED DATES
========================================= */

async function loadBookedDates() {

    try {

        const res = await fetch(`${API}/bookings`);
        const json = await res.json();

        if (res.ok) {
            bookedDates = json.data || [];
        } else {
            bookedDates = [];
        }

        console.log("BOOKINGS:", bookedDates);

        console.log(
    "SEPTEMBER 13-14 ALL BOOKINGS:",
    bookedDates.filter(b =>
        b.checkIn?.startsWith("2026-09-13") ||
        b.checkOut?.startsWith("2026-09-14") ||
        (
            b.checkIn &&
            b.checkOut &&
            new Date(b.checkIn) <= new Date("2026-09-13") &&
            new Date(b.checkOut) > new Date("2026-09-13")
        )
    )
);

        console.table(bookedDates.map(b => ({
    ref: b.bookingReference,
    parking: b.parking,
    parkingOnly: b.parkingOnly,
    room: b.room,
    checkIn: b.checkIn,
    checkOut: b.checkOut
})));


        // Re-render AFTER bookings are loaded
        renderCalendar();

    } catch (err) {

        console.error("Failed to load booked dates:", err);

        bookedDates = [];

        // Still render an empty calendar
        renderCalendar();

    }

}

/* =========================================
   SETUP EVENTS
========================================= */

function setupEvents() {

    const room = document.getElementById("room");
    const guests = document.getElementById("guests");
    const parking = document.getElementById("parking");
    const bookingType = document.getElementById("bookingType");

    if (room) {
        room.addEventListener("change", () => {
            calculateTotal();
            renderCalendar();
        });
    }

    if (guests) {
        guests.addEventListener("change", calculateTotal);
    }

    if (parking) {
        parking.addEventListener("change", calculateTotal);
    }

    if (bookingType) {
        bookingType.addEventListener("change", bookingTypeChanged);
    }

}

/* =========================================
   BOOKING TYPE
========================================= */

function bookingTypeChanged() {

    const bookingType = document.getElementById("bookingType").value;

    const room = document.getElementById("room");
    const guests = document.getElementById("guests");
    const children = document.getElementById("children");

    const vehicleSection = document.getElementById("vehicleSection");
    const bookingNotes = document.getElementById("bookingNotes");

    if (bookingType === "parking") {

        room.value = "";
        room.disabled = true;

        if (guests) {
            guests.value = 0;
            guests.disabled = true;
        }

        if (children) {
            children.value = 0;
            children.disabled = true;
        }

        if (vehicleSection)
            vehicleSection.style.display = "block";

        if (bookingNotes)
            bookingNotes.style.display = "none";

    }
    else if (bookingType === "both") {

        room.disabled = false;

        if (guests)
            guests.disabled = false;

        if (children)
            children.disabled = false;

        if (vehicleSection)
            vehicleSection.style.display = "block";

        if (bookingNotes)
            bookingNotes.style.display = "block";

    }
    else { // Accommodation Only

        room.disabled = false;

        if (guests)
            guests.disabled = false;

        if (children)
            children.disabled = false;

        if (vehicleSection)
            vehicleSection.style.display = "none";

        if (bookingNotes)
            bookingNotes.style.display = "block";

    }

    // Clear selected dates
    selectedCheckIn = null;
    selectedCheckOut = null;

    document.getElementById("checkIn").value = "";
    document.getElementById("checkOut").value = "";

    calculateTotal();

    loadBookedDates();

}

/* =========================================
   CALCULATE TOTAL
========================================= */

function calculateTotal() {

    const bookingType =
        document.getElementById("bookingType").value;

    const roomId =
        document.getElementById("room")?.value;

    const checkIn =
        document.getElementById("checkIn")?.value;

    const checkOut =
        document.getElementById("checkOut")?.value;

    if (!checkIn || !checkOut) {

        updateSummary(0,0,0,0,0);
        return;

    }

    // PARKING ONLY
    if (bookingType === "parking") {

        const start = new Date(checkIn);
        const end = new Date(checkOut);

        const nights =
            Math.ceil(
                (end - start) /
                (1000 * 60 * 60 * 24)
            );

        if (nights <= 0) {

            updateSummary(0,0,0,0,0);
            return;

        }

        const parkingTotal =
            Number(settings.parkingRate) * nights;

        updateSummary(
            0,
            0,
            parkingTotal,
            0,
            parkingTotal
        );

        return;
    }

    // From this point onward,
    // room is REQUIRED.
    if (!roomId) {

        updateSummary(0,0,0,0,0);
        return;

    }



    const room =
        rooms.find(r => r._id === roomId);

    if (!room) return;

    const start =
        new Date(checkIn);

    const end =
        new Date(checkOut);

    const nights =
        Math.ceil(
            (end - start) /
            (1000 * 60 * 60 * 24)
        );

    if (nights <= 0) {

        updateSummary(0, 0, 0, 0, 0);
        return;

    }

    let roomTotal =
        nights * Number(room.price || 0);

    let extraAdultTotal = 0;

    const guests =
        Number(
            document.getElementById("guests")?.value || 1
        );

    if (guests > Number(room.capacity || 2)) {

        extraAdultTotal =
            (guests - room.capacity) *
            settings.extraAdultFee *
            nights;

    }

  let parkingTotal = 0;

if (
    bookingType === "parking" ||
    bookingType === "both"
) {

    parkingTotal =
        Number(settings.parkingRate || 0) * nights;

}

    const securityDeposit =
    bookingType === "parking"
        ? 0
        : Number(settings.securityDeposit || 0);

const total =
    roomTotal +
    extraAdultTotal +
    parkingTotal +
    securityDeposit;

    updateSummary(
        roomTotal,
        extraAdultTotal,
        parkingTotal,
        securityDeposit,
        total
    );
    

}


/* =========================================
   UPDATE SUMMARY
========================================= */

function updateSummary(
    roomTotal,
    extraAdultTotal,
    parkingTotal,
    securityDeposit,
    total
) {

    const roomAmount =
        document.getElementById("roomAmount");

    const extraAmount =
        document.getElementById("extraGuestAmount");

    const parkingAmount =
        document.getElementById("parkingAmount");

    const securityDepositAmount =
        document.getElementById("securityDepositAmount");

    const totalAmount =
        document.getElementById("totalAmount");

    if (roomAmount)
        roomAmount.innerText =
            "₱" + Number(roomTotal).toLocaleString();

    if (extraAmount)
        extraAmount.innerText =
            "₱" + Number(extraAdultTotal).toLocaleString();

    if (parkingAmount)
        parkingAmount.innerText =
            "₱" + Number(parkingTotal).toLocaleString();

    if (securityDepositAmount)
        securityDepositAmount.innerText =
            "₱" + Number(securityDeposit).toLocaleString();

    if (totalAmount)
        totalAmount.innerText =
            "₱" + Number(total).toLocaleString();
}

/* =========================================
   SUBMIT BOOKING
========================================= */

async function submitBooking(event) {

      console.log("submitBooking() called");

      console.log("BOOKING TYPE =", document.getElementById("bookingType").value);

    event.preventDefault();

    try {

        const room =
            document.getElementById("room").value;

        const checkIn =
            document.getElementById("checkIn").value;

        const checkOut =
            document.getElementById("checkOut").value;

        const guests =
            Number(document.getElementById("guests").value);

        const firstName =
            document.getElementById("firstName").value.trim();

        const lastName =
            document.getElementById("lastName").value.trim();

        const email =
            document.getElementById("email").value.trim();

        const mobile =
        document.getElementById("mobile").value.trim();

        const bookingType =
    document.getElementById("bookingType").value;

    console.log("BOOKING TYPE:", bookingType);

let parking = null;

// Accommodation + Parking / Parking Only
if (bookingType === "both" || bookingType === "parking") {

    // Use the parking ID loaded from the active database.
    parking = selectedParkingId;

    if (!parking) {
        alert("Parking is currently unavailable. Please try again shortly.");
        return;
    }

}

        if (
    !checkIn ||
    !checkOut ||
    !firstName ||
    !lastName ||
    !email ||
    !mobile
) {
    alert("Please complete all required fields.");
    return;
}

if (bookingType !== "parking" && !room) {
    alert("Please select an accommodation.");
    return;
}

if (
    bookingType === "parking" ||
    bookingType === "both"
) {

    if (
        !document.getElementById("vehicleBrand").value.trim() ||
        !document.getElementById("vehicleModel").value.trim() ||
        !document.getElementById("vehicleColor").value.trim() ||
        !document.getElementById("plateNumber").value.trim()
    ) {

        alert("Please complete all vehicle information.");

        return;

    }

}

const bookingData = {

    vehicleBrand:
    document.getElementById("vehicleBrand")?.value || "",

vehicleModel:
    document.getElementById("vehicleModel")?.value || "",

vehicleColor:
    document.getElementById("vehicleColor")?.value || "",

plateNumber:
    document.getElementById("plateNumber")?.value || "",

    firstName,
    lastName,
    email,
    mobile,

    address:
        document.getElementById("address").value.trim(),

    bookingReference:
        "BK" + Date.now(),

    room:
        bookingType === "parking"
            ? null
            : room,

    checkIn,
    checkOut,

    guests,

    parking,

    parkingOnly:
        bookingType === "parking",

    totalAmount:
        parseFloat(
            document
                .getElementById("totalAmount")
                .innerText
                .replace("₱", "")
                .replace(/,/g, "")

                
        )
        

};



        console.log("SENDING BOOKING:", bookingData);

        const res = await fetch(`${API}/bookings`, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(bookingData)

        });

        const json = await res.json();

        if (!res.ok) {

            alert(json.message || "Booking failed.");

            console.error(json);

            return;

        }

        console.log("Booking Success:", json);

        const booking = {

    ...(json.data || {}),

firstName,
lastName,

room,

parking,

parkingOnly: bookingType === "parking",

    bookingType,

    checkIn,
    checkOut,

    guests,

    children:
        Number(document.getElementById("children").value) || 0,

    totalAmount: bookingData.totalAmount

};

localStorage.setItem(
    "guestBooking",
    JSON.stringify(booking)
);

        localStorage.setItem(
            "bookingReference",
            booking.bookingReference || ""
        );

        window.location.href =
        "guest-booking/booking-success.html";

    }

    catch (err) {

        console.error(err);

        alert("Unable to connect to server.");

    }

    

}

/* =========================================
   CHECK IF DATE IS BOOKED
========================================= */

function isDateBooked(date) {
    

    const bookingType =
        document.getElementById("bookingType")?.value;

    const selectedRoom =
        document.getElementById("room")?.value || "";

    const selectedParking = selectedParkingId;


    const target = new Date(date);
    target.setHours(0,0,0,0);


    for (const booking of bookedDates) {


        if (
            booking.bookingStatus === "Cancelled" ||
            booking.bookingStatus === "Checked Out"
        ) {
            continue;
        }


        const checkIn =
            new Date(booking.checkIn);

        const checkOut =
            new Date(booking.checkOut);


        checkIn.setHours(0,0,0,0);
        checkOut.setHours(0,0,0,0);


        const overlaps =
            target >= checkIn &&
            target < checkOut;


        if (!overlaps) {
            continue;
        }


        const bookedRoom =
            booking.room?._id ||
            booking.room ||
            null;


        console.log("booking.parking =", booking.parking);

const bookedParking =
    booking.parking?._id ||
    booking.parking ||
    null;



        // ACCOMMODATION ONLY
        if (bookingType === "unit") {

            if (
                bookedRoom &&
                String(bookedRoom) === String(selectedRoom)
            ) {
                return true;
            }

        }



        // PARKING ONLY
        if (bookingType === "parking") {

            if (
                selectedParking &&
                bookedParking &&
                String(bookedParking) === String(selectedParking)
            ) {
                return true;
            }

        }



        // ACCOMMODATION + PARKING
        if (bookingType === "both") {


            if (
                bookedRoom &&
                String(bookedRoom) === String(selectedRoom)
            ) {
                return true;
            }


            if (
                selectedParking &&
                bookedParking &&
                String(bookedParking) === String(selectedParking)
            ) {
                return true;
            }

        }


    }


    return false;

}

/* =========================================
   RENDER CALENDAR
========================================= */

function renderCalendar() {

    const grid =
        document.getElementById("calendarGrid");

    const title =
        document.getElementById("calendarTitle");

    if (!grid || !title) return;

    grid.innerHTML = "";

    const firstDay =
        new Date(currentYear, currentMonth, 1);

    const lastDay =
        new Date(currentYear, currentMonth + 1, 0);


    title.textContent =
        firstDay.toLocaleString("en-US", {
            month: "long",
            year: "numeric"
        });

    const startDay =
        firstDay.getDay();

    for (let i = 0; i < startDay; i++) {

        const empty =
            document.createElement("div");

        empty.className =
            "calendar-day empty";

        grid.appendChild(empty);

    }

    const today =
        new Date();

    today.setHours(0,0,0,0);

    for (
        let day = 1;
        day <= lastDay.getDate();
        day++
    ) {


        const date =
            new Date(currentYear, currentMonth, day);

        date.setHours(0,0,0,0);

        const cell =
            document.createElement("div");

        cell.className =
            "calendar-day";

        cell.textContent = day;

        if (date < today) {

            cell.classList.add("disabled");

        }

        else if (isDateBooked(date)) {

    console.log("BOOKED DATE RENDERED:", date);

    cell.classList.add("booked");

    cell.title =
        "Already booked";

}

        else {

            cell.addEventListener("click", () => {

                if (
                    !selectedCheckIn ||
                    selectedCheckOut
                ) {

                    selectedCheckIn =
                        new Date(date);

                    selectedCheckOut =
                        null;

                }

                else {

                    if (date > selectedCheckIn) {

                        let blocked = false;

                        const temp =
                            new Date(selectedCheckIn);

                        temp.setDate(
                            temp.getDate() + 1
                        );

                        while (temp < date) {

                            if (isDateBooked(temp)) {

                                blocked = true;
                                break;

                            }

                            temp.setDate(
                                temp.getDate() + 1
                            );

                        }

                        if (blocked) {

                            alert("Your selected stay contains booked dates.");

                            selectedCheckIn = null;
                            selectedCheckOut = null;

                            document.getElementById("checkIn").value = "";
                            document.getElementById("checkOut").value = "";

                            renderCalendar();

                            return;
                        }

                            selectedCheckOut =
                            new Date(date);

                    }

                    else {

                        selectedCheckIn =
                            new Date(date);

                        selectedCheckOut =
                            null;

                    }

                }

                document.getElementById("checkIn").value =
                    selectedCheckIn
                        .toISOString()
                        .split("T")[0];

                document.getElementById("checkOut").value =
                    selectedCheckOut
                        ? selectedCheckOut
                              .toISOString()
                              .split("T")[0]
                        : "";

                calculateTotal();

                renderCalendar();

            });

        }

        if (
            selectedCheckIn &&
            date.getTime() ===
            selectedCheckIn.getTime()
        ) {

            cell.classList.add("checkin");

        }

        if (
            selectedCheckOut &&
            date.getTime() ===
            selectedCheckOut.getTime()
        ) {

            cell.classList.add("checkout");

        }

        if (
            selectedCheckIn &&
            selectedCheckOut &&
            date > selectedCheckIn &&
            date < selectedCheckOut
        ) {

            cell.classList.add("selected-range");

        }

        if (
            date.getTime() ===
            today.getTime()
        ) {

            cell.classList.add("today");

        }


        grid.appendChild(cell);

    }

    console.log("Finished rendering:",
    document.getElementById("calendarGrid").children.length);

}



/* =========================================
   MONTH NAVIGATION
========================================= */

function previousMonth() {

    currentMonth--;

    if (currentMonth < 0) {

        currentMonth = 11;
        currentYear--;

    }

    renderCalendar();

}

function nextMonth() {

    currentMonth++;

    if (currentMonth > 11) {

        currentMonth = 0;
        currentYear++;

    }

    renderCalendar();

}

/* =========================================
   CALENDAR BUTTONS
========================================= */

const prevBtn = document.getElementById("prevMonth");
const nextBtn = document.getElementById("nextMonth");

if (prevBtn) {
    prevBtn.addEventListener("click", previousMonth);
}

if (nextBtn) {
    nextBtn.addEventListener("click", nextMonth);
}

/* =========================================
   RESET BOOKING
========================================= */

function clearBookingSelection() {

    selectedCheckIn = null;
    selectedCheckOut = null;

    const checkIn =
        document.getElementById("checkIn");

    const checkOut =
        document.getElementById("checkOut");

    if (checkIn) checkIn.value = "";

    if (checkOut) checkOut.value = "";

    calculateTotal();

    renderCalendar();

}

/* =========================================
   BOOKING SUCCESS
========================================= */

function saveBookingReference(booking) {

    if (!booking) return;

    localStorage.setItem(
        "guestBooking",
        JSON.stringify(booking)
    );

    if (booking.bookingReference) {

        localStorage.setItem(
            "bookingReference",
            booking.bookingReference
        );

    }

}

/* =========================================
   LOAD BOOKING SUCCESS PAGE
========================================= */

function loadBookingReference() {

    const booking =
        JSON.parse(
            localStorage.getItem("guestBooking")
        );

    const reference =
        document.getElementById("bookingReference");

    if (!reference) return;

    if (
        booking &&
        booking.bookingReference
    ) {

        reference.innerText =
            booking.bookingReference;

    }

    else {

        reference.innerText = "N/A";

    }

}

/* =========================================
   FORMAT CURRENCY
========================================= */

function peso(value) {

    return "₱" +
        Number(value || 0)
            .toLocaleString(
                "en-PH",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            );

}

/* =========================================
   PAGE INITIALIZATION
========================================= */

window.addEventListener("load", () => {

    if (
        document.getElementById("bookingReference")
    ) {

        loadBookingReference();

    }

});