/* =========================================
   CA SMART STAYCATION
   GUEST BOOKING WEBSITE
========================================= */

const API = "https://ca-smart-staycation-muqd.onrender.com/api";

/* =========================================
   GOVERNMENT ID UPLOAD
========================================= */
const governmentIdInput = document.getElementById("governmentId");
const governmentIdName = document.getElementById("governmentIdName");
if (governmentIdInput && governmentIdName) {
    governmentIdInput.addEventListener("change", function () {
        if (this.files && this.files.length > 0) governmentIdName.textContent = this.files[0].name;
        else governmentIdName.textContent = "No file selected";
    });
}

/* =========================================
   GLOBAL VARIABLES
========================================= */
let settings = { extraAdultFee: 300, parkingRate: 500, securityDeposit: 1000 };
let rooms = [];
let parkingSlots = [];
let selectedParkingId = null;
let selectedParkingNumber = null;
let bookedDates = [];
let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();
let selectedCheckIn = null;
let selectedCheckOut = null;

/* =========================================
   DATE HELPERS
========================================= */
function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseBookingDate(value) {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
        const [year, month, day] = String(value).split("-").map(Number);
        const date = new Date(year, month - 1, day);
        date.setHours(0, 0, 0, 0);
        return date;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
}

function isTerminalBooking(booking) {
    return ["Cancelled", "Checked Out", "Expired"].includes(String(booking?.bookingStatus || ""));
}

function bookingHasAccommodation(booking) {
    return Boolean(booking?.room?._id || booking?.room);
}

/*
   IMPORTANT: Parking Only bookings are explicitly saved with
   parkingOnly=true. Do NOT depend only on the populated parking
   object being returned by the API. The backend may return the
   parking reference as a string, null, or an unpopulated field.
*/
function bookingHasParking(booking) {
    if (!booking) return false;
    if (booking.parkingOnly === true) return true;
    if (String(booking.parkingOnly).toLowerCase() === "true") return true;

    const type = String(booking.bookingType || booking.type || "")
        .trim().toLowerCase().replace(/[\s_-]/g, "");
    if (type === "parking" || type === "parkingonly") return true;

    return Boolean(
        booking.parking?._id ||
        booking.parking ||
        booking.parkingSlot?._id ||
        booking.parkingSlot ||
        booking.parkingNumber
    );
}

function datesOverlap(target, checkIn, checkOut) {
    return Boolean(checkIn && checkOut && target >= checkIn && target < checkOut);
}

/* =========================================
   SET MINIMUM DATES
========================================= */
function setMinimumDates() {
    const checkIn = document.getElementById("checkIn");
    const checkOut = document.getElementById("checkOut");
    if (!checkIn || !checkOut) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const minDate = formatLocalDate(today);
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
        if (form) form.addEventListener("submit", submitBooking);
        renderCalendar();
    } catch (err) {
        console.error(err);
    }
});
window.addEventListener("load", renderCalendar);

/* =========================================
   LOAD SETTINGS
========================================= */
async function loadSettings() {
    try {
        const res = await fetch(`${API}/settings`, { cache: "no-store" });
        const json = await res.json();
        if (res.ok && json.data) settings = { ...settings, ...json.data };
    } catch (err) {
        console.warn("Unable to load settings. Using defaults.");
    }
}

/* =========================================
   LOAD ROOMS
========================================= */
async function loadRooms() {
    try {
        const res = await fetch(`${API}/rooms`, { cache: "no-store" });
        const json = await res.json();
        rooms = Array.isArray(json.data) ? json.data : [];
        const roomSelect = document.getElementById("room");
        if (!roomSelect) return;
        roomSelect.innerHTML = '<option value="">Select Accommodation</option>';
        rooms.forEach(room => {
            const number = room.unitNumber || room.roomNumber || "";
            const name = room.unitName || room.roomName || "Room";
            roomSelect.innerHTML += `<option value="${room._id}">${number} - ${name}</option>`;
        });
    } catch (err) {
        console.error("loadRooms ERROR:", err);
    }
}

/* =========================================
   LOAD PARKING SLOTS
========================================= */
async function loadParkingSlots() {
    try {
        const res = await fetch(`${API}/parking`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "Unable to load parking slots.");
        parkingSlots = Array.isArray(json.data) ? json.data : [];
        const preferredParking = parkingSlots.find(slot =>
            String(slot.parkingNumber || "").trim().toUpperCase() === "SLOT 9" ||
            String(slot.parkingName || "").trim().toUpperCase() === "BAY 4"
        );
        const parking = preferredParking || parkingSlots[0] || null;
        selectedParkingId = parking?._id || null;
        selectedParkingNumber = parking?.parkingNumber || null;
    } catch (err) {
        parkingSlots = [];
        selectedParkingId = null;
        selectedParkingNumber = null;
        console.error("Failed to load parking slots:", err);
    }
}

/* =========================================
   LOAD BOOKED DATES
========================================= */
async function loadBookedDates() {
    try {
        const res = await fetch(`${API}/bookings`, {
            cache: "no-store",
            headers: { Accept: "application/json" }
        });
        const json = await res.json();
        bookedDates = res.ok && Array.isArray(json.data) ? json.data : [];
        console.log("BOOKINGS USED BY GUEST CALENDAR:", bookedDates);
        renderCalendar();
    } catch (err) {
        console.error("Failed to load booked dates:", err);
        bookedDates = [];
        renderCalendar();
    }
}

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadBookedDates();
});
window.addEventListener("focus", () => loadBookedDates());

/* =========================================
   SETUP EVENTS
========================================= */
function setupEvents() {
    const room = document.getElementById("room");
    const guests = document.getElementById("guests");
    const parking = document.getElementById("parking");
    const bookingType = document.getElementById("bookingType");
    if (room) room.addEventListener("change", () => { calculateTotal(); renderCalendar(); });
    if (guests) guests.addEventListener("change", calculateTotal);
    if (parking) parking.addEventListener("change", calculateTotal);
    if (bookingType) bookingType.addEventListener("change", bookingTypeChanged);
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
        room.value = ""; room.disabled = true;
        if (guests) { guests.value = 0; guests.disabled = true; }
        if (children) { children.value = 0; children.disabled = true; }
        if (vehicleSection) vehicleSection.style.display = "block";
        if (bookingNotes) bookingNotes.style.display = "none";
    } else if (bookingType === "both") {
        room.disabled = false;
        if (guests) guests.disabled = false;
        if (children) children.disabled = false;
        if (vehicleSection) vehicleSection.style.display = "block";
        if (bookingNotes) bookingNotes.style.display = "block";
    } else {
        room.disabled = false;
        if (guests) guests.disabled = false;
        if (children) children.disabled = false;
        if (vehicleSection) vehicleSection.style.display = "none";
        if (bookingNotes) bookingNotes.style.display = "block";
    }
    selectedCheckIn = null;
    selectedCheckOut = null;
    const checkIn = document.getElementById("checkIn");
    const checkOut = document.getElementById("checkOut");
    if (checkIn) checkIn.value = "";
    if (checkOut) checkOut.value = "";
    calculateTotal();
    loadBookedDates();
}

/* =========================================
   CALCULATE TOTAL
========================================= */
function calculateTotal() {
    const bookingType = document.getElementById("bookingType").value;
    const roomId = document.getElementById("room")?.value;
    const checkIn = document.getElementById("checkIn")?.value;
    const checkOut = document.getElementById("checkOut")?.value;
    if (!checkIn || !checkOut) { updateSummary(0, 0, 0, 0, 0); return; }
    if (bookingType === "parking") {
        const start = parseBookingDate(checkIn); const end = parseBookingDate(checkOut);
        const nights = Math.ceil((end - start) / 86400000);
        if (nights <= 0) { updateSummary(0, 0, 0, 0, 0); return; }
        const parkingTotal = Number(settings.parkingRate) * nights;
        updateSummary(0, 0, parkingTotal, 0, parkingTotal); return;
    }
    if (!roomId) { updateSummary(0, 0, 0, 0, 0); return; }
    const room = rooms.find(r => String(r._id) === String(roomId));
    if (!room) return;
    const start = parseBookingDate(checkIn); const end = parseBookingDate(checkOut);
    const nights = Math.ceil((end - start) / 86400000);
    if (nights <= 0) { updateSummary(0, 0, 0, 0, 0); return; }
    const roomTotal = nights * Number(room.price || 0);
    let extraAdultTotal = 0;
    const guests = Number(document.getElementById("guests")?.value || 1);
    if (guests > 2) extraAdultTotal = (guests - 2) * Number(settings.extraAdultFee || 300) * nights;
    let parkingTotal = 0;
    if (bookingType === "both") parkingTotal = Number(settings.parkingRate || 0) * nights;
    const securityDeposit = Number(settings.securityDeposit || 0);
    const total = roomTotal + extraAdultTotal + parkingTotal + securityDeposit;
    updateSummary(roomTotal, extraAdultTotal, parkingTotal, securityDeposit, total);
}

function updateSummary(roomTotal, extraAdultTotal, parkingTotal, securityDeposit, total) {
    const roomAmount = document.getElementById("roomAmount");
    const extraAmount = document.getElementById("extraGuestAmount");
    const parkingAmount = document.getElementById("parkingAmount");
    const securityDepositAmount = document.getElementById("securityDepositAmount");
    const totalAmount = document.getElementById("totalAmount");
    if (roomAmount) roomAmount.innerText = "₱" + Number(roomTotal).toLocaleString();
    if (extraAmount) extraAmount.innerText = "₱" + Number(extraAdultTotal).toLocaleString();
    if (parkingAmount) parkingAmount.innerText = "₱" + Number(parkingTotal).toLocaleString();
    if (securityDepositAmount) securityDepositAmount.innerText = "₱" + Number(securityDeposit).toLocaleString();
    if (totalAmount) totalAmount.innerText = "₱" + Number(total).toLocaleString();
}

/* =========================================
   SUBMIT BOOKING
========================================= */
async function submitBooking(event) {
    event.preventDefault();
    try {
        const room = document.getElementById("room").value;
        const checkIn = document.getElementById("checkIn").value;
        const checkOut = document.getElementById("checkOut").value;
        const guests = Number(document.getElementById("guests").value);
        const firstName = document.getElementById("firstName").value.trim();
        const lastName = document.getElementById("lastName").value.trim();
        const email = document.getElementById("email").value.trim();
        const mobile = document.getElementById("mobile").value.trim();
        const bookingType = document.getElementById("bookingType").value;
        let parking = null;
        if (bookingType === "both" || bookingType === "parking") {
            parking = selectedParkingId;
            if (!parking) { alert("Parking is currently unavailable. Please try again shortly."); return; }
        }
        if (!checkIn || !checkOut || !firstName || !lastName || !email || !mobile) { alert("Please complete all required fields."); return; }
        if (bookingType !== "parking" && !room) { alert("Please select an accommodation."); return; }
        if (bookingType === "parking" || bookingType === "both") {
            if (!document.getElementById("vehicleBrand").value.trim() || !document.getElementById("vehicleModel").value.trim() || !document.getElementById("vehicleColor").value.trim() || !document.getElementById("plateNumber").value.trim()) {
                alert("Please complete all vehicle information."); return;
            }
        }

        const checkStart = parseBookingDate(checkIn);
        const checkEnd = parseBookingDate(checkOut);
        const roomUnavailable = bookingType !== "parking" && bookedDates.some(booking => {
            if (isTerminalBooking(booking) || !bookingHasAccommodation(booking)) return false;
            const existingStart = parseBookingDate(booking.checkIn);
            const existingEnd = parseBookingDate(booking.checkOut);
            if (!checkStart || !checkEnd || !existingStart || !existingEnd) return false;
            if (!(checkStart < existingEnd && checkEnd > existingStart)) return false;
            const existingRoomId = booking.room?._id || booking.room;
            return !room || String(existingRoomId) === String(room);
        });
        if (roomUnavailable) {
            alert("The selected accommodation is already booked for one or more of those dates.");
            await loadBookedDates();
            return;
        }

        const parkingUnavailable = (bookingType === "parking" || bookingType === "both") && bookedDates.some(booking => {
            if (isTerminalBooking(booking) || !bookingHasParking(booking)) return false;
            const existingStart = parseBookingDate(booking.checkIn);
            const existingEnd = parseBookingDate(booking.checkOut);
            return existingStart && existingEnd && checkStart < existingEnd && checkEnd > existingStart;
        });
        if (parkingUnavailable) {
            alert("Parking slot is already reserved for the selected dates.");
            await loadBookedDates();
            return;
        }

        const bookingData = {
            vehicleBrand: document.getElementById("vehicleBrand")?.value || "",
            vehicleModel: document.getElementById("vehicleModel")?.value || "",
            vehicleColor: document.getElementById("vehicleColor")?.value || "",
            plateNumber: document.getElementById("plateNumber")?.value || "",
            firstName, lastName, email, mobile,
            address: document.getElementById("address").value.trim(),
            bookingReference: "BK" + Date.now(),
            room: bookingType === "parking" ? null : room,
            checkIn, checkOut, guests, parking,
            parkingOnly: bookingType === "parking",
            bookingType,
            totalAmount: parseFloat(document.getElementById("totalAmount").innerText.replace("₱", "").replace(/,/g, ""))
        };
        const res = await fetch(`${API}/bookings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bookingData) });
        const json = await res.json();
        if (!res.ok) { alert(json.message || "Booking failed."); console.error(json); return; }
        const booking = {
            ...(json.data || {}), firstName, lastName, room, parking,
            parkingOnly: bookingType === "parking", bookingType, checkIn, checkOut, guests,
            children: Number(document.getElementById("children").value) || 0,
            totalAmount: bookingData.totalAmount
        };
        localStorage.setItem("guestBooking", JSON.stringify(booking));
        localStorage.setItem("bookingReference", booking.bookingReference || "");
        window.location.href = "guest-booking/booking-success.html";
    } catch (err) {
        console.error(err);
        alert("Unable to connect to server.");
    }
}

/* =========================================
   CHECK IF DATE IS BOOKED
========================================= */
function isDateBooked(date) {
    const bookingType = document.getElementById("bookingType")?.value || "unit";
    const selectedRoom = document.getElementById("room")?.value || "";
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    for (const booking of bookedDates) {
        if (isTerminalBooking(booking)) continue;
        const checkIn = parseBookingDate(booking.checkIn);
        const checkOut = parseBookingDate(booking.checkOut);
        if (!datesOverlap(target, checkIn, checkOut)) continue;

        const hasAccommodation = bookingHasAccommodation(booking);
        const hasParking = bookingHasParking(booking);
        const bookedRoomId = booking.room?._id || booking.room || null;

        if (bookingType === "parking") {
            if (hasParking) return true;
            continue;
        }

        if (bookingType === "both") {
            if (hasAccommodation && String(bookedRoomId) === String(selectedRoom)) return true;
            if (hasParking) return true;
            continue;
        }

        if (hasAccommodation && String(bookedRoomId) === String(selectedRoom)) return true;
    }
    return false;
}

/* =========================================
   RENDER CALENDAR
========================================= */
function renderCalendar() {
    const grid = document.getElementById("calendarGrid");
    const title = document.getElementById("calendarTitle");
    if (!grid || !title) return;
    grid.innerHTML = "";
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    title.textContent = firstDay.toLocaleString("en-US", { month: "long", year: "numeric" });
    const startDay = firstDay.getDay();
    for (let i = 0; i < startDay; i++) {
        const empty = document.createElement("div");
        empty.className = "calendar-day empty";
        grid.appendChild(empty);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(currentYear, currentMonth, day);
        date.setHours(0, 0, 0, 0);
        const cell = document.createElement("div");
        cell.className = "calendar-day";
        cell.textContent = day;
        if (date < today) {
            cell.classList.add("disabled");
        } else if (isDateBooked(date)) {
            cell.classList.add("booked");
            cell.title = "Already booked";
        } else {
            cell.addEventListener("click", () => {
                if (!selectedCheckIn || selectedCheckOut) {
                    selectedCheckIn = new Date(date);
                    selectedCheckOut = null;
                } else if (date > selectedCheckIn) {
                    let blocked = false;
                    const temp = new Date(selectedCheckIn);
                    temp.setDate(temp.getDate() + 1);
                    while (temp < date) {
                        if (isDateBooked(temp)) { blocked = true; break; }
                        temp.setDate(temp.getDate() + 1);
                    }
                    if (blocked || isDateBooked(date)) {
                        alert("Your selected stay contains booked dates.");
                        selectedCheckIn = null;
                        selectedCheckOut = null;
                        document.getElementById("checkIn").value = "";
                        document.getElementById("checkOut").value = "";
                        renderCalendar();
                        return;
                    }
                    selectedCheckOut = new Date(date);
                } else {
                    selectedCheckIn = new Date(date);
                    selectedCheckOut = null;
                }
                document.getElementById("checkIn").value = selectedCheckIn ? formatLocalDate(selectedCheckIn) : "";
                document.getElementById("checkOut").value = selectedCheckOut ? formatLocalDate(selectedCheckOut) : "";
                calculateTotal();
                renderCalendar();
            });
        }
        if (selectedCheckIn && date.getTime() === selectedCheckIn.getTime()) cell.classList.add("checkin");
        if (selectedCheckOut && date.getTime() === selectedCheckOut.getTime()) cell.classList.add("checkout");
        if (selectedCheckIn && selectedCheckOut && date > selectedCheckIn && date < selectedCheckOut) cell.classList.add("selected-range");
        if (date.getTime() === today.getTime()) cell.classList.add("today");
        grid.appendChild(cell);
    }
}

/* =========================================
   MONTH NAVIGATION
========================================= */
function previousMonth() {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
}
function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
}

const prevBtn = document.getElementById("prevMonth");
const nextBtn = document.getElementById("nextMonth");
if (prevBtn) prevBtn.addEventListener("click", previousMonth);
if (nextBtn) nextBtn.addEventListener("click", nextMonth);
