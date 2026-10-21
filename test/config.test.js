import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULTS, resolveConfig } from "../lib/config.js";

test("defaults keep the route under /api and the suffix list normalized", () => {
  const config = resolveConfig(undefined);
  assert.equal(config.enabled, true);
  assert.equal(config.routePath, "/api/stl-preview");
  assert.deepEqual(config.extensions, ["stl"]);
  assert.equal(config.unitScale, 1);
  assert.equal(config.color, "#c7d2e2");
  assert.equal(config.analysisMaxTriangles, DEFAULTS.analysisMaxTriangles);
});

test("a route outside /api falls back to the fenced default", () => {
  assert.equal(resolveConfig({ routePath: "/stl" }).routePath, "/api/stl-preview");
  assert.equal(resolveConfig({ routePath: "/api/custom/" }).routePath, "/api/custom");
});

test("suffixes, colours and numbers are normalized", () => {
  assert.deepEqual(resolveConfig({ extensions: [".STL", " stl ", "stl1"] }).extensions, ["stl", "stl1"]);
  assert.deepEqual(resolveConfig({ extensions: [] }).extensions, ["stl"]);
  assert.equal(resolveConfig({ color: "#ABCDEF" }).color, "#abcdef");
  assert.equal(resolveConfig({ color: "red" }).color, "#c7d2e2");
  assert.equal(resolveConfig({ unitScale: 25.4 }).unitScale, 25.4);
  assert.equal(resolveConfig({ unitScale: 0 }).unitScale, 0.000001);
  assert.equal(resolveConfig({ chunkBytes: 1 }).chunkBytes, 65536);
  assert.equal(resolveConfig({ analysisMaxTriangles: 1 }).analysisMaxTriangles, 1000);
  assert.equal(resolveConfig({ maxBytes: Number.NaN }).maxBytes, DEFAULTS.maxBytes);
});
