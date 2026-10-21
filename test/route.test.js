import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { resolveConfig } from "../lib/config.js";
import { registerStlRoute } from "../lib/route.js";

/** A route mounted on a stub connection service plus a fake filesystem. */
async function fixture(overrides = {}, bytes = Buffer.from("solid-sample")) {
  const dir = await mkdtemp(join(tmpdir(), "stl-route-"));
  const file = join(dir, "part.stl");
  await writeFile(file, bytes);
  const calls = [];
  const state = { route: undefined };
  const config = resolveConfig({ chunkBytes: 65536, ...overrides });
  const fs = {
    resolve: async (path) => {
      calls.push(["resolve", path]);
      return { key: path };
    },
    stat: async () => ({ type: "file", size: bytes.length }),
    readByteRange: async (_target, { offset, length }) => {
      calls.push(["read", offset, length]);
      return new Uint8Array(bytes.subarray(offset, offset + length));
    },
  };
  const ctx = { fs, connection: { fetch: { register: (value) => { state.route = value; return () => calls.push("disposed"); } } } };
  registerStlRoute(ctx, config);
  const url = (query) => {
    const target = new URL(`http://x${config.routePath}`);
    for (const [key, value] of Object.entries(query)) target.searchParams.set(key, value);
    return target;
  };
  return {
    dir,
    file,
    bytes,
    config,
    calls,
    register(nextConfig) {
      registerStlRoute(ctx, nextConfig);
    },
    request: (query) => state.route.fetch(new Request(url(query))),
    head: (query) => state.route.fetch(new Request(url(query), { method: "HEAD" })),
  };
}

test("GET streams the whole mesh with its exact length", async () => {
  const fx = await fixture();
  try {
    const response = await fx.request({ path: fx.file });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "model/stl");
    assert.equal(response.headers.get("content-length"), String(fx.bytes.length));
    assert.equal(Buffer.from(await response.arrayBuffer()).toString("utf8"), "solid-sample");
  } finally {
    await rm(fx.dir, { recursive: true, force: true });
  }
});

test("a mesh larger than one chunk is read in sequence", async () => {
  const bytes = Buffer.alloc(150_000, 7);
  const fx = await fixture({ chunkBytes: 65536 }, bytes);
  try {
    const response = await fx.request({ path: fx.file });
    const body = Buffer.from(await response.arrayBuffer());
    assert.equal(body.length, bytes.length);
    assert.ok(body.equals(bytes));
    const reads = fx.calls.filter((call) => Array.isArray(call) && call[0] === "read");
    assert.equal(reads.length, 3);
    assert.deepEqual(reads.map((read) => read[2]), [65536, 65536, 18928]);
  } finally {
    await rm(fx.dir, { recursive: true, force: true });
  }
});

test("HEAD answers headers without opening the stream", async () => {
  const fx = await fixture();
  try {
    const head = await fx.head({ path: fx.file });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    assert.equal(fx.calls.filter((call) => Array.isArray(call) && call[0] === "read").length, 0);
  } finally {
    await rm(fx.dir, { recursive: true, force: true });
  }
});

test("parameters are validated before the filesystem is touched", async () => {
  const fx = await fixture();
  try {
    assert.equal((await fx.request({})).status, 400);
    assert.equal((await fx.request({ path: "relative.stl" })).status, 400);
    assert.equal((await fx.request({ path: fx.file.replace(/\.stl$/, ".obj") })).status, 400);
    assert.equal(fx.calls.length, 0);
  } finally {
    await rm(fx.dir, { recursive: true, force: true });
  }
});

test("a file above maxBytes is refused with 413", async () => {
  const fx = await fixture({ maxBytes: 4 }, Buffer.from("too-large"));
  try {
    const response = await fx.request({ path: fx.file });
    assert.equal(response.status, 413);
    assert.match(await response.text(), /byte limit/);
  } finally {
    await rm(fx.dir, { recursive: true, force: true });
  }
});

test("filesystem failures map to HTTP statuses", async () => {
  const fx = await fixture();
  try {
    for (const [code, status] of [
      ["FS_NOT_FOUND", 404],
      ["FS_PERMISSION_DENIED", 403],
      ["FS_SANDBOX_DENIED", 403],
      ["FS_ABORTED", 499],
    ]) {
      let route;
      const ctx = {
        fs: {
          resolve: async () => {
            throw Object.assign(new Error(code), { code });
          },
        },
        connection: {
          fetch: {
            register: (entry) => {
              route = entry;
            },
          },
        },
      };
      registerStlRoute(ctx, fx.config);
      const response = await route.fetch(new Request(`http://x${fx.config.routePath}?path=${encodeURIComponent(fx.file)}`));
      assert.equal(response.status, status, code);
    }
  } finally {
    await rm(fx.dir, { recursive: true, force: true });
  }
});
