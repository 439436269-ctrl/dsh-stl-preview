/**
 * Client bundle source for dsh-stl-preview.
 *
 * scripts/build-client.mjs replaces the viewer marker below with the renderer
 * from dev/viewer.js and writes lib/client.js. Edit this file for the UI and
 * dev/viewer.js for the renderer, then run `node scripts/build-client.mjs`.
 */
window.__ModuleLoader__.load({
  id: "dsh-stl-preview",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");

    /* @viewer */

    /** This package's copy namespace. */
    const NS = "stlPreview";
    /** Renderer identity: the registry definition id and the body slot key. */
    const BODY_ID = "dsh-stl-preview/mesh";
    /** Route that streams the bytes; the Host half owns the same default. */
    const DEFAULT_ROUTE_PATH = "/api/stl-preview";
    /** Suffixes mirrored from the Host defaults. */
    const DEFAULT_EXTENSIONS = ["stl"];
    /** Viewport colour when the Host injects none. */
    const DEFAULT_COLOR = "#c7d2e2";
    /** Above this triangle count the watertightness pass is skipped. */
    const DEFAULT_ANALYSIS_MAX_TRIANGLES = 400_000;

    const zh = {
      stl: "STL 网格",
      loading: "正在读取 STL…",
      loadingHint: "二进制/ASCII 都在浏览器里解析，文件不会上传。",
      parsing: "正在解析网格…",
      analyzing: "正在计算体积与水密性…",
      failed: "无法预览这个网格",
      retry: "重试",
      reset: "重置视角",
      wireframe: "线框",
      spin: "自动旋转",
      info: "网格信息",
      hint: "拖动旋转 · 滚轮缩放 · 双击复位",
      size: "外形尺寸",
      triangles: "三角面",
      vertices: "顶点",
      volume: "体积",
      area: "表面积",
      watertight: "水密",
      format: "格式",
      file: "文件",
      unit: "单位",
      yes: "是",
      no: "否",
      boundary: "边界边",
      nonManifold: "非流形边",
      degenerate: "退化面",
      skipped: "未分析（超过 {limit} 三角面）",
      binary: "二进制",
      ascii: "ASCII",
      empty: "这个文件里没有三角形。",
      invalid: "无法解析这个 STL 文件（二进制和 ASCII 都不是有效网格）。",
      readFailed: "无法读取这个文件。",
      header: "头信息",
      unitNote: "STL 不带单位 · 按 1 单位 = {scale} mm 解释",
      cm3: "cm³",
      cm2: "cm²",
      debug: "解析详情",
    };

    const en = {
      stl: "STL mesh",
      loading: "Reading the STL…",
      loadingHint: "Binary and ASCII are parsed in the browser; the file is never uploaded.",
      parsing: "Parsing the mesh…",
      analyzing: "Measuring volume and watertightness…",
      failed: "This mesh could not be previewed",
      retry: "Retry",
      reset: "Reset view",
      wireframe: "Wireframe",
      spin: "Auto-rotate",
      info: "Mesh info",
      hint: "Drag to orbit · Wheel to zoom · Double-click to reset",
      size: "Size",
      triangles: "Triangles",
      vertices: "Vertices",
      volume: "Volume",
      area: "Surface area",
      watertight: "Watertight",
      format: "Format",
      file: "File",
      unit: "Units",
      yes: "yes",
      no: "no",
      boundary: "Boundary edges",
      nonManifold: "Non-manifold edges",
      degenerate: "Degenerate facets",
      skipped: "not analysed (over {limit} triangles)",
      binary: "binary",
      ascii: "ASCII",
      empty: "This file contains no triangles.",
      invalid: "This STL file is neither a valid binary nor a valid ASCII mesh.",
      readFailed: "This file could not be read.",
      header: "Header",
      unitNote: "STL is unitless · read as 1 unit = {scale} mm",
      cm3: "cm³",
      cm2: "cm²",
      debug: "Parse details",
    };

    /** Scoped styles; every selector starts at the root attribute. */
    const STYLE = [
      '[data-stl-preview]{display:flex;flex-direction:column;flex:auto;height:100%;min-height:0;box-sizing:border-box;color:var(--dsw-alias-label-primary,#1f2329);font-size:12px}',
      '[data-stl-preview] .dsh-sp-toolbar{display:flex;align-items:center;gap:6px;flex:none;padding:7px 10px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1))}',
      '[data-stl-preview] .dsh-sp-name{font-weight:600;font-size:12px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '[data-stl-preview] .dsh-sp-actions{display:flex;gap:4px;margin-left:auto;flex:none}',
      '[data-stl-preview] .dsh-sp-button{appearance:none;border:0;border-radius:7px;padding:5px 8px;font:inherit;font-size:11px;line-height:1.2;cursor:pointer;color:var(--dsw-alias-label-primary,#1f2329);background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));white-space:nowrap}',
      '[data-stl-preview] .dsh-sp-button:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.12))}',
      '[data-stl-preview] .dsh-sp-button[data-active="true"]{background:var(--dsw-alias-interactive-bg-selected,rgba(64,128,255,.18));color:var(--dsw-alias-label-accent,#2c6ef2)}',
      '[data-stl-preview] .dsh-sp-viewport{position:relative;flex:1 1 auto;min-height:240px;min-width:0;overflow:hidden;background:radial-gradient(120% 100% at 50% 0%,#2a3446 0%,#141a24 55%,#0b0f16 100%)}',
      '[data-stl-preview] .dsh-sp-canvas{position:absolute;inset:0;display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline:none}',
      '[data-stl-preview] .dsh-sp-canvas:active{cursor:grabbing}',
      '[data-stl-preview] .dsh-sp-badge{position:absolute;left:10px;top:10px;display:flex;gap:6px;align-items:center;padding:4px 8px;border-radius:999px;background:rgba(9,13,20,.55);color:#dfe8f6;font-size:11px;pointer-events:none;backdrop-filter:blur(6px)}',
      '[data-stl-preview] .dsh-sp-dot{width:6px;height:6px;border-radius:50%;background:#5ee0a0}',
      '[data-stl-preview] .dsh-sp-dot[data-ok="false"]{background:#f0b45a}',
      '[data-stl-preview] .dsh-sp-hint{position:absolute;left:10px;bottom:8px;color:rgba(223,232,246,.55);font-size:10.5px;pointer-events:none;user-select:none}',
      '[data-stl-preview] .dsh-sp-overlay{position:absolute;inset:0;display:grid;place-items:center;padding:20px;background:rgba(8,11,17,.72);backdrop-filter:blur(3px)}',
      '[data-stl-preview] .dsh-sp-card{width:min(420px,100%);color:#e8edf5;text-align:center;display:flex;flex-direction:column;gap:10px;align-items:center}',
      '[data-stl-preview] .dsh-sp-card[data-tone="error"]{text-align:left;align-items:stretch}',
      '[data-stl-preview] .dsh-sp-title{margin:0;font-size:13px;font-weight:600}',
      '[data-stl-preview] .dsh-sp-text{margin:0;font-size:11.5px;line-height:1.55;color:rgba(232,237,245,.72)}',
      '[data-stl-preview] .dsh-sp-code{margin:0;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10.5px;color:#ffb4b4}',
      '[data-stl-preview] .dsh-sp-spinner{width:22px;height:22px;border-radius:50%;border:2px solid rgba(255,255,255,.2);border-top-color:#7fa8ff;animation:dsh-sp-spin .8s linear infinite}',
      '@keyframes dsh-sp-spin{to{transform:rotate(360deg)}}',
      '[data-stl-preview] .dsh-sp-panel{flex:none;max-height:42%;overflow:auto;padding:10px 12px;border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.02))}',
      '[data-stl-preview] .dsh-sp-panel[data-open="false"]{display:none}',
      '[data-stl-preview] .dsh-sp-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 14px;margin-bottom:8px}',
      '[data-stl-preview] .dsh-sp-kv{display:flex;justify-content:space-between;gap:8px;min-width:0}',
      '[data-stl-preview] .dsh-sp-kv span:first-child{opacity:.6}',
      '[data-stl-preview] .dsh-sp-kv span:last-child{font-variant-numeric:tabular-nums;text-align:right;overflow-wrap:anywhere}',
      '[data-stl-preview] .dsh-sp-chip{display:inline-flex;align-items:center;gap:5px;padding:2px 7px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));font-size:10.5px}',
      '[data-stl-preview] .dsh-sp-chip[data-ok="false"]{color:#b57618}',
      '[data-stl-preview] .dsh-sp-footer{margin-top:8px;font-size:10.5px;opacity:.55;display:flex;flex-wrap:wrap;gap:4px 10px}',
      '[data-stl-preview] .dsh-sp-details{margin-top:4px;font-size:10.5px;color:rgba(232,237,245,.7)}',
      '[data-stl-preview] .dsh-sp-details pre{max-height:180px;overflow:auto;white-space:pre-wrap;word-break:break-word;background:rgba(0,0,0,.25);padding:8px;border-radius:8px;margin:6px 0 0;font-size:10.5px}',
    ].join("\n");

    /** Install the scoped stylesheet once per document. */
    function installStyle() {
      if (typeof document === "undefined") return;
      const tagId = "dsh-stl-preview/client.css";
      if (document.querySelector('style[data-plugin-css="' + tagId + '"]') !== null) return;
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-stl-preview";
      tag.dataset.pluginCss = tagId;
      tag.textContent = STYLE;
      document.head.appendChild(tag);
    }

    /** Fill `{key}` placeholders. */
    function fill(template, values) {
      return String(template).replace(/\{(\w+)\}/g, (whole, key) =>
        Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : whole
      );
    }

    /** A final path segment. */
    function basenameOf(path) {
      if (typeof path !== "string") return "";
      const normalized = path.replaceAll("\\", "/");
      return normalized.slice(normalized.lastIndexOf("/") + 1);
    }

    /** Human byte size, or the empty string when unknown. */
    function formatBytes(bytes) {
      if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return "";
      const units = ["B", "KB", "MB", "GB", "TB"];
      let value = bytes;
      let unit = 0;
      while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
      }
      const rounded = unit === 0 ? String(Math.round(value)) : value.toFixed(value >= 100 ? 0 : 1);
      return rounded + " " + units[unit];
    }

    /** Thousands separators without depending on the UI locale. */
    function formatCount(value) {
      if (typeof value !== "number" || !Number.isFinite(value)) return "0";
      return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    /** A fixed-decimal number with grouping. */
    function formatDecimal(value, digits) {
      if (typeof value !== "number" || !Number.isFinite(value)) return "—";
      const fixed = value.toFixed(digits);
      const [whole, fraction] = fixed.split(".");
      const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return fraction === undefined ? grouped : grouped + "." + fraction;
    }

    /** One dimension triple in millimetres. */
    function formatSize(values) {
      if (!Array.isArray(values) || values.length < 3) return "—";
      return values.slice(0, 3).map((value) => formatDecimal(value, 1)).join(" × ") + " mm";
    }

    /** sRGB hex to the linear colour the shader expects. */
    function hexToLinear(hex) {
      const raw = typeof hex === "string" && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : DEFAULT_COLOR;
      const number = Number.parseInt(raw.slice(1), 16);
      const channels = [(number >> 16) & 255, (number >> 8) & 255, number & 255].map((value) => {
        const srgb = value / 255;
        return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
      });
      return [channels[0], channels[1], channels[2], 1];
    }

    /**
     * STL is Z-up (Blender/CAD/slicers); the viewport is Y-up. Rotate -90°
     * about X so a tray lies flat instead of standing on its edge.
     * @param source - interleaved xyz triples.
     * @returns a new array with (x, y, z) -> (x, z, -y).
     */
    function toYUp(source) {
      const out = new Float32Array(source.length);
      for (let index = 0; index < source.length; index += 3) {
        out[index] = source[index];
        out[index + 1] = source[index + 2];
        out[index + 2] = -source[index + 1];
      }
      return out;
    }

    /** The route the Host half actually registered, as injected at boot. */
    function configuredConfig() {
      const config = globalThis.__DSH_STL_PREVIEW_CONFIG__;
      const valid = typeof config === "object" && config !== null;
      return {
        routePath: valid && typeof config.routePath === "string" && config.routePath !== "" ? config.routePath : DEFAULT_ROUTE_PATH,
        extensions:
          valid && Array.isArray(config.extensions) && config.extensions.length > 0
            ? config.extensions.filter((entry) => typeof entry === "string" && entry !== "")
            : DEFAULT_EXTENSIONS,
        unitScale: valid && typeof config.unitScale === "number" && config.unitScale > 0 ? config.unitScale : 1,
        color: valid && typeof config.color === "string" ? config.color : DEFAULT_COLOR,
        analysisMaxTriangles:
          valid && typeof config.analysisMaxTriangles === "number" && config.analysisMaxTriangles > 0
            ? config.analysisMaxTriangles
            : DEFAULT_ANALYSIS_MAX_TRIANGLES,
      };
    }

    /** The route URL for one file version. */
    function assetUrl(routePath, absolutePath, version) {
      return routePath + "?path=" + encodeURIComponent(absolutePath) + "&v=" + encodeURIComponent(version);
    }

    /**
     * Parse binary or ASCII STL into non-indexed triangle soup.
     * @param buffer - the file bytes.
     * @returns {format, header, positions, normals, triangleCount}
     */
    function parseStl(buffer) {
      const bytes = new Uint8Array(buffer);
      if (bytes.byteLength === 0) throw Object.assign(new Error("empty file"), { code: "STL_EMPTY" });
      if (bytes.byteLength >= 84) {
        const view = new DataView(buffer);
        const count = view.getUint32(80, true);
        if (count > 0 && 84 + count * 50 <= bytes.byteLength && count <= 50_000_000) {
          return parseBinaryStl(view, count, bytes);
        }
      }
      return parseAsciiStl(new TextDecoder().decode(bytes));
    }

    /** Binary STL: 80-byte header, uint32 count, 50 bytes per facet. */
    function parseBinaryStl(view, count, bytes) {
      const positions = new Float32Array(count * 9);
      const normals = new Float32Array(count * 9);
      let at = 84;
      for (let triangle = 0; triangle < count; triangle += 1) {
        const nx = view.getFloat32(at, true);
        const ny = view.getFloat32(at + 4, true);
        const nz = view.getFloat32(at + 8, true);
        const base = triangle * 9;
        for (let vertex = 0; vertex < 3; vertex += 1) {
          const offset = at + 12 + vertex * 12;
          const x = view.getFloat32(offset, true);
          const y = view.getFloat32(offset + 4, true);
          const z = view.getFloat32(offset + 8, true);
          positions[base + vertex * 3] = x;
          positions[base + vertex * 3 + 1] = y;
          positions[base + vertex * 3 + 2] = z;
        }
        let fx = nx;
        let fy = ny;
        let fz = nz;
        if (fx === 0 && fy === 0 && fz === 0) {
          fx = (positions[base + 4] - positions[base + 1]) * (positions[base + 8] - positions[base + 2]) - (positions[base + 5] - positions[base + 2]) * (positions[base + 7] - positions[base + 1]);
          fy = (positions[base + 5] - positions[base + 2]) * (positions[base + 6] - positions[base]) - (positions[base + 3] - positions[base]) * (positions[base + 8] - positions[base + 2]);
          fz = (positions[base + 3] - positions[base]) * (positions[base + 7] - positions[base + 1]) - (positions[base + 4] - positions[base + 1]) * (positions[base + 6] - positions[base]);
        }
        const length = Math.hypot(fx, fy, fz) || 1;
        for (let vertex = 0; vertex < 3; vertex += 1) {
          normals[base + vertex * 3] = fx / length;
          normals[base + vertex * 3 + 1] = fy / length;
          normals[base + vertex * 3 + 2] = fz / length;
        }
        at += 50;
      }
      const header = new TextDecoder().decode(bytes.subarray(0, Math.min(80, bytes.byteLength))).replace(/\0+$/, "").trim();
      return { format: "binary", header, positions, normals, triangleCount: count };
    }

    /** ASCII STL: facet normal / outer loop / three vertices per facet. */
    function parseAsciiStl(text) {
      if (!/facet\s+normal/i.test(text)) throw Object.assign(new Error("no facets"), { code: "STL_INVALID" });
      const positions = [];
      const normals = [];
      let normal = [0, 0, 0];
      let vertices = [];
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed.startsWith("facet normal") || trimmed.startsWith("FACET NORMAL")) {
          const parts = trimmed.split(/\s+/);
          normal = [Number(parts[2]), Number(parts[3]), Number(parts[4])].map((value) => (Number.isFinite(value) ? value : 0));
        } else if (trimmed.startsWith("vertex") || trimmed.startsWith("VERTEX")) {
          const parts = trimmed.split(/\s+/);
          const point = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
          if (point.every((value) => Number.isFinite(value))) vertices.push(point);
          if (vertices.length === 3) {
            let [fx, fy, fz] = normal;
            if (fx === 0 && fy === 0 && fz === 0) {
              const [a, b, c] = vertices;
              fx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
              fy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
              fz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
            }
            const length = Math.hypot(fx, fy, fz) || 1;
            for (const point of vertices) {
              positions.push(point[0], point[1], point[2]);
              normals.push(fx / length, fy / length, fz / length);
            }
            vertices = [];
          }
        }
      }
      const triangleCount = positions.length / 9;
      if (triangleCount === 0) throw Object.assign(new Error("no triangles"), { code: "STL_EMPTY" });
      return {
        format: "ascii",
        header: "",
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        triangleCount,
      };
    }

    /**
     * Geometry and print statistics for one parsed mesh.
     * @param parsed - result of parseStl.
     * @param options - unit scale and the analysis triangle ceiling.
     * @returns size, volume, area and watertightness facts.
     */
    function analyzeStl(parsed, options) {
      const positions = parsed.positions;
      const count = parsed.triangleCount;
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      let areaRaw = 0;
      let volumeRaw = 0;
      for (let triangle = 0; triangle < count; triangle += 1) {
        const base = triangle * 9;
        const ax = positions[base], ay = positions[base + 1], az = positions[base + 2];
        const bx = positions[base + 3], by = positions[base + 4], bz = positions[base + 5];
        const cx = positions[base + 6], cy = positions[base + 7], cz = positions[base + 8];
        for (const [x, y, z] of [[ax, ay, az], [bx, by, bz], [cx, cy, cz]]) {
          if (x < min[0]) min[0] = x;
          if (y < min[1]) min[1] = y;
          if (z < min[2]) min[2] = z;
          if (x > max[0]) max[0] = x;
          if (y > max[1]) max[1] = y;
          if (z > max[2]) max[2] = z;
        }
        const ux = bx - ax, uy = by - ay, uz = bz - az;
        const vx = cx - ax, vy = cy - ay, vz = cz - az;
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        areaRaw += 0.5 * Math.hypot(nx, ny, nz);
        volumeRaw += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
      }
      const scale = options.unitScale;
      const sizeMm = [0, 1, 2].map((axis) => (max[axis] - min[axis]) * scale);
      const result = {
        format: parsed.format,
        header: parsed.header,
        triangles: count,
        sizeMm,
        volumeCm3: (Math.abs(volumeRaw) * scale ** 3) / 1000,
        areaCm2: (areaRaw * scale ** 2) / 100,
        watertight: null,
        weldedVertices: count * 3,
        boundaryEdges: 0,
        nonManifoldEdges: 0,
        degenerateTriangles: 0,
        analysisSkipped: count > options.analysisMaxTriangles,
      };
      if (!result.analysisSkipped) {
        const diagonal = Math.max(Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]), 1e-9);
        const epsilon = Math.max(diagonal * 1e-5, 1e-6);
        const welded = new Map();
        const edges = new Map();
        let weldedVertices = 0;
        let degenerate = 0;
        const index = (x, y, z) => {
          const key = `${Math.round(x / epsilon)}:${Math.round(y / epsilon)}:${Math.round(z / epsilon)}`;
          let value = welded.get(key);
          if (value === undefined) {
            value = weldedVertices;
            weldedVertices += 1;
            welded.set(key, value);
          }
          return value;
        };
        for (let triangle = 0; triangle < count; triangle += 1) {
          const base = triangle * 9;
          const a = index(positions[base], positions[base + 1], positions[base + 2]);
          const b = index(positions[base + 3], positions[base + 4], positions[base + 5]);
          const c = index(positions[base + 6], positions[base + 7], positions[base + 8]);
          if (a === b || b === c || c === a) {
            degenerate += 1;
            continue;
          }
          for (const [from, to] of [[a, b], [b, c], [c, a]]) {
            const key = from < to ? `${from}:${to}` : `${to}:${from}`;
            edges.set(key, (edges.get(key) ?? 0) + 1);
          }
        }
        let boundary = 0;
        let nonManifold = 0;
        for (const uses of edges.values()) {
          if (uses === 1) boundary += 1;
          else if (uses > 2) nonManifold += 1;
        }
        result.weldedVertices = weldedVertices;
        result.boundaryEdges = boundary;
        result.nonManifoldEdges = nonManifold;
        result.degenerateTriangles = degenerate;
        result.watertight = boundary === 0 && nonManifold === 0 && degenerate === 0;
      }
      return result;
    }

    /**
     * The preview body: fetch bytes, parse, measure, draw.
     * @param props - document body props plus the injected route and copy.
     * @returns the preview, or its loading/error state.
     */
    function StlBody(props) {
      const { content, resourceAddress, useResource, t, routePath, unitScale, color, analysisMaxTriangles } = props;
      const meta = useResource(resourceAddress);
      const absolutePath = meta.value && meta.value.absolutePath ? meta.value.absolutePath : undefined;
      const version = meta.value && meta.value.version ? meta.value.version : "0";
      const revision = content !== undefined && content.kind === "renderer" ? content.revision : 0;
      const tRef = React.useRef(t);
      tRef.current = t;

      const viewerRef = React.useRef(null);
      const viewerErrorRef = React.useRef("");
      const [viewerError, setViewerError] = React.useState("");
      const [state, setState] = React.useState("loading");
      const [stats, setStats] = React.useState(null);
      const [failure, setFailure] = React.useState(null);
      const [attempt, setAttempt] = React.useState(0);
      const [panelOpen, setPanelOpen] = React.useState(true);
      const [wireframe, setWireframe] = React.useState(false);
      const [autoRotate, setAutoRotate] = React.useState(false);
      const reported = React.useRef(-1);

      const settle = React.useCallback(
        (ok, fileVersion) => {
          if (reported.current === revision) return;
          reported.current = revision;
          if (content === undefined || content.kind !== "renderer") return;
          if (ok) content.loaded(fileVersion);
          else content.failed();
        },
        [content, revision]
      );
      const settleRef = React.useRef(settle);
      settleRef.current = settle;

      const attachCanvas = React.useCallback((node) => {
        if (node === null) {
          viewerRef.current?.dispose();
          viewerRef.current = null;
          return;
        }
        if (viewerRef.current !== null) return;
        try {
          viewerRef.current = createViewer(node, {});
          viewerErrorRef.current = "";
          setViewerError("");
        } catch (error) {
          const message = String(error && error.message ? error.message : error);
          viewerErrorRef.current = message;
          setViewerError(message);
          console.error("[stl-preview] viewer init failed:", error);
        }
      }, []);

      React.useEffect(() => {
        viewerRef.current?.setWireframe(wireframe);
      }, [wireframe]);

      React.useEffect(() => {
        viewerRef.current?.setAutoRotate(autoRotate);
      }, [autoRotate]);

      React.useEffect(() => {
        if (absolutePath === undefined) return undefined;
        const controller = new AbortController();
        setState("loading");
        setFailure(null);
        setStats(null);

        (async () => {
          const response = await fetch(assetUrl(routePath, absolutePath, version), {
            signal: controller.signal,
            credentials: "same-origin",
          });
          if (!response.ok) {
            const detail = await response.text().catch(() => "");
            throw { message: detail || tRef.current("readFailed"), code: "HTTP_" + String(response.status) };
          }
          const bytes = await response.arrayBuffer();
          if (controller.signal.aborted) return;
          setState("parsing");
          await new Promise((resolve) => setTimeout(resolve, 30));
          const parsed = parseStl(bytes);
          if (controller.signal.aborted) return;
          setState("analyzing");
          await new Promise((resolve) => setTimeout(resolve, 20));
          const analysis = analyzeStl(parsed, { unitScale, analysisMaxTriangles });
          if (controller.signal.aborted) return;
          const viewer = viewerRef.current;
          if (viewer === null) {
            throw {
              message: tRef.current("invalid") + (viewerErrorRef.current === "" ? "" : " " + viewerErrorRef.current),
              code: "WEBGL_MISSING",
            };
          }
          const modelStats = viewer.setGeometry({
            positions: toYUp(parsed.positions),
            normals: toYUp(parsed.normals),
            color: hexToLinear(color),
          });
          setStats({ ...analysis, ...modelStats, sizeMm: analysis.sizeMm, bytes: bytes.byteLength });
          setState("ready");
          settleRef.current(true, version);
        })().catch((error) => {
          if (controller.signal.aborted) return;
          setFailure({
            code: typeof error?.code === "string" ? error.code : "UNKNOWN",
            message: error instanceof Error ? error.message : String(error?.message ?? error),
          });
          setState("failed");
          settleRef.current(false, version);
        });

        return () => {
          controller.abort();
        };
      }, [absolutePath, version, attempt, routePath, unitScale, color, analysisMaxTriangles]);

      if (absolutePath === undefined) {
        const failed = meta.status === "failed";
        return React.createElement(
          "div",
          { "data-stl-preview": true, "data-stl-state": failed ? "failed" : "loading" },
          React.createElement(
            "div",
            { className: "dsh-sp-viewport" },
            React.createElement(
              "div",
              { className: "dsh-sp-overlay" },
              failed
                ? React.createElement(
                    "div",
                    { className: "dsh-sp-card", "data-tone": "error" },
                    React.createElement("p", { className: "dsh-sp-title" }, t("failed")),
                    React.createElement("p", { className: "dsh-sp-text" }, t("readFailed")),
                    React.createElement(
                      "button",
                      { type: "button", className: "dsh-sp-button", onClick: () => setAttempt((value) => value + 1) },
                      t("retry")
                    )
                  )
                : React.createElement(
                    "div",
                    { className: "dsh-sp-card" },
                    React.createElement("div", { className: "dsh-sp-spinner" }),
                    React.createElement("p", { className: "dsh-sp-text" }, t("loading"))
                  )
            )
          )
        );
      }

      const name = basenameOf(absolutePath);
      const triangles = stats !== null ? stats.triangles : 0;
      const loading = state === "loading" || state === "parsing" || state === "analyzing";
      const statusText = state === "parsing" ? t("parsing") : state === "analyzing" ? t("analyzing") : t("loading");

      const toolbar = React.createElement(
        "div",
        { className: "dsh-sp-toolbar" },
        React.createElement("div", { className: "dsh-sp-name", title: absolutePath }, name),
        React.createElement(
          "div",
          { className: "dsh-sp-actions" },
          React.createElement(
            "button",
            {
              type: "button",
              className: "dsh-sp-button",
              title: t("reset") + " (Home)",
              "data-stl-action": "reset",
              onClick: () => viewerRef.current?.resetView(),
            },
            t("reset")
          ),
          React.createElement(
            "button",
            {
              type: "button",
              className: "dsh-sp-button",
              title: t("wireframe"),
              "data-stl-action": "wireframe",
              "data-active": wireframe ? "true" : "false",
              "aria-pressed": wireframe ? "true" : "false",
              onClick: () => setWireframe((value) => !value),
            },
            t("wireframe")
          ),
          React.createElement(
            "button",
            {
              type: "button",
              className: "dsh-sp-button",
              title: t("spin"),
              "data-stl-action": "spin",
              "data-active": autoRotate ? "true" : "false",
              "aria-pressed": autoRotate ? "true" : "false",
              onClick: () => setAutoRotate((value) => !value),
            },
            t("spin")
          ),
          React.createElement(
            "button",
            {
              type: "button",
              className: "dsh-sp-button",
              title: t("info"),
              "data-stl-action": "info",
              "data-active": panelOpen ? "true" : "false",
              "aria-pressed": panelOpen ? "true" : "false",
              onClick: () => setPanelOpen((value) => !value),
            },
            t("info")
          )
        )
      );

      const overlay = loading
        ? React.createElement(
            "div",
            { className: "dsh-sp-overlay" },
            React.createElement(
              "div",
              { className: "dsh-sp-card" },
              React.createElement("div", { className: "dsh-sp-spinner" }),
              React.createElement("p", { className: "dsh-sp-title" }, statusText),
              React.createElement("p", { className: "dsh-sp-text" }, t("loadingHint"))
            )
          )
        : state === "failed"
          ? React.createElement(
              "div",
              { className: "dsh-sp-overlay" },
              React.createElement(
                "div",
                { className: "dsh-sp-card", "data-tone": "error" },
                React.createElement("p", { className: "dsh-sp-title" }, t("failed")),
                React.createElement("p", { className: "dsh-sp-code", "data-stl-error-code": true }, failure?.code ?? ""),
                React.createElement("p", { className: "dsh-sp-text", "data-stl-error-message": true }, failure?.message ?? ""),
                React.createElement(
                  "button",
                  {
                    type: "button",
                    className: "dsh-sp-button",
                    "data-stl-action": "retry",
                    onClick: () => setAttempt((value) => value + 1),
                  },
                  t("retry")
                )
              )
            )
          : null;

      const viewport = React.createElement(
        "div",
        { className: "dsh-sp-viewport" },
        React.createElement("canvas", {
          ref: attachCanvas,
          className: "dsh-sp-canvas",
          "data-stl-canvas": true,
          tabIndex: 0,
          "aria-label": name,
        }),
        state === "ready"
          ? React.createElement(
              "div",
              { className: "dsh-sp-badge", "data-stl-badge": true },
              React.createElement("span", {
                className: "dsh-sp-dot",
                "data-ok": stats && stats.watertight === true ? "true" : "false",
              }),
              formatCount(triangles) + " " + t("triangles")
            )
          : null,
        state === "ready" ? React.createElement("div", { className: "dsh-sp-hint" }, t("hint")) : null,
        overlay,
        viewerError !== "" && state !== "failed"
          ? React.createElement(
              "div",
              { className: "dsh-sp-overlay" },
              React.createElement(
                "div",
                { className: "dsh-sp-card", "data-tone": "error" },
                React.createElement("p", { className: "dsh-sp-title" }, t("failed")),
                React.createElement("p", { className: "dsh-sp-text" }, t("invalid")),
                React.createElement("p", { className: "dsh-sp-code" }, viewerError)
              )
            )
          : null
      );

      const rows = [];
      if (stats !== null) {
        rows.push([
          t("format"),
          (stats.format === "binary" ? t("binary") : t("ascii")) + (stats.header ? ` · ${stats.header}` : ""),
        ]);
        rows.push([t("size"), formatSize(stats.sizeMm)]);
        rows.push([t("triangles"), formatCount(stats.triangles)]);
        rows.push([t("vertices"), formatCount(stats.weldedVertices)]);
        rows.push([t("volume"), `${formatDecimal(stats.volumeCm3, 2)} ${t("cm3")}`]);
        rows.push([t("area"), `${formatDecimal(stats.areaCm2, 2)} ${t("cm2")}`]);
        rows.push([
          t("watertight"),
          stats.watertight === null
            ? fill(t("skipped"), { limit: formatCount(analysisMaxTriangles) })
            : stats.watertight
              ? t("yes")
              : `${t("no")} · ${t("boundary")} ${formatCount(stats.boundaryEdges)} · ${t("nonManifold")} ${formatCount(stats.nonManifoldEdges)}`,
        ]);
        if (stats.degenerateTriangles > 0) rows.push([t("degenerate"), formatCount(stats.degenerateTriangles)]);
      }

      const panel = React.createElement(
        "div",
        { className: "dsh-sp-panel", "data-stl-panel": true, "data-open": panelOpen ? "true" : "false" },
        stats === null
          ? React.createElement("p", { className: "dsh-sp-text" }, t("loading"))
          : React.createElement(
              React.Fragment,
              null,
              React.createElement(
                "div",
                { className: "dsh-sp-summary" },
                rows.map(([label, value]) =>
                  React.createElement(
                    "div",
                    { className: "dsh-sp-kv", key: label },
                    React.createElement("span", null, label),
                    React.createElement("span", { title: value }, value)
                  )
                )
              ),
              React.createElement(
                "div",
                { className: "dsh-sp-footer" },
                React.createElement(
                  "span",
                  { className: "dsh-sp-chip", "data-ok": stats.watertight === true ? "true" : "false" },
                  `${t("watertight")}: ${stats.watertight === null ? "?" : stats.watertight ? t("yes") : t("no")}`
                ),
                React.createElement("span", null, fill(t("unitNote"), { scale: String(unitScale) })),
                React.createElement("span", null, `${t("file")}: ${formatBytes(stats.bytes)}`)
              )
            )
      );

      return React.createElement(
        "div",
        {
          "data-stl-preview": true,
          "data-stl-state": state,
          "data-stl-triangles": String(triangles),
          "data-stl-watertight": stats === null ? "" : stats.watertight === null ? "unknown" : stats.watertight ? "true" : "false",
        },
        toolbar,
        viewport,
        panel
      );
    }

    const inject = ["slots", "locale", "resources", "documentPreviews"];

    /**
     * Register the STL renderer and its body for the plugin's lifetime.
     * @param ctx - client root context.
     */
    function apply(ctx) {
      installStyle();
      const t = ctx.locale.bind(NS);
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "stl-preview: dictionaries");
      const config = configuredConfig();
      const bodyInject = () => ({
        routePath: config.routePath,
        unitScale: config.unitScale,
        color: config.color,
        analysisMaxTriangles: config.analysisMaxTriangles,
        t,
      });
      ctx.effect(
        () =>
          ctx.documentPreviews.register({
            id: BODY_ID,
            extensions: config.extensions,
            binaryExtensions: config.extensions,
            priority: "extension",
            title: () => t("stl"),
            loading: "renderer",
            wrap: false,
          }),
        "stl-preview: metadata"
      );
      ctx.effect(
        () =>
          ctx.slots.inject("sidebar.right.tab.document", () =>
            ctx.slots.register(
              {
                name: "sidebar.right.tab.document",
                key: BODY_ID,
                locale: NS,
                inject: bodyInject,
              },
              StlBody
            )
          ),
        "stl-preview: body"
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.__createViewer = createViewer;
    exports.__parseStl = parseStl;
    exports.__analyzeStl = analyzeStl;
    exports.__hexToLinear = hexToLinear;
    return module.exports;
  },
});
