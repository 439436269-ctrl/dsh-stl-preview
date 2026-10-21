import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

/** A React stand-in: apply() registers components without rendering them. */
function reactStub() {
  return {
    createElement: () => null,
    Fragment: "fragment",
    useRef: (value) => ({ current: value }),
    useState: (value) => [value, () => {}],
    useEffect: () => {},
    useCallback: (callback) => callback,
  };
}

/**
 * Evaluate the client bundle and materialize its exports.
 * @param globals - extra globals (the injected route config).
 * @returns the module exports and the recorded registration.
 */
async function mountClient(globals = {}) {
  const source = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");
  let registration;
  const window = {
    __ModuleLoader__: { load: (value) => { registration = value; } },
    addEventListener: () => {},
    removeEventListener: () => {},
    devicePixelRatio: 1,
    ...globals,
  };
  runInNewContext(source, { window, globalThis: window, console, TextDecoder, performance });
  assert.ok(registration !== undefined);
  return { registration, exports: registration.factory((name) => (name === "react" ? reactStub() : {})) };
}

/** One binary STL cube with 12 triangles, 1 unit per side, centred at the origin. */
function binaryCube() {
  const faces = [
    [[0, 0, 0], [0, 1, 0], [1, 1, 0]], [[0, 0, 0], [1, 1, 0], [1, 0, 0]],
    [[0, 0, 1], [1, 1, 1], [0, 1, 1]], [[0, 0, 1], [1, 0, 1], [1, 1, 1]],
    [[0, 0, 0], [1, 0, 0], [1, 0, 1]], [[0, 0, 0], [1, 0, 1], [0, 0, 1]],
    [[0, 1, 0], [0, 1, 1], [1, 1, 1]], [[0, 1, 0], [1, 1, 1], [1, 1, 0]],
    [[0, 0, 0], [0, 0, 1], [0, 1, 1]], [[0, 0, 0], [0, 1, 1], [0, 1, 0]],
    [[1, 0, 0], [1, 1, 0], [1, 1, 1]], [[1, 0, 0], [1, 1, 1], [1, 0, 1]],
  ];
  const buffer = Buffer.alloc(84 + faces.length * 50);
  buffer.write("binary cube", 0, "ascii");
  buffer.writeUInt32LE(faces.length, 80);
  faces.forEach((triangle, index) => {
    const at = 84 + index * 50;
    for (let vertex = 0; vertex < 3; vertex += 1) {
      for (let axis = 0; axis < 3; axis += 1) {
        buffer.writeFloatLE(triangle[vertex][axis], at + 12 + vertex * 12 + axis * 4);
      }
    }
  });
  return buffer;
}

/** One ASCII tetrahedron with 4 faces, 1 unit per edge. */
const ASCII_TETRA = `solid tetra
facet normal 0 0 -1
 outer loop
  vertex 0 0 0
  vertex 0 1 0
  vertex 1 0 0
 endloop
endfacet
facet normal 0 -1 0
 outer loop
  vertex 0 0 0
  vertex 1 0 0
  vertex 0 0 1
 endloop
endfacet
facet normal -1 0 0
 outer loop
  vertex 0 0 0
  vertex 0 0 1
  vertex 0 1 0
 endloop
endfacet
facet normal 1 1 1
 outer loop
  vertex 0 1 0
  vertex 0 0 1
  vertex 1 0 0
 endloop
endfacet
endsolid tetra`;

test("the bundle registers the STL renderer and its body slot", async () => {
  const { registration, exports } = await mountClient({
    __DSH_STL_PREVIEW_CONFIG__: {
      routePath: "/api/custom-stl",
      extensions: ["stl"],
      unitScale: 10,
      color: "#123456",
      analysisMaxTriangles: 1000,
    },
  });
  assert.equal(registration.id, "dsh-stl-preview");
  const renderers = [];
  const slots = [];
  const dictionaries = [];
  const t = (key) => key;
  const ctx = {
    locale: { bind: () => t, register: (namespace, dictionary) => dictionaries.push(dictionary) },
    documentPreviews: { register: (definition) => renderers.push(definition) },
    slots: {
      inject: (name, factory) => factory(),
      register: (spec, body) => slots.push({ spec, body }),
    },
    effect: (factory) => factory(),
  };
  exports.apply(ctx);
  assert.equal(renderers[0].id, "dsh-stl-preview/mesh");
  assert.deepEqual(Array.from(renderers[0].extensions), ["stl"]);
  assert.deepEqual(Array.from(renderers[0].binaryExtensions), ["stl"]);
  assert.equal(renderers[0].loading, "renderer");
  assert.equal(slots[0].spec.key, "dsh-stl-preview/mesh");
  const injected = slots[0].spec.inject();
  assert.equal(injected.routePath, "/api/custom-stl");
  assert.equal(injected.unitScale, 10);
  assert.equal(injected.color, "#123456");
  assert.equal(dictionaries.length, 1);
});

test("binary STL parses and measures a unit cube", async () => {
  const { exports } = await mountClient();
  const cube = binaryCube();
  const parsed = exports.__parseStl(cube.buffer.slice(cube.byteOffset, cube.byteOffset + cube.byteLength));
  assert.equal(parsed.format, "binary");
  assert.equal(parsed.triangleCount, 12);
  assert.equal(parsed.positions.length, 108);
  assert.equal(parsed.normals.length, 108);
  const analysis = exports.__analyzeStl(parsed, { unitScale: 1, analysisMaxTriangles: 100000 });
  assert.deepEqual(Array.from(analysis.sizeMm, (value) => Math.round(value)), [1, 1, 1]);
  assert.ok(Math.abs(analysis.volumeCm3 - 0.001) < 1e-9, `volume ${analysis.volumeCm3}`);
  assert.ok(Math.abs(analysis.areaCm2 - 0.06) < 1e-9, `area ${analysis.areaCm2}`);
  assert.equal(analysis.watertight, true);
  assert.equal(analysis.boundaryEdges, 0);
  assert.equal(analysis.nonManifoldEdges, 0);
  assert.equal(analysis.weldedVertices, 8);
});

test("ASCII STL parses and unit scaling changes the reported size", async () => {
  const { exports } = await mountClient();
  const bytes = new TextEncoder().encode(ASCII_TETRA);
  const parsed = exports.__parseStl(bytes.buffer);
  assert.equal(parsed.format, "ascii");
  assert.equal(parsed.triangleCount, 4);
  const mm = exports.__analyzeStl(parsed, { unitScale: 1, analysisMaxTriangles: 100000 });
  const cm = exports.__analyzeStl(parsed, { unitScale: 10, analysisMaxTriangles: 100000 });
  assert.deepEqual(Array.from(mm.sizeMm, (value) => Math.round(value)), [1, 1, 1]);
  assert.deepEqual(Array.from(cm.sizeMm, (value) => Math.round(value)), [10, 10, 10]);
  assert.ok(Math.abs(cm.volumeCm3 / mm.volumeCm3 - 1000) < 1e-6);
  assert.equal(mm.watertight, true);
});

test("a hole breaks watertightness and is reported", async () => {
  const { exports } = await mountClient();
  const buffer = binaryCube();
  // Drop the first triangle: one face now has a missing edge.
  buffer.writeUInt32LE(11, 80);
  const parsed = exports.__parseStl(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  const analysis = exports.__analyzeStl(parsed, { unitScale: 1, analysisMaxTriangles: 100000 });
  assert.equal(analysis.watertight, false);
  assert.ok(analysis.boundaryEdges > 0);
});

test("the analysis can be skipped for huge meshes", async () => {
  const { exports } = await mountClient();
  const parsed = exports.__parseStl(binaryCube().buffer.slice(binaryCube().byteOffset, binaryCube().byteOffset + binaryCube().byteLength));
  const analysis = exports.__analyzeStl(parsed, { unitScale: 1, analysisMaxTriangles: 4 });
  assert.equal(analysis.analysisSkipped, true);
  assert.equal(analysis.watertight, null);
});

test("hex colours become linear RGB", async () => {
  const { exports } = await mountClient();
  assert.deepEqual(Array.from(exports.__hexToLinear("#ffffff")), [1, 1, 1, 1]);
  const black = exports.__hexToLinear("#000000");
  assert.deepEqual(Array.from(black), [0, 0, 0, 1]);
  const mid = exports.__hexToLinear("#808080");
  assert.ok(mid[0] > 0.2 && mid[0] < 0.3, String(mid[0]));
});
