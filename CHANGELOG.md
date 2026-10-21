# Changelog

## 0.1.0 — 2026-10-21

First release.

- Register a document-preview renderer for `.stl` files in the DSH right Sidebar: binary and ASCII meshes open in an interactive 3D viewport instead of the binary-file empty state.
- Host half: authenticated `GET|HEAD /api/stl-preview` route that streams the file through `ctx.fs` chunk by chunk (no whole-file buffering in the host).
- Browser half: dependency-free WebGL renderer plus a mesh analyser — welded vertex count, millimetre bounding box, signed volume, surface area, watertightness (boundary / non-manifold edges, degenerate facets), and a configurable unit scale.
- STL is Z-up; geometry is rotated into the Y-up viewport so trays and plates lie flat.
- Configuration: `enabled`, `routePath`, `extensions`, `maxBytes`, `chunkBytes`, `unitScale`, `color`, `analysisMaxTriangles`.
- Verified on DSH Desktop 0.2.1-rc.2 with a real 4,546-triangle binary STL: 19 unit/adapter tests, live parse (98.531 cm³, 561.476 cm², watertight, 2,275 welded vertices), headless browser e2e ready state with 22% non-background canvas pixels.
