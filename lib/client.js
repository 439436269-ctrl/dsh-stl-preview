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

      var DEFAULTS = {
    backgroundTop: [0.16, 0.2, 0.27],
    backgroundBottom: [0.04, 0.055, 0.08],
    fieldOfView: (38 * Math.PI) / 180,
    minDistanceFactor: 0.12,
    maxDistanceFactor: 24,
  };

  function createViewer(canvas, options) {
    var settings = Object.assign({}, DEFAULTS, options || {});
    var gl =
      canvas.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true }) ||
      canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (gl === null) throw new Error("WebGL is not available in this browser.");

    var modelProgram = buildProgram(gl, MODEL_VERTEX, MODEL_FRAGMENT);
    var lineProgram = buildProgram(gl, LINE_VERTEX, LINE_FRAGMENT);
    var shadowProgram = buildProgram(gl, SHADOW_VERTEX, SHADOW_FRAGMENT);
    var shadowUniforms = uniformsOf(gl, shadowProgram, ["uViewProj", "uCenter", "uExtent", "uOpacity"]);
    var shadowQuad = createShadowQuad();
    var modelUniforms = uniformsOf(gl, modelProgram, [
      "uViewProj",
      "uView",
      "uViewRot",
      "uCamera",
      "uBaseColor",
      "uRoughness",
      "uMetallic",
      "uWireframe",
      "uExposure",
    ]);
    var lineUniforms = uniformsOf(gl, lineProgram, ["uViewProj", "uOpacity"]);

    var primitives = [];
    var bbox = null;
    var grid = null;
    var axes = createAxes();
    var modelLocations = {
      position: gl.getAttribLocation(modelProgram, "aPosition"),
      normal: gl.getAttribLocation(modelProgram, "aNormal"),
    };
    var lineLocations = {
      position: gl.getAttribLocation(lineProgram, "aPosition"),
      color: gl.getAttribLocation(lineProgram, "aColor"),
    };

    var state = {
      yaw: 0.72,
      pitch: 0.62,
      distance: 1,
      target: [0, 0, 0],
      radius: 1,
      wireframe: false,
      autoRotate: false,
      exposure: 1,
    };
    var camera = { eye: [0, 0, 1], up: [0, 1, 0] };
    var view = new Float32Array(16);
    var projection = new Float32Array(16);
    var viewProjection = new Float32Array(16);
    var viewRotation = new Float32Array(9);

    var dirty = true;
    var frame = 0;
    var lastTime = 0;
    var disposed = false;

    function render(time) {
      if (disposed) return;
      if (dirty || state.autoRotate) draw(time);
      dirty = false;
      frame = requestAnimationFrame(render);
    }

    function draw(time) {
      var now = typeof time === "number" ? time : performance.now();
      var dt = lastTime === 0 ? 0 : Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      if (state.autoRotate) {
        state.yaw += dt * 0.55;
        dirty = true;
      }

      var width = canvas.width;
      var height = canvas.height;
      if (width === 0 || height === 0) return;
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.disable(gl.CULL_FACE);

      var cosPitch = Math.cos(state.pitch);
      camera.eye = [
        state.target[0] + state.distance * cosPitch * Math.sin(state.yaw),
        state.target[1] + state.distance * Math.sin(state.pitch),
        state.target[2] + state.distance * cosPitch * Math.cos(state.yaw),
      ];
      var near = Math.max(state.distance - state.radius * 4, state.radius * 0.001);
      var far = state.distance + state.radius * 8;
      mat4Perspective(projection, settings.fieldOfView, width / height, near, far);
      mat4LookAt(view, camera.eye, state.target, camera.up);
      mat4Multiply(viewProjection, projection, view);
      rotationOf(view, viewRotation);

      drawShadow();

      gl.disable(gl.BLEND);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1, 1);

      gl.useProgram(modelProgram);
      gl.uniformMatrix4fv(modelUniforms.uViewProj, false, viewProjection);
      gl.uniformMatrix4fv(modelUniforms.uView, false, view);
      gl.uniformMatrix3fv(modelUniforms.uViewRot, false, viewRotation);
      gl.uniform3fv(modelUniforms.uCamera, camera.eye);
      gl.uniform1f(modelUniforms.uExposure, state.exposure);

      for (var index = 0; index < primitives.length; index += 1) {
        var primitive = primitives[index];
        if (!state.wireframe) {
          bindPrimitive(primitive);
          gl.uniform1f(modelUniforms.uWireframe, 0);
          gl.uniform4fv(modelUniforms.uBaseColor, primitive.color);
          gl.uniform1f(modelUniforms.uRoughness, primitive.roughness);
          gl.uniform1f(modelUniforms.uMetallic, primitive.metallic);
          gl.drawElements(gl.TRIANGLES, primitive.count, primitive.indexType, 0);
        } else {
          // Edges only: a solid pass plus ~68k edge overlays turns into mush at
          // preview size, so wireframe replaces the surface instead.
          gl.disable(gl.POLYGON_OFFSET_FILL);
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          bindLineIndices(primitive);
          gl.uniform1f(modelUniforms.uWireframe, 1);
          gl.uniform4fv(modelUniforms.uBaseColor, primitive.color);
          gl.drawElements(gl.LINES, primitive.lineCount, primitive.indexType, 0);
          gl.disable(gl.BLEND);
          gl.enable(gl.POLYGON_OFFSET_FILL);
        }
      }
      gl.disable(gl.POLYGON_OFFSET_FILL);

      if (grid !== null) drawGrid();
      drawAxes();
    }

    function drawGrid() {
      gl.useProgram(lineProgram);
      gl.uniformMatrix4fv(lineUniforms.uViewProj, false, viewProjection);
      gl.uniform1f(lineUniforms.uOpacity, 0.2);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      bindLines(grid);
      gl.drawArrays(gl.LINES, 0, grid.count);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    function drawAxes() {
      var size = Math.max(56, Math.min(84, Math.round(canvas.height * 0.12)));
      var margin = 10;
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(margin, margin, size, size);
      gl.viewport(margin, margin, size, size);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);
      var ortho = new Float32Array(16);
      mat4Orthographic(ortho, -1.35, 1.35, -1.35, 1.35, -4, 4);
      var combined = new Float32Array(16);
      var rotationOnly = new Float32Array(16);
      for (var i = 0; i < 12; i += 1) rotationOnly[i] = view[i];
      rotationOnly[15] = 1;
      mat4Multiply(combined, ortho, rotationOnly);
      gl.useProgram(lineProgram);
      gl.uniformMatrix4fv(lineUniforms.uViewProj, false, combined);
      gl.uniform1f(lineUniforms.uOpacity, 1);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      bindLines(axes);
      gl.drawArrays(gl.LINES, 0, axes.count);
      gl.disable(gl.BLEND);
      gl.disable(gl.SCISSOR_TEST);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.enable(gl.DEPTH_TEST);
    }

    function bindPrimitive(primitive) {
      gl.bindBuffer(gl.ARRAY_BUFFER, primitive.positions);
      gl.enableVertexAttribArray(modelLocations.position);
      gl.vertexAttribPointer(modelLocations.position, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, primitive.normals);
      gl.enableVertexAttribArray(modelLocations.normal);
      gl.vertexAttribPointer(modelLocations.normal, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, primitive.indices);
    }

    function bindLineIndices(primitive) {
      gl.bindBuffer(gl.ARRAY_BUFFER, primitive.positions);
      gl.enableVertexAttribArray(modelLocations.position);
      gl.vertexAttribPointer(modelLocations.position, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, primitive.normals);
      gl.enableVertexAttribArray(modelLocations.normal);
      gl.vertexAttribPointer(modelLocations.normal, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, primitive.lineIndices);
    }

    function bindLines(buffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer.positions);
      gl.enableVertexAttribArray(lineLocations.position);
      gl.vertexAttribPointer(lineLocations.position, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer.colors);
      gl.enableVertexAttribArray(lineLocations.color);
      gl.vertexAttribPointer(lineLocations.color, 4, gl.FLOAT, false, 0, 0);
    }

    function uploadLines(positions, colors) {
      return {
        positions: uploadArray(gl, new Float32Array(positions)),
        colors: uploadArray(gl, new Float32Array(colors)),
        count: positions.length / 3,
      };
    }

    function createAxes() {
      var positions = [];
      var colors = [];
      pushLine(positions, colors, 0, 0, 0, 1, 0, 0, [0.95, 0.35, 0.35, 1]);
      pushLine(positions, colors, 0, 0, 0, 0, 1, 0, [0.45, 0.85, 0.45, 1]);
      pushLine(positions, colors, 0, 0, 0, 0, 0, 1, [0.45, 0.62, 0.98, 1]);
      return uploadLines(positions, colors);
    }

    function createShadowQuad() {
      var buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
      return { buffer: buffer, count: 6 };
    }

    function drawShadow() {
      if (bbox === null) return;
      gl.useProgram(shadowProgram);
      gl.uniformMatrix4fv(shadowUniforms.uViewProj, false, viewProjection);
      gl.uniform3f(
        shadowUniforms.uCenter,
        (bbox.min[0] + bbox.max[0]) / 2,
        bbox.min[1] + state.radius * 0.002,
        (bbox.min[2] + bbox.max[2]) / 2
      );
      gl.uniform2f(
        shadowUniforms.uExtent,
        Math.max((bbox.max[0] - bbox.min[0]) * 0.62, state.radius * 0.2),
        Math.max((bbox.max[2] - bbox.min[2]) * 0.62, state.radius * 0.2)
      );
      gl.uniform1f(shadowUniforms.uOpacity, 0.55);
      gl.bindBuffer(gl.ARRAY_BUFFER, shadowQuad.buffer);
      var location = gl.getAttribLocation(shadowProgram, "aUv");
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, shadowQuad.count);
      gl.disable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST);
    }

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      var width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      var height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        dirty = true;
      }
    }

    function fit() {
      if (bbox === null) return;
      var size = [bbox.max[0] - bbox.min[0], bbox.max[1] - bbox.min[1], bbox.max[2] - bbox.min[2]];
      state.target = [(bbox.min[0] + bbox.max[0]) / 2, (bbox.min[1] + bbox.max[1]) / 2, (bbox.min[2] + bbox.max[2]) / 2];
      state.radius = Math.max(Math.hypot(size[0], size[1], size[2]) / 2, 1e-6);
      // Fit the bounding sphere against the narrower of the vertical and
      // horizontal fields of view, so a wide part fits a tall pane too.
      var aspect = Math.max(canvas.width / Math.max(canvas.height, 1), 0.2);
      var horizontal = 2 * Math.atan(Math.tan(settings.fieldOfView / 2) * aspect);
      var narrowest = Math.min(settings.fieldOfView, horizontal);
      state.distance = (state.radius / Math.sin(narrowest / 2)) * 1.08;
      state.yaw = 0.72;
      state.pitch = 0.58;
      buildGrid();
      dirty = true;
    }

    function buildGrid() {
      if (bbox === null) return;
      var span = Math.max(bbox.max[0] - bbox.min[0], bbox.max[2] - bbox.min[2]);
      var step = niceStep(span / 8);
      var extent = Math.ceil((span * 0.9) / step) * step;
      if (extent <= 0) return;
      var center = [(bbox.min[0] + bbox.max[0]) / 2, (bbox.min[2] + bbox.max[2]) / 2];
      var level = bbox.min[1] - state.radius * 0.004;
      var positions = [];
      var colors = [];
      var count = Math.round(extent / step);
      for (var i = -count; i <= count; i += 1) {
        var offset = i * step;
        var major = Math.abs(offset) < step * 0.01;
        var alpha = major ? 0.42 : 0.16;
        pushLine(positions, colors, center[0] + offset, level, center[1] - extent, center[0] + offset, level, center[1] + extent, [0.62, 0.72, 0.86, alpha]);
        pushLine(positions, colors, center[0] - extent, level, center[1] + offset, center[0] + extent, level, center[1] + offset, [0.62, 0.72, 0.86, alpha]);
      }
      if (grid !== null) destroyBufferSet(grid);
      grid = uploadLines(positions, colors);
    }

    function setGeometry(geometry) {
      var positions = geometry.positions;
      var normals = geometry.normals;
      var count = positions.length / 3;
      var indices = geometry.indices;
      if (indices === undefined) {
        indices = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
        for (var i = 0; i < count; i += 1) indices[i] = i;
      }
      var triangleCount = Math.floor(indices.length / 3);
      var lineIndices = buildLineIndices(indices, triangleCount);
      var box = geometry.bounds;
      if (box === undefined) {
        box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
        for (var p = 0; p < count; p += 1) {
          for (var c = 0; c < 3; c += 1) {
            var value = positions[p * 3 + c];
            if (value < box.min[c]) box.min[c] = value;
            if (value > box.max[c]) box.max[c] = value;
          }
        }
      }
      for (var k = 0; k < primitives.length; k += 1) destroyPrimitive(primitives[k]);
      primitives = [{
        positions: uploadArray(gl, positions),
        normals: uploadArray(gl, normals),
        indices: uploadElement(gl, indices),
        lineIndices: uploadElement(gl, lineIndices),
        count: indices.length,
        lineCount: lineIndices.length,
        indexType: indices instanceof Uint32Array ? gl.UNSIGNED_INT : indices instanceof Uint8Array ? gl.UNSIGNED_BYTE : gl.UNSIGNED_SHORT,
        color: geometry.color || [0.62, 0.68, 0.76, 1],
        roughness: 0.55,
        metallic: 0,
        doubleSided: true,
      }];
      bbox = box;
      fit();
      return { triangles: triangleCount, vertices: count, bounds: bbox };
    }

    function destroyPrimitive(primitive) {
      gl.deleteBuffer(primitive.positions);
      gl.deleteBuffer(primitive.normals);
      gl.deleteBuffer(primitive.indices);
      gl.deleteBuffer(primitive.lineIndices);
    }

    function destroyBufferSet(buffer) {
      gl.deleteBuffer(buffer.positions);
      gl.deleteBuffer(buffer.colors);
    }

    // ---------------------------------------------------------------- events
    var pointer = null;
    function onPointerDown(event) {
      if (event.button !== 0 && event.button !== 2 && event.button !== 1) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, button: event.button, moved: false };
      canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    }
    function onPointerMove(event) {
      if (pointer === null || pointer.id !== event.pointerId) return;
      var dx = event.clientX - pointer.x;
      var dy = event.clientY - pointer.y;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.moved = pointer.moved || Math.abs(dx) + Math.abs(dy) > 1;
      if (pointer.button === 0) {
        state.yaw -= dx * 0.0075;
        state.pitch = clamp(state.pitch + dy * 0.0065, -1.45, 1.45);
      } else {
        pan(dx, dy);
      }
      dirty = true;
    }
    function onPointerUp(event) {
      if (pointer !== null && pointer.id === event.pointerId) {
        canvas.releasePointerCapture?.(event.pointerId);
        pointer = null;
      }
    }
    function onWheel(event) {
      var scale = Math.exp(clamp(event.deltaY, -240, 240) * 0.0014);
      state.distance = clamp(state.distance * scale, state.radius * settings.minDistanceFactor, state.radius * settings.maxDistanceFactor);
      dirty = true;
      event.preventDefault();
    }
    function onDoubleClick() {
      fit();
    }
    function onKeyDown(event) {
      if (event.key === "Home" || event.key === "0") {
        fit();
        event.preventDefault();
      }
    }
    function pan(dx, dy) {
      var worldPerPixel = (2 * state.distance * Math.tan(settings.fieldOfView / 2)) / Math.max(canvas.height, 1);
      var forward = normalize(sub(camera.eye, state.target));
      var right = normalize(cross(forward, camera.up));
      var up = cross(right, forward);
      for (var i = 0; i < 3; i += 1) {
        state.target[i] += (-right[i] * dx + up[i] * dy) * worldPerPixel;
      }
      dirty = true;
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", onDoubleClick);
    canvas.addEventListener("keydown", onKeyDown);
    var observer = typeof ResizeObserver === "function" ? new ResizeObserver(function () { resize(); }) : null;
    if (observer !== null) observer.observe(canvas);
    var onWindowResize = function () { resize(); };
    window.addEventListener("resize", onWindowResize);

    resize();
    frame = requestAnimationFrame(render);

    return {
      setGeometry: setGeometry,
      resetView: fit,
      setWireframe: function (value) { state.wireframe = value === true; dirty = true; },
      setAutoRotate: function (value) { state.autoRotate = value === true; lastTime = 0; dirty = true; },
      isWireframe: function () { return state.wireframe; },
      isAutoRotate: function () { return state.autoRotate; },
      dispose: function () {
        disposed = true;
        cancelAnimationFrame(frame);
        observer?.disconnect();
        window.removeEventListener("resize", onWindowResize);
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointercancel", onPointerUp);
        canvas.removeEventListener("wheel", onWheel);
        canvas.removeEventListener("dblclick", onDoubleClick);
        canvas.removeEventListener("keydown", onKeyDown);
        for (var i = 0; i < primitives.length; i += 1) destroyPrimitive(primitives[i]);
        if (grid !== null) destroyBufferSet(grid);
        destroyBufferSet(axes);
        gl.deleteBuffer(shadowQuad.buffer);
        gl.deleteProgram(shadowProgram);
        gl.deleteProgram(modelProgram);
        gl.deleteProgram(lineProgram);
      },
    };
  }

  function buildLineIndices(indices, triangles) {
    var ArrayType = indices instanceof Uint32Array ? Uint32Array : indices instanceof Uint8Array ? Uint8Array : Uint16Array;
    var lineIndices = new ArrayType(triangles * 6);
    for (var t = 0; t < triangles; t += 1) {
      var a = indices[t * 3];
      var b = indices[t * 3 + 1];
      var c = indices[t * 3 + 2];
      lineIndices[t * 6] = a;
      lineIndices[t * 6 + 1] = b;
      lineIndices[t * 6 + 2] = b;
      lineIndices[t * 6 + 3] = c;
      lineIndices[t * 6 + 4] = c;
      lineIndices[t * 6 + 5] = a;
    }
    return lineIndices;
  }

  // ------------------------------------------------------------------ math
  function mat4Identity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }
  function mat4Multiply(out, a, b) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    return out;
  }
  function mat4Perspective(out, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2);
    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[14] = (2 * far * near) / (near - far);
    return out;
  }
  function mat4Orthographic(out, left, right, bottom, top, near, far) {
    out.fill(0);
    out[0] = 2 / (right - left);
    out[5] = 2 / (top - bottom);
    out[10] = -2 / (far - near);
    out[12] = -(right + left) / (right - left);
    out[13] = -(top + bottom) / (top - bottom);
    out[14] = -(far + near) / (far - near);
    out[15] = 1;
    return out;
  }
  function mat4LookAt(out, eye, center, up) {
    var z = normalize(sub(eye, center));
    var x = normalize(cross(up, z));
    var y = cross(z, x);
    out[0] = x[0]; out[1] = y[0]; out[2] = z[0]; out[3] = 0;
    out[4] = x[1]; out[5] = y[1]; out[6] = z[1]; out[7] = 0;
    out[8] = x[2]; out[9] = y[2]; out[10] = z[2]; out[11] = 0;
    out[12] = -dot(x, eye); out[13] = -dot(y, eye); out[14] = -dot(z, eye); out[15] = 1;
    return out;
  }
  function rotationOf(matrix, out) {
    out[0] = matrix[0]; out[1] = matrix[1]; out[2] = matrix[2];
    out[3] = matrix[4]; out[4] = matrix[5]; out[5] = matrix[6];
    out[6] = matrix[8]; out[7] = matrix[9]; out[8] = matrix[10];
    return out;
  }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function normalize(v) {
    var length = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / length, v[1] / length, v[2] / length];
  }
  function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
  function niceStep(value) {
    if (!isFinite(value) || value <= 0) return 1;
    var power = Math.pow(10, Math.floor(Math.log10(value)));
    var normalized = value / power;
    var step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return step * power;
  }

  // ------------------------------------------------------------- gl helpers
  function buildProgram(gl, vertexSource, fragmentSource) {
    function compile(type, source) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        var log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error("Shader compile failed: " + log);
      }
      return shader;
    }
    var program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      var log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error("Shader link failed: " + log);
    }
    return program;
  }
  function uniformsOf(gl, program, names) {
    var table = {};
    for (var i = 0; i < names.length; i += 1) table[names[i]] = gl.getUniformLocation(program, names[i]);
    return table;
  }
  function uploadArray(gl, data) {
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
  }
  function uploadElement(gl, data) {
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
  }
  function pushLine(positions, colors, x1, y1, z1, x2, y2, z2, color) {
    positions.push(x1, y1, z1, x2, y2, z2);
    colors.push(color[0], color[1], color[2], color[3], color[0], color[1], color[2], color[3]);
  }

  var SHADOW_VERTEX = [
    "attribute vec2 aUv;",
    "uniform mat4 uViewProj;",
    "uniform vec3 uCenter;",
    "uniform vec2 uExtent;",
    "varying vec2 vUv;",
    "void main() {",
    "  vUv = aUv;",
    "  vec3 world = uCenter + vec3(aUv.x * uExtent.x, 0.0, aUv.y * uExtent.y);",
    "  gl_Position = uViewProj * vec4(world, 1.0);",
    "}",
  ].join("\n");

  var SHADOW_FRAGMENT = [
    "precision highp float;",
    "varying vec2 vUv;",
    "uniform float uOpacity;",
    "void main() {",
    "  float falloff = 1.0 - smoothstep(0.0, 1.0, length(vUv));",
    "  gl_FragColor = vec4(0.015, 0.02, 0.035, falloff * falloff * uOpacity);",
    "}",
  ].join("\n");

  var MODEL_VERTEX = [
    "attribute vec3 aPosition;",
    "attribute vec3 aNormal;",
    "uniform mat4 uView;",
    "uniform mat4 uViewProj;",
    "uniform mat3 uViewRot;",
    "varying vec3 vNormal;",
    "varying vec3 vViewPos;",
    "void main() {",
    "  vec4 viewPos = uView * vec4(aPosition, 1.0);",
    "  vViewPos = viewPos.xyz;",
    "  vNormal = uViewRot * aNormal;",
    "  gl_Position = uViewProj * vec4(aPosition, 1.0);",
    "}",
  ].join("\n");

  var MODEL_FRAGMENT = [
    "precision highp float;",
    "varying vec3 vNormal;",
    "varying vec3 vViewPos;",
    "uniform vec4 uBaseColor;",
    "uniform float uRoughness;",
    "uniform float uMetallic;",
    "uniform float uWireframe;",
    "uniform vec3 uCamera;",
    "uniform float uExposure;",
    "void main() {",
    "  if (uWireframe > 0.5) {",
    "    gl_FragColor = vec4(0.55, 0.72, 1.0, 0.55);",
    "    return;",
    "  }",
    "  vec3 N = normalize(vNormal);",
    "  if (!gl_FrontFacing) N = -N;",
    "  vec3 V = normalize(-vViewPos);",
    "  vec3 key = normalize(vec3(0.42, 0.7, 0.58));",
    "  vec3 fill = normalize(vec3(-0.62, 0.12, 0.38));",
    "  float keyDiff = max(dot(N, key), 0.0);",
    "  float fillDiff = max(dot(N, fill), 0.0);",
    "  float hemi = 0.5 + 0.5 * N.y;",
    "  vec3 ambient = mix(vec3(0.07, 0.075, 0.09), vec3(0.19, 0.21, 0.25), hemi);",
    "  float shininess = mix(6.0, 220.0, 1.0 - uRoughness);",
    "  vec3 H = normalize(key + V);",
    "  float spec = pow(max(dot(N, H), 0.0), shininess);",
    "  float specStrength = (0.1 + 0.6 * (1.0 - uRoughness)) * (1.0 - uMetallic * 0.6);",
    "  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);",
    "  vec3 diffuse = uBaseColor.rgb * (ambient + keyDiff * vec3(0.98, 0.95, 0.9) * 0.9 + fillDiff * vec3(0.36, 0.44, 0.58) * 0.55);",
    "  vec3 metalTint = mix(vec3(1.0), uBaseColor.rgb * 2.2, uMetallic);",
    "  diffuse += spec * specStrength * metalTint;",
    "  diffuse += fresnel * vec3(0.2, 0.27, 0.36) * 0.55;",
    "  diffuse *= uExposure;",
    "  diffuse = diffuse / (diffuse + vec3(0.72));",
    "  gl_FragColor = vec4(pow(diffuse, vec3(1.0 / 2.2)), 1.0);",
    "}",
  ].join("\n");

  var LINE_VERTEX = [
    "attribute vec3 aPosition;",
    "attribute vec4 aColor;",
    "uniform mat4 uViewProj;",
    "uniform float uOpacity;",
    "varying vec4 vColor;",
    "void main() {",
    "  vColor = vec4(aColor.rgb, aColor.a * uOpacity);",
    "  gl_Position = uViewProj * vec4(aPosition, 1.0);",
    "}",
  ].join("\n");

  var LINE_FRAGMENT = [
    "precision highp float;",
    "varying vec4 vColor;",
    "void main() { gl_FragColor = vColor; }",
  ].join("\n");

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
