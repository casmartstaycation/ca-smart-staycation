const DEFAULT_PAGE_DESIGN = Object.freeze({
  version: 1,
  primaryColor: "#063b32",
  secondaryColor: "#0b5d4d",
  accentColor: "#c9a44c",
  accentLightColor: "#ead79c",
  pageBackgroundColor: "#eef3ee",
  cardBackgroundColor: "#ffffff",
  textColor: "#18332d",
  mutedTextColor: "#6b746f",
  inputBorderColor: "#ded7c5",
  buttonTextColor: "#063b32",
  heroOverlayColor: "#000000",
  heroOverlayOpacity: 0.25,
  heroImageUrl: "/images/luxury-room-4.png",
  pageBackgroundImageUrl: "",
  fontPreset: "classic",
  cardRadius: 18,
  containerRadius: 24,
  buttonRadius: 4,
  cardShadow: "soft",
  showHero: true,
  showFooter: true,
  showBookingInfo: true,
  showGuestLoginLinks: true,
  showAnnouncement: false,
  announcementText: "",
  logoMark: "CA",
  brandName: "CA Smart Staycation",
  brandTagline: "Elegant Comfort • Private Stay",
  headerGuestLoginLabel: "Guest Login",
  headerBookLabel: "Book Your Stay",
  heroEyebrow: "YOUR PRIVATE LUXURY ESCAPE",
  heroTitle: "Stay in Comfort.\nCreate Beautiful Memories.",
  heroDescription: "Reserve your stay with our simple and secure online booking process.",
  heroPrimaryButton: "Reserve Now",
  heroLoginText: "Already booked? Guest Login",
  bookingSectionLabel: "ONLINE RESERVATION",
  bookingTitle: "Reserve Your Stay",
  bookingDescription: "Complete the reservation form below to book your stay.",
  bookingStepTitle: "Booking Details",
  bookingStepDescription: "Select your booking type and preferred dates.",
  guestStepTitle: "Guest Information",
  guestStepDescription: "Please enter accurate personal information.",
  idStepTitle: "Government-Issued ID",
  idStepDescription: "Upload a clear and valid government-issued ID.",
  summaryStepTitle: "Booking Summary",
  summaryStepDescription: "Review your reservation before proceeding.",
  bookingTypeLabel: "Booking Type",
  parkingLabel: "Select Parking Lot",
  accommodationLabel: "Select Accommodation",
  datesLabel: "Select Your Stay Dates",
  guestsLabel: "Number of Guests",
  childrenLabel: "Children (0–2 years old)",
  firstNameLabel: "First Name",
  lastNameLabel: "Last Name",
  emailLabel: "Email Address",
  mobileLabel: "Mobile Number",
  addressLabel: "Complete Address",
  governmentUploadLabel: "Upload Government ID",
  governmentUploadHelp: "JPG, PNG, or PDF",
  summaryAccommodationLabel: "Accommodation",
  summaryExtraGuestLabel: "Extra Guest",
  summaryParkingLabel: "Parking",
  summaryDepositLabel: "Security Deposit",
  summaryTotalLabel: "Total",
  bookingInfoTitle: "Booking Information",
  securityInfoTitle: "💰 Security Deposit",
  securityInfoText: "A ₱1,000 Security Deposit is required for accommodation bookings. It is refundable within 1–2 days after checkout, subject to inspection.",
  extraGuestInfoTitle: "👥 Additional Guests",
  extraGuestInfoText: "Your accommodation includes 2 guests. Every additional guest is charged ₱300 per night.",
  childrenInfoTitle: "👶 Children",
  childrenInfoText: "Children aged 0–2 years old stay FREE and are NOT counted toward maximum capacity.",
  capacityInfoTitle: "🏡 Maximum Capacity",
  capacityInfoText: "Maximum accommodation capacity is 4 guests.",
  vehicleTitle: "Vehicle Information",
  vehicleNoticeTitle: "Parking Information Required When Parking Is Selected",
  vehicleNoticeText: "Vehicle information is required for Parking Only or when a guest selects a parking lot under Accommodation + Parking.",
  vehicleNoParkingText: "If you choose No parking required, you do not need to provide vehicle information.",
  driversLicenseLabel: "Driver's License",
  vehicleBrandLabel: "Vehicle Brand",
  vehicleModelLabel: "Vehicle Model",
  vehicleColorLabel: "Vehicle Color",
  plateNumberLabel: "Plate Number",
  submitButtonLabel: "Submit Booking",
  submitNote: "Your booking will remain pending until the payment is reviewed and validated.",
  footerTitle: "CA Smart Staycation",
  footerDescription: "Private comfort with an elegant stay experience.",
  footerCopyright: "© 2026 CA Smart Staycation. All rights reserved.",
  customCss: ""
});

const COLOR_FIELDS = new Set([
  "primaryColor", "secondaryColor", "accentColor", "accentLightColor",
  "pageBackgroundColor", "cardBackgroundColor", "textColor", "mutedTextColor",
  "inputBorderColor", "buttonTextColor", "heroOverlayColor"
]);
const BOOLEAN_FIELDS = new Set(["showHero", "showFooter", "showBookingInfo", "showGuestLoginLinks", "showAnnouncement"]);
const URL_FIELDS = new Set(["heroImageUrl", "pageBackgroundImageUrl"]);
const NUMBER_LIMITS = {
  heroOverlayOpacity: [0, 0.9],
  cardRadius: [0, 40],
  containerRadius: [0, 50],
  buttonRadius: [0, 30]
};
const ENUMS = {
  fontPreset: new Set(["classic", "modern", "clean", "luxury"]),
  cardShadow: new Set(["none", "soft", "strong"])
};

function mergedPageDesign(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return { ...DEFAULT_PAGE_DESIGN, ...source, version: 1 };
}

function validColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ""));
}

function validUrl(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  if (text.startsWith("/")) return text.length <= 1000;
  try {
    const url = new URL(text);
    return ["http:", "https:"].includes(url.protocol) && text.length <= 1000;
  } catch (_) {
    return false;
  }
}

function sanitizePageDesign(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const clean = {};
  for (const [key, fallback] of Object.entries(DEFAULT_PAGE_DESIGN)) {
    if (key === "version" || !(key in source)) continue;
    const value = source[key];
    if (COLOR_FIELDS.has(key)) {
      if (!validColor(value)) throw new Error(`Invalid color for ${key}.`);
      clean[key] = String(value).toLowerCase();
      continue;
    }
    if (BOOLEAN_FIELDS.has(key)) {
      clean[key] = Boolean(value);
      continue;
    }
    if (URL_FIELDS.has(key)) {
      if (!validUrl(value)) throw new Error(`Invalid image URL for ${key}.`);
      clean[key] = String(value || "").trim();
      continue;
    }
    if (key in NUMBER_LIMITS) {
      const number = Number(value);
      const [min, max] = NUMBER_LIMITS[key];
      if (!Number.isFinite(number) || number < min || number > max) throw new Error(`Invalid value for ${key}.`);
      clean[key] = number;
      continue;
    }
    if (ENUMS[key]) {
      const text = String(value || "");
      if (!ENUMS[key].has(text)) throw new Error(`Invalid option for ${key}.`);
      clean[key] = text;
      continue;
    }
    if (typeof fallback === "string") {
      const maxLength = key === "customCss" ? 12000 : (key.endsWith("Text") || key.endsWith("Description") ? 1200 : 400);
      clean[key] = String(value ?? "").slice(0, maxLength);
    }
  }
  return clean;
}

module.exports = { DEFAULT_PAGE_DESIGN, mergedPageDesign, sanitizePageDesign };
