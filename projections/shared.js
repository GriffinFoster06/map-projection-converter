const PROJ_PREVIEW_MAX_HEIGHT = 1000;
const EQUIRECTANGULAR_ASPECT_RATIO = 2;

const ProjectionUtils = {
  getSourceData(image) {
    const c = document.createElement("canvas");
    c.width = image.width;
    c.height = image.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(image, 0, 0);
    return ctx.getImageData(0, 0, image.width, image.height);
  },

  downscaleForPreview(image) {
    if (image.height <= PROJ_PREVIEW_MAX_HEIGHT) return image;
    const ratio = PROJ_PREVIEW_MAX_HEIGHT / image.height;
    const w = Math.round(image.width * ratio);
    const h = PROJ_PREVIEW_MAX_HEIGHT;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(image, 0, 0, w, h);
    return c;
  },

  prepareImage(image, config, aspectRatio = 2) {
    const scale = config.scale || 1;
    const userOffsetX = config.offsetX || 0;
    const userOffsetY = config.offsetY || 0;
    const canvasHeight = Math.round(
      Math.max(image.width, image.height) / scale,
    );
    const canvasWidth = Math.round(canvasHeight * aspectRatio);

    const prepared = document.createElement("canvas");
    prepared.width = canvasWidth;
    prepared.height = canvasHeight;
    const ctx = prepared.getContext("2d");

    const scaledWidth = image.width * (canvasHeight / image.height) * scale;
    const scaledHeight = canvasHeight * scale;
    const offsetX = (canvasWidth - scaledWidth) / 2 + userOffsetX;
    const offsetY = (canvasHeight - scaledHeight) / 2 + userOffsetY;

    ctx.drawImage(image, offsetX, offsetY, scaledWidth, scaledHeight);
    return prepared;
  },

  prepareEquirectangular(image, config) {
    const scale = config.scale || 1;
    const userOffsetX = config.offsetX || 0;
    const userOffsetY = config.offsetY || 0;
    const baseHeight = Math.max(
      image.height,
      image.width / EQUIRECTANGULAR_ASPECT_RATIO,
    );
    const canvasHeight = Math.round(baseHeight / scale);
    const canvasWidth = Math.round(canvasHeight * EQUIRECTANGULAR_ASPECT_RATIO);

    const prepared = document.createElement("canvas");
    prepared.width = canvasWidth;
    prepared.height = canvasHeight;
    const ctx = prepared.getContext("2d");

    const scaledWidth = image.width * (canvasHeight / image.height) * scale;
    const scaledHeight = canvasHeight * scale;
    const offsetX = (canvasWidth - scaledWidth) / 2 + userOffsetX;
    const offsetY = (canvasHeight - scaledHeight) / 2 + userOffsetY;

    ctx.drawImage(image, offsetX, offsetY, scaledWidth, scaledHeight);
    return prepared;
  },

  renderConfig(projection, container, onChange) {
    container.innerHTML = "";
    projection._onChange = onChange;
    projection._onInput = null;
  },

  showSliders(projection, prefix) {
    if (document.getElementById(prefix + "Scale")) return;
    const container = document.getElementById("projectionConfig");
    container.innerHTML = `
      <div class="slider-row">
        <label>Scale</label>
        <input type="range" id="${prefix}Scale" min="0.5" max="1.5" step="0.001" value="1">
        <input type="number" id="${prefix}ScaleInput" min="0.5" max="1.5" step="0.001" value="1">
      </div>
      <div class="slider-row">
        <label>Offset X</label>
        <input type="range" id="${prefix}OffsetX" min="-100" max="100" step="0.001" value="0">
        <input type="number" id="${prefix}OffsetXInput" min="-100" max="100" step="0.001" value="0">
      </div>
      <div class="slider-row">
        <label>Offset Y</label>
        <input type="range" id="${prefix}OffsetY" min="-100" max="100" step="0.001" value="0">
        <input type="number" id="${prefix}OffsetYInput" min="-100" max="100" step="0.001" value="0">
      </div>
    `;

    const setupControl = function (sliderId, inputId) {
      const slider = document.getElementById(sliderId);
      const input = document.getElementById(inputId);
      slider.addEventListener("input", function () {
        input.value = slider.value;
        if (projection._onInput) projection._onInput();
      });
      slider.addEventListener("change", function () {
        if (projection._onChange) projection._onChange();
      });
      input.addEventListener("input", function () {
        slider.value = input.value;
        if (projection._onInput) projection._onInput();
      });
      input.addEventListener("change", function () {
        if (projection._onChange) projection._onChange();
      });
    };

    setupControl(prefix + "Scale", prefix + "ScaleInput");
    setupControl(prefix + "OffsetX", prefix + "OffsetXInput");
    setupControl(prefix + "OffsetY", prefix + "OffsetYInput");
  },

  getSliderConfig(prefix) {
    const scaleEl = document.getElementById(prefix + "Scale");
    const offXEl = document.getElementById(prefix + "OffsetX");
    const offYEl = document.getElementById(prefix + "OffsetY");
    return {
      scale: scaleEl ? parseFloat(scaleEl.value) : 1,
      offsetX: offXEl ? parseFloat(offXEl.value) : 0,
      offsetY: offYEl ? parseFloat(offYEl.value) : 0,
    };
  },

  convertWithWorker(image, workerPath, buildMessage) {
    return new Promise(function (resolve, reject) {
      const sourceData = ProjectionUtils.getSourceData(image);
      const msg = buildMessage(sourceData, image);
      const worker = new Worker(workerPath);
      worker.onmessage = function (e) {
        const outW = e.data.width;
        const outH = e.data.height;
        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d");
        const imgData = ctx.createImageData(outW, outH);
        imgData.data.set(e.data.out);
        ctx.putImageData(imgData, 0, 0);
        worker.terminate();
        resolve(canvas);
      };
      worker.onerror = function (err) {
        worker.terminate();
        reject(err);
      };
      worker.postMessage(msg.data, msg.transfer);
    });
  },

  equirectangularToLatLon(x, y, width, height) {
    const wMax = width - 1;
    const hMax = height - 1;
    const xRatio = wMax > 0 ? x / wMax : 0;
    const yRatio = hMax > 0 ? y / hMax : 0;
    return {
      lambda: xRatio * 2 * Math.PI - Math.PI,
      phi: Math.PI / 2 - yRatio * Math.PI,
    };
  },

  latLonToEquirectangular(lambda, phi, width, height) {
    const wMax = width - 1;
    const hMax = height - 1;
    return {
      x: ((lambda + Math.PI) / (2 * Math.PI)) * wMax,
      y: ((Math.PI / 2 - phi) / Math.PI) * hMax,
    };
  },

  projectedToPixel(x, y, bounds, width, height) {
    const wMax = width - 1;
    const hMax = height - 1;
    return {
      x: ((x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * wMax,
      y: ((bounds.yMax - y) / (bounds.yMax - bounds.yMin)) * hMax,
    };
  },

  pixelToProjected(x, y, bounds, width, height) {
    const wMax = width - 1;
    const hMax = height - 1;
    const xRatio = wMax > 0 ? x / wMax : 0;
    const yRatio = hMax > 0 ? y / hMax : 0;
    return {
      x: bounds.xMin + xRatio * (bounds.xMax - bounds.xMin),
      y: bounds.yMax - yRatio * (bounds.yMax - bounds.yMin),
    };
  },

  sampleBilinear(src, srcW, srcH, px, py, out, oi) {
    const srcWmax = srcW - 1;
    const srcHmax = srcH - 1;

    if (px < 0 || px > srcWmax || py < 0 || py > srcHmax) {
      out[oi] = 0;
      out[oi + 1] = 0;
      out[oi + 2] = 0;
      out[oi + 3] = 0;
      return false;
    }

    const x0 = px | 0;
    const y0 = py | 0;
    let x1 = x0 + 1;
    if (x1 > srcWmax) x1 = srcWmax;
    let y1 = y0 + 1;
    if (y1 > srcHmax) y1 = srcHmax;

    const dx = px - x0;
    const dy = py - y0;
    const w00 = (1 - dx) * (1 - dy);
    const w10 = dx * (1 - dy);
    const w01 = (1 - dx) * dy;
    const w11 = dx * dy;

    const i00 = (y0 * srcW + x0) * 4;
    const i10 = (y0 * srcW + x1) * 4;
    const i01 = (y1 * srcW + x0) * 4;
    const i11 = (y1 * srcW + x1) * 4;

    out[oi] =
      src[i00] * w00 + src[i10] * w10 + src[i01] * w01 + src[i11] * w11;
    out[oi + 1] =
      src[i00 + 1] * w00 +
      src[i10 + 1] * w10 +
      src[i01 + 1] * w01 +
      src[i11 + 1] * w11;
    out[oi + 2] =
      src[i00 + 2] * w00 +
      src[i10 + 2] * w10 +
      src[i01 + 2] * w01 +
      src[i11 + 2] * w11;
    out[oi + 3] =
      src[i00 + 3] * w00 +
      src[i10 + 3] * w10 +
      src[i01 + 3] * w01 +
      src[i11 + 3] * w11;

    return true;
  },

  renderOverlayMask(ctx, width, height, drawCutouts) {
    const overlay = document.createElement("canvas");
    overlay.width = width;
    overlay.height = height;
    const oCtx = overlay.getContext("2d");

    oCtx.fillStyle = "rgba(0, 0, 0, 0.5)";
    oCtx.fillRect(0, 0, width, height);

    oCtx.globalCompositeOperation = "destination-out";
    oCtx.fillStyle = "black";
    drawCutouts(oCtx, width, height);

    ctx.drawImage(overlay, 0, 0);
  },
};
