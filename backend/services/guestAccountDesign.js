const DEFAULT_GUEST_ACCOUNT_DESIGN = Object.freeze({
  version: 1,
  primaryColor: "#0b5d4d",
  accentColor: "#c9a44c",
  pageBackgroundColor: "#f4f6f8",
  containerBackgroundColor: "#ffffff",
  panelBackgroundColor: "#fafcfb",
  cardBackgroundColor: "#ffffff",
  textColor: "#333333",
  mutedTextColor: "#666666",
  borderColor: "#dddddd",
  notificationBackgroundColor: "#fff8e8",
  guestMessageBackgroundColor: "#e9f3ee",
  adminMessageBackgroundColor: "#eef2f5",
  noteBackgroundColor: "#f7faf9",
  dangerColor: "#b42318",
  logoutColor: "#777777",
  buttonTextColor: "#ffffff",
  backgroundImageUrl: "",
  fontPreset: "clean",
  containerMaxWidth: 950,
  containerPadding: 30,
  containerRadius: 15,
  cardRadius: 10,
  buttonRadius: 8,
  shadow: "soft",
  showSubtitle: true,
  showUpdatedStatus: true,
  showBookingNote: true,
  showWelcomeBanner: false,
  welcomeBannerText: "",
  titleText: "My Bookings",
  subtitleText: "CA Smart Staycation Guest Account",
  bookingsButtonText: "Bookings",
  notificationsButtonText: "Notifications",
  inboxButtonText: "Message Inbox",
  newBookingButtonText: "Make Another Booking",
  settingsButtonText: "Account Settings",
  logoutButtonText: "Logout",
  notificationsTitleText: "Notifications",
  messagesTitleText: "Messages",
  reservationsTitleText: "Reservations",
  sendMessageButtonText: "Send Message",
  messagePlaceholder: "Send a message to CA Smart Staycation admin...",
  bookingSearchPlaceholder: "Search booking reference...",
  bookingNoteText: "All bookings made using your registered email address are shown here.",
  loadMoreText: "Load More",
  filterAllText: "All Bookings",
  filterActiveText: "Active",
  filterPendingText: "Pending Payment",
  filterConfirmedText: "Confirmed",
  filterCancelledText: "Cancelled",
  filterCompletedText: "Completed",
  mobileContainerMargin: 12,
  mobileContainerPadding: 16,
  mobileTitleSize: 28,
  mobileToolbarColumns: 2,
  mobileButtonFontSize: 13,
  mobileCardPadding: 12,
  customCss: ""
});

const COLOR_FIELDS = new Set([
  "primaryColor", "accentColor", "pageBackgroundColor", "containerBackgroundColor",
  "panelBackgroundColor", "cardBackgroundColor", "textColor", "mutedTextColor",
  "borderColor", "notificationBackgroundColor", "guestMessageBackgroundColor",
  "adminMessageBackgroundColor", "noteBackgroundColor", "dangerColor", "logoutColor",
  "buttonTextColor"
]);
const BOOLEAN_FIELDS = new Set(["showSubtitle", "showUpdatedStatus", "showBookingNote", "showWelcomeBanner"]);
const URL_FIELDS = new Set(["backgroundImageUrl"]);
const NUMBER_LIMITS = {
  containerMaxWidth: [600, 1600],
  containerPadding: [0, 70],
  containerRadius: [0, 50],
  cardRadius: [0, 40],
  buttonRadius: [0, 30],
  mobileContainerMargin: [0, 30],
  mobileContainerPadding: [6, 40],
  mobileTitleSize: [20, 44],
  mobileToolbarColumns: [1, 3],
  mobileButtonFontSize: [10, 20],
  mobileCardPadding: [8, 30]
};
const ENUMS = {
  fontPreset: new Set(["clean", "modern", "classic", "luxury"]),
  shadow: new Set(["none", "soft", "strong"])
};

function mergedGuestAccountDesign(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return { ...DEFAULT_GUEST_ACCOUNT_DESIGN, ...source, version: 1 };
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

function sanitizeGuestAccountDesign(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const clean = {};
  for (const [key, fallback] of Object.entries(DEFAULT_GUEST_ACCOUNT_DESIGN)) {
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
      const maxLength = key === "customCss" ? 12000 : (key.endsWith("Text") || key.endsWith("Placeholder") ? 1200 : 400);
      clean[key] = String(value ?? "").slice(0, maxLength);
    }
  }
  return clean;
}

module.exports = {
  DEFAULT_GUEST_ACCOUNT_DESIGN,
  mergedGuestAccountDesign,
  sanitizeGuestAccountDesign
};
