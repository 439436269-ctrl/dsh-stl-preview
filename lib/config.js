/**
 * Host configuration defaults and normalization.
 *
 * The schemastery schema lives in `./schema.js` so this module stays importable
 * without the host-supplied `@deepseek-ai/schemastery` package (unit tests and
 * the route run against these helpers directly).
 *
 * @module dsh-stl-preview/config
 */

/** Suffixes served by the route and the preview renderer. */
export const DEFAULT_EXTENSIONS = ["stl"];

/** Largest mesh the route streams by default (512 MiB). */
export const DEFAULT_MAX_BYTES = 512 * 1024 * 1024;

/** Bytes per ranged read. */
export const DEFAULT_CHUNK_BYTES = 1024 * 1024;

/** Millimetres per STL unit when the file does not say. */
export const DEFAULT_UNIT_SCALE = 1;

/** Viewport colour for a format that carries no materials. */
export const DEFAULT_COLOR = "#c7d2e2";

/** Above this triangle count the browser skips the watertightness pass. */
export const DEFAULT_ANALYSIS_MAX_TRIANGLES = 400_000;

/** Fallback when the loader supplies no config object at all. */
export const DEFAULTS = Object.freeze({
  enabled: true,
  routePath: "/api/stl-preview",
  extensions: DEFAULT_EXTENSIONS,
  maxBytes: DEFAULT_MAX_BYTES,
  chunkBytes: DEFAULT_CHUNK_BYTES,
  unitScale: DEFAULT_UNIT_SCALE,
  color: DEFAULT_COLOR,
  analysisMaxTriangles: DEFAULT_ANALYSIS_MAX_TRIANGLES,
});

/**
 * Merge a loader-supplied config over the defaults.
 * @param config - whatever the loader supplied.
 * @returns a complete, validated-enough config.
 */
export function resolveConfig(config) {
  const input = config !== null && typeof config === "object" ? config : {};
  return {
    enabled: input.enabled === undefined ? DEFAULTS.enabled : input.enabled === true,
    routePath: normalizeRoutePath(input.routePath),
    extensions: normalizeExtensions(input.extensions, DEFAULT_EXTENSIONS),
    maxBytes: clampInteger(input.maxBytes, DEFAULT_MAX_BYTES, 1, 8 * 1024 * 1024 * 1024),
    chunkBytes: clampInteger(input.chunkBytes, DEFAULT_CHUNK_BYTES, 64 * 1024, 16 * 1024 * 1024),
    unitScale: clampNumber(input.unitScale, DEFAULT_UNIT_SCALE, 1e-6, 1000),
    color: normalizeColor(input.color),
    analysisMaxTriangles: clampInteger(input.analysisMaxTriangles, DEFAULT_ANALYSIS_MAX_TRIANGLES, 1000, 2_000_000),
  };
}

/** Lowercase suffixes without leading dots or duplicates. */
export function normalizeExtensions(value, fallback) {
  if (!Array.isArray(value)) return [...fallback];
  const cleaned = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const suffix = entry.trim().replace(/^\.+/, "").toLowerCase();
    if (suffix === "" || cleaned.includes(suffix)) continue;
    cleaned.push(suffix);
  }
  return cleaned.length > 0 ? cleaned : [...fallback];
}

/** Keep the route under /api; anything else would skip the authenticated fence. */
function normalizeRoutePath(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  const candidate = raw === "" ? DEFAULTS.routePath : raw;
  const withSlash = candidate.startsWith("/") ? candidate : `/${candidate}`;
  if (!withSlash.startsWith("/api/")) return DEFAULTS.routePath;
  return withSlash.replace(/\/+$/, "");
}

/** A #rrggbb colour, or the default. */
function normalizeColor(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : DEFAULT_COLOR;
}

/** An integer inside a closed range, or the fallback. */
function clampInteger(value, fallback, min, max) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.floor(number), min), max);
}

/** A finite number inside a closed range, or the fallback. */
function clampNumber(value, fallback, min, max) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}
