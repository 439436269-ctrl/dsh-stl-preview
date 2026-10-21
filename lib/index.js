/**
 * dsh-stl-preview — open an STL mesh in the DSH right-Sidebar document preview
 * instead of the built-in "binary file, no preview" empty state.
 *
 * Two halves, one package:
 * - this file is the Host half: it registers an authenticated
 *   `GET|HEAD /api/stl-preview` route that streams the file through `ctx.fs`.
 * - `./client` is the browser half: it registers a document-preview renderer
 *   for `.stl` suffixes, parses binary/ASCII STL, and draws the mesh in a small
 *   WebGL viewport with size, volume, surface-area and watertightness facts.
 *
 * @module dsh-stl-preview
 */
import { resolveConfig } from "./config.js";
import { Config } from "./schema.js";
import { registerStlRoute } from "./route.js";

/** Plugin name, also the settings-page namespace through the bundle patch. */
export const name = "stl-preview";

/** Host services the route needs: the filesystem and the authenticated fence. */
export const inject = ["fs", "connection"];

export { Config };

/**
 * Mount the byte route and expose its path to the browser half.
 * @param ctx - host context carrying `fs` and `connection`.
 * @param config - loader-supplied configuration.
 */
export function apply(ctx, config) {
  const settings = resolveConfig(config);
  if (!settings.enabled) return;

  ctx.effect(() => registerStlRoute(ctx, settings), "stl-preview: mesh route");

  // The client reads its route and display settings from the served page, so a
  // configured path and the client's URL can never drift apart.
  ctx.on("webserver/index-inject", (table) => {
    table.push({
      kind: "global",
      name: "__DSH_STL_PREVIEW_CONFIG__",
      value: {
        routePath: settings.routePath,
        extensions: settings.extensions,
        unitScale: settings.unitScale,
        color: settings.color,
        analysisMaxTriangles: settings.analysisMaxTriangles,
      },
    });
  });
}
