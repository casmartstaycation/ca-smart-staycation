const TARGETS = new Set(["booking", "guest-account", "admin"]);
const MODES = ["desktop", "mobile"];
const DEFAULT_VISUAL_LAYOUT = Object.freeze({
  version: 1,
  desktop: { elements: {}, blocks: [] },
  mobile: { elements: {}, blocks: [] }
});

function cloneDefault() {
  return { version: 1, desktop: { elements: {}, blocks: [] }, mobile: { elements: {}, blocks: [] } };
}
function mergedVisualLayout(value) {
  const out = cloneDefault();
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  MODES.forEach(mode => {
    const src = source[mode] && typeof source[mode] === "object" ? source[mode] : {};
    out[mode].elements = src.elements && typeof src.elements === "object" && !Array.isArray(src.elements) ? src.elements : {};
    out[mode].blocks = Array.isArray(src.blocks) ? src.blocks : [];
  });
  return out;
}
function number(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
function color(value, fallback = "") {
  const text = String(value || "").trim();
  if (!text || text === "transparent") return text || fallback;
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : fallback;
}
function safeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.startsWith("#") || text.startsWith("/")) return text.slice(0, 1000);
  try { const url = new URL(text); return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? text.slice(0, 1000) : ""; }
  catch (_) { return ""; }
}
function sanitizeElementStyle(input) {
  const src = input && typeof input === "object" ? input : {};
  const clean = {
    x: number(src.x, -1600, 1600, 0), y: number(src.y, -1600, 1600, 0),
    width: number(src.width, 0, 2200, 0), fontSize: number(src.fontSize, 0, 140, 0),
    padding: number(src.padding, 0, 100, 0), borderRadius: number(src.borderRadius, 0, 120, 0),
    opacity: number(src.opacity, 0, 1, 1), scale: number(src.scale, 0.25, 3, 1),
    color: color(src.color), backgroundColor: color(src.backgroundColor),
    textAlign: ["", "left", "center", "right"].includes(String(src.textAlign || "")) ? String(src.textAlign || "") : "",
    hidden: Boolean(src.hidden), zIndex: Math.round(number(src.zIndex, -10, 999, 0))
  };
  if (typeof src.text === "string") clean.text = src.text.slice(0, 1000);
  return clean;
}
function sanitizeBlock(input, index) {
  const src = input && typeof input === "object" ? input : {};
  const type = ["text", "button", "image"].includes(src.type) ? src.type : "text";
  return {
    id: String(src.id || `block-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || `block-${index + 1}`,
    type,
    text: String(src.text || (type === "button" ? "Button" : "New text")).slice(0, 1000),
    href: safeUrl(src.href), src: safeUrl(src.src),
    x: number(src.x, -100, 4000, 80), y: number(src.y, -100, 8000, 80),
    width: number(src.width, 40, 1800, type === "image" ? 280 : 220),
    fontSize: number(src.fontSize, 8, 120, type === "text" ? 24 : 14),
    padding: number(src.padding, 0, 80, type === "button" ? 12 : 0),
    borderRadius: number(src.borderRadius, 0, 100, type === "button" ? 8 : 0),
    opacity: number(src.opacity, 0, 1, 1),
    color: color(src.color, type === "button" ? "#ffffff" : "#24342f"),
    backgroundColor: color(src.backgroundColor, type === "button" ? "#173f35" : "transparent"),
    textAlign: ["left", "center", "right"].includes(src.textAlign) ? src.textAlign : "left",
    zIndex: Math.round(number(src.zIndex, 0, 999, 40))
  };
}
function sanitizeVisualLayout(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const out = cloneDefault();
  MODES.forEach(mode => {
    const src = source[mode] && typeof source[mode] === "object" ? source[mode] : {};
    const elements = src.elements && typeof src.elements === "object" && !Array.isArray(src.elements) ? src.elements : {};
    const entries = Object.entries(elements).slice(0, 120);
    entries.forEach(([key, value]) => {
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(key)) return;
      out[mode].elements[key] = sanitizeElementStyle(value);
    });
    out[mode].blocks = (Array.isArray(src.blocks) ? src.blocks : []).slice(0, 30).map(sanitizeBlock);
  });
  return out;
}
function assertTarget(target) {
  const key = String(target || "").trim();
  if (!TARGETS.has(key)) throw new Error("Unknown visual editor target.");
  return key;
}

module.exports = { DEFAULT_VISUAL_LAYOUT, mergedVisualLayout, sanitizeVisualLayout, assertTarget };
