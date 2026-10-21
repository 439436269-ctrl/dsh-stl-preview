/**
 * The authenticated mesh route: `GET|HEAD <routePath>?path=<absolute>`.
 *
 * The route lives under `/api/`, so the composition's connection service has
 * already fenced and authenticated the request before this handler runs. Bytes
 * are read through `ctx.fs` one chunk at a time and forwarded as a stream, so a
 * 100 MB STL never has to be buffered whole on the host.
 *
 * @module dsh-stl-preview/route
 */
import { Readable } from "node:stream";

/** Headers shared by every answer; mesh bytes are user data, never cached. */
const BASE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

/**
 * Register the route for the plugin's lifetime.
 * @param ctx - host context carrying `fs` and `connection`.
 * @param config - resolved configuration.
 * @returns the disposer removing the route.
 */
export function registerStlRoute(ctx, config) {
  return ctx.connection.fetch.register({
    path: config.routePath,
    methods: ["GET", "HEAD"],
    requestBody: "buffered",
    fetch: (request) => serve(request, ctx.fs, config),
  });
}

/**
 * Answer one request.
 * @param request - fetch request built by the bridge.
 * @param fs - composed filesystem provider.
 * @param config - resolved configuration.
 * @returns the response, streaming the mesh on GET.
 */
async function serve(request, fs, config) {
  if (!config.enabled) return fail(503, "STL preview is disabled.");
  const method = request.method === "HEAD" ? "HEAD" : "GET";
  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  if (path === null || path === "") return fail(400, "Missing `path`.");
  if (path.includes("\0") || !isAbsolutePath(path)) return fail(400, "An absolute path is required.");
  const suffix = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  if (!config.extensions.includes(suffix)) return fail(400, `Only ${config.extensions.map((item) => `.${item}`).join(", ")} files are previewed.`);

  const signal = request.signal;
  try {
    const target = await fs.resolve(path, { signal });
    const info = await fs.stat(target, signal);
    if (info === undefined) return fail(404, "not found");
    if (info.type !== "file") return fail(403, "not a regular file");
    const size = typeof info.size === "number" ? info.size : 0;
    if (size === 0) return fail(416, "empty file");
    if (size > config.maxBytes) return fail(413, `file exceeds the ${config.maxBytes}-byte limit`);

    const headers = {
      ...BASE_HEADERS,
      "Content-Type": "model/stl",
      "Content-Length": String(size),
    };
    if (method === "HEAD") return new Response(null, { status: 200, headers });
    return new Response(streamMesh(fs, target, size, config.chunkBytes, signal), { status: 200, headers });
  } catch (error) {
    return fail(statusOf(error), codeOf(error));
  }
}

/**
 * Yield the file in fixed-size windows.
 * @param fs - composed filesystem provider.
 * @param target - resolved file target.
 * @param size - total byte count.
 * @param chunkBytes - largest single read.
 * @param signal - aborts on a closed connection.
 * @returns the byte stream handed to the response.
 */
function streamMesh(fs, target, size, chunkBytes, signal) {
  const source = (async function* readChunks() {
    for (let offset = 0; offset < size; offset += chunkBytes) {
      if (signal.aborted) return;
      const length = Math.min(chunkBytes, size - offset);
      const bytes = await fs.readByteRange(target, { offset, length }, signal);
      if (signal.aborted) return;
      if (bytes.byteLength > 0) yield bytes;
    }
  })();
  return Readable.toWeb(Readable.from(source));
}

/** One small text answer with the shared headers. */
function fail(status, message) {
  return new Response(message, {
    status,
    headers: { ...BASE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

/** Absolute in either spelling the Host accepts. */
function isAbsolutePath(path) {
  return path.startsWith("/") || /^[A-Za-z]:[/\\]/.test(path) || path.startsWith("\\\\");
}

/** HTTP status for a typed filesystem failure. */
function statusOf(error) {
  switch (codeOf(error)) {
    case "FS_NOT_FOUND":
      return 404;
    case "FS_NOT_REGULAR_FILE":
    case "FS_PERMISSION_DENIED":
    case "FS_SANDBOX_DENIED":
      return 403;
    case "FS_TOO_LARGE":
      return 413;
    case "FS_ABORTED":
      return 499;
    default:
      return 500;
  }
}

/** The typed filesystem error code, when this is one. */
function codeOf(error) {
  if (error !== null && typeof error === "object" && typeof error.code === "string") return error.code;
  return "FS_UNKNOWN";
}
