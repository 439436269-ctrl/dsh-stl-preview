# Verification record — dsh-stl-preview 0.1.0

Date: 2026-10-21. Machine: Windows 11, DeepSeek Harness Desktop **0.2.1-rc.2**,
Node 24.22.0. Scene under test: a real binary STL print part at
`<workspace>/plate-rack-base/out/stl/plate_rack_base_half_mirror.stl`
(227,384 bytes, 4,546 triangles, 2,275 welded vertices, 161 × 129 × 16 mm).

## L1 — unit / adapter tests

```
node --test test/*.test.js
# tests 19  pass 19  fail 0
```

| file | what it proves |
|---|---|
| `test/config.test.js` | defaults; route forced under `/api/`; suffix/colour/unit normalisation; numeric clamps |
| `test/route.test.js` | GET streams the whole mesh with exact length; a 150 KB file is read as 65,536 + 65,536 + 18,928 bytes; HEAD opens no stream; `path`/suffix validation before the filesystem; 413 above `maxBytes`; `FS_NOT_FOUND` / `FS_PERMISSION_DENIED` / `FS_SANDBOX_DENIED` / `FS_ABORTED` → 404/403/403/499 |
| `test/client.test.js` | the bundle evaluates in a browser-shaped sandbox, registers `dsh-stl-preview`, exports `apply`/`inject`/`__createViewer`/`__parseStl`/`__analyzeStl`/`__hexToLinear`; binary cube → 12 triangles, 1 mm³, 6 mm², watertight, 8 welded vertices; ASCII tetrahedron → 4 triangles and unitScale 10 scales volume by 1000; a dropped facet reports boundary edges; the analysis ceiling skips watertightness; hex → linear colour |
| `test/adapter.test.js` | the Host entry imports with a stub schemastery; `apply()` registers `GET|HEAD /api/stl-preview` and publishes `__DSH_STL_PREVIEW_CONFIG__` (route, extensions, unitScale, colour, analysis cap); `enabled: false` mounts nothing; the manifest ships `lib/**/*.js` and the client export |

## L2 — live parse with the shipped bundle (`scripts/live-selftest.mjs`)

```
PASS  mesh parsed  4546 triangles (binary)
PASS  all vertices finite
PASS  bounding box is non-zero  161.00 × 129.00 × 16.00 mm
PASS  volume is positive  98.531 cm³
PASS  surface area is positive  561.476 cm²
PASS  watertightness was analysed  watertight
vertices (welded): 2275
ALL PASS
```

The values were cross-checked against an independent Python `struct` parse of
the same file: volume 98.531 cm³, area 561.476 cm², 2,275 welded vertices,
every edge used exactly twice.

## L3 — HTTP route on a real DSH host

Temporary profile `stlverify` (web template + the packed tarball),
`dsh --profile stlverify --no-open --port 0`, authenticated with the printed
`?token=` cookie:

```
index: 200 len=35316  config injected=True  boot has plugin=True
GET:  200 bytes=227384 type=model/stl in 0.09s
HEAD: 200 len=227384 body=0
```

## L4 — headless browser end-to-end (`scripts/e2e-browser.mjs`)

Flow: open the app with the token, start a conversation, open the right
Sidebar, Workspace files, walk `codes → plate-rack-base → out → stl`, open the
STL, wait for the preview, sample canvas pixels, toggle wireframe and the info
panel.

```
tree segment plate-rack-base: opened
tree segment out: opened
tree segment stl: opened
{
  "state": "ready",
  "triangles": "4546",
  "watertight": "true",
  "canvasSize": { "width": 719, "height": 647 },
  "pixels": { "lit": 14681, "total": 66457, "ratio": 0.2209 },
  "panelLen": 132,
  "panelHasSize": true,
  "panelHasVolume": true,
  "panelHasWatertight": true,
  "panelHidden": "false",
  "failure": "",
  "errors": []
}
```

The canvas is 719 × 647 device pixels, 22.1% of the sampled pixels are brighter
than the background, the panel shows `161.0 × 129.0 × 16.0 mm`,
`98.53 cm³` and `水密: 是`, there are no console errors, and the wireframe
toggle changes the frame (screenshot).

Screenshots: `scripts/shots/03-preview.png` (solid), `04-wireframe.png`
(wireframe), and the user-facing copy `docs/stl-preview.png`.

## Pitfalls found

| Symptom | Root cause | Fix |
|---|---|---|
| The tray stood on its edge | STL is Z-up (Blender/CAD/slicers); the viewport inherited the GLB convention Y-up | rotate geometry `(x, y, z) → (x, z, −y)` before upload; statistics stay in the file's own axes so X × Y × Z keeps its CAD meaning |
| The first render showed a large dark panel | the same Z-up issue viewed from the side, not a lighting bug | after the rotation the tray lies flat and the key light reads correctly |
| Cross-realm `deepStrictEqual` failures in `node:vm` tests | arrays created inside the browser sandbox have a different prototype | compare `Array.from(...)` / map into the host realm |
| The route answered 500 for every normal request in tests | the route reads `ctx.fs` at request time but the fixture only had a local `fs` variable | put `fs` on the context (`ctx = { fs, connection }`) |
