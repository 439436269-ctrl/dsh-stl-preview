/**
 * The schemastery schema alone, separated from the defaulting helpers so
 * `lib/config.js` stays importable in a plain `node --test` run (schemastery is
 * supplied by the DSH host at runtime, not by this package).
 *
 * @module dsh-stl-preview/schema
 */
import z from "@deepseek-ai/schemastery";

/** Schema the loader validates and the settings page renders. */
export const Config = z.object({
  enabled: z.boolean().default(true).description("Register the STL preview renderer and its byte route at all."),
  routePath: z.string().default("/api/stl-preview").description(
    "Absolute pathname of the authenticated mesh route; it must stay under /api so the connection fence authenticates it."
  ),
  extensions: z.array(z.string()).default(["stl"]).description("File suffixes that open in the 3D preview (no leading dot)."),
  maxBytes: z.number().step(1).min(1).max(8 * 1024 * 1024 * 1024).default(512 * 1024 * 1024).description(
    "Largest STL the route will stream, in bytes."
  ),
  chunkBytes: z.number().step(1).min(65536).max(16 * 1024 * 1024).default(1024 * 1024).description(
    "Bytes per ranged read; each response body is a sequence of these."
  ),
  unitScale: z.number().min(0.000001).max(1000).default(1).description(
    "Millimetres per STL unit. STL is unitless; 1 treats the numbers as millimetres, 10 as centimetres, 25.4 as inches."
  ),
  color: z.string().default("#c7d2e2").description("Viewport colour (sRGB #rrggbb); STL carries no materials."),
  analysisMaxTriangles: z.number().step(1).min(1000).max(2000000).default(400000).description(
    "Skip the watertightness pass above this triangle count instead of freezing the tab."
  ),
}).description("STL preview: one authenticated byte route plus the right-Sidebar mesh viewer and print statistics.");
