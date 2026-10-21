/**
 * Live parser self-test against a real STL file, using the exact bundle the
 * browser loads.
 *
 *   node scripts/live-selftest.mjs --file <abs .stl> [--scale 1]
 */
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

function argument(name, fallback) {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? fallback : process.argv[at + 1];
}

const file = argument("file");
if (file === undefined) {
  console.error("usage: node scripts/live-selftest.mjs --file <abs .stl> [--scale 1]");
  process.exit(2);
}
const scale = Number(argument("scale", "1"));

const source = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");
let registration;
const window = {
  __ModuleLoader__: { load: (value) => { registration = value; } },
  addEventListener: () => {},
  removeEventListener: () => {},
  devicePixelRatio: 1,
};
runInNewContext(source, { window, globalThis: window, console, TextDecoder, performance });
const client = registration.factory(() => ({}));

const buffer = await readFile(file);
const parsed = client.__parseStl(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
const analysis = client.__analyzeStl(parsed, { unitScale: scale, analysisMaxTriangles: 2_000_000 });

const failures = [];
const check = (label, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail === undefined ? "" : `  ${detail}`}`);
  if (!ok) failures.push(label);
};

check("mesh parsed", parsed.triangleCount > 0, `${parsed.triangleCount} triangles (${parsed.format})`);
check("all vertices finite", parsed.positions.every(Number.isFinite));
check("bounding box is non-zero", analysis.sizeMm.some((value) => value > 0), analysis.sizeMm.map((value) => value.toFixed(2)).join(" × ") + " mm");
check("volume is positive", analysis.volumeCm3 > 0, `${analysis.volumeCm3.toFixed(3)} cm³`);
check("surface area is positive", analysis.areaCm2 > 0, `${analysis.areaCm2.toFixed(3)} cm²`);
check("watertightness was analysed", analysis.watertight !== null, analysis.watertight ? "watertight" : `${analysis.boundaryEdges} boundary / ${analysis.nonManifoldEdges} non-manifold edges`);
console.log(`\nfile: ${file}\nformat: ${parsed.format}${parsed.header ? ` (${parsed.header})` : ""}\nvertices (welded): ${analysis.weldedVertices}`);
console.log(failures.length === 0 ? "\nALL PASS" : `\n${failures.length} FAILURE(S)`);
process.exitCode = failures.length === 0 ? 0 : 1;
