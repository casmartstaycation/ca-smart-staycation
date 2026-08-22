const DEFAULT_ADMIN_PAGE_DESIGN = Object.freeze({
  version: 1,
  primaryColor: "#173f35",
  accentColor: "#b08a3c",
  pageBackgroundColor: "#f5f7f6",
  cardBackgroundColor: "#ffffff",
  navBackgroundColor: "#eef3f0",
  textColor: "#24342f",
  mutedTextColor: "#6f7975",
  borderColor: "#d7e1dc",
  dangerColor: "#b42318",
  buttonTextColor: "#ffffff",
  pageBackgroundImageUrl: "",
  fontPreset: "clean",
  cardRadius: 10,
  buttonRadius: 7,
  pageMaxWidth: 1500,
  pagePadding: 20,
  shadow: "soft",
  mobileNavColumns: 2,
  mobilePagePadding: 12,
  compactTables: false,
  customCss: ""
});

const COLORS = new Set([
  "primaryColor", "accentColor", "pageBackgroundColor", "cardBackgroundColor",
  "navBackgroundColor", "textColor", "mutedTextColor", "borderColor",
  "dangerColor", "buttonTextColor"
]);
const NUMBERS = {
  cardRadius: [0, 40], buttonRadius: [0, 30], pageMaxWidth: [720, 2200],
  pagePadding: [0, 60], mobileNavColumns: [1, 3], mobilePagePadding: [6, 30]
};
const ENUMS = {
  fontPreset: new Set(["clean", "modern", "classic", "luxury"]),
  shadow: new Set(["none", "soft", "strong"])
};

function mergedAdminPageDesign(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return { ...DEFAULT_ADMIN_PAGE_DESIGN, ...source, version: 1 };
}
function validColor(value) { return /^#[0-9a-f]{6}$/i.test(String(value || "")); }
function validUrl(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  if (text.startsWith("/")) return text.length <= 1000;
  try { const url = new URL(text); return ["http:", "https:"].includes(url.protocol) && text.length <= 1000; }
  catch (_) { return false; }
}
function sanitizeAdminPageDesign(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const clean = {};
  for (const [key, fallback] of Object.entries(DEFAULT_ADMIN_PAGE_DESIGN)) {
    if (key === "version" || !(key in source)) continue;
    const value = source[key];
    if (COLORS.has(key)) {
      if (!validColor(value)) throw new Error(`Invalid color for ${key}.`);
      clean[key] = String(value).toLowerCase();
    } else if (key === "pageBackgroundImageUrl") {
      if (!validUrl(value)) throw new Error("Invalid admin background image URL.");
      clean[key] = String(value || "").trim();
    } else if (key in NUMBERS) {
      const number = Number(value), [min, max] = NUMBERS[key];
      if (!Number.isFinite(number) || number < min || number > max) throw new Error(`Invalid value for ${key}.`);
      clean[key] = number;
    } else if (ENUMS[key]) {
      const text = String(value || "");
      if (!ENUMS[key].has(text)) throw new Error(`Invalid option for ${key}.`);
      clean[key] = text;
    } else if (typeof fallback === "boolean") {
      clean[key] = Boolean(value);
    } else if (typeof fallback === "string") {
      clean[key] = String(value ?? "").slice(0, key === "customCss" ? 12000 : 1200);
    }
  }
  return clean;
}

module.exports = { DEFAULT_ADMIN_PAGE_DESIGN, mergedAdminPageDesign, sanitizeAdminPageDesign };
