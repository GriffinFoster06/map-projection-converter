function nicolosiToEquirectangular(image) {
  const src = ProjectionUtils.getSourceData(image).data;
  const result = nicolosiConvertPixels(src, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = result.width;
  canvas.height = result.height;
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(result.width, result.height);
  imgData.data.set(result.out);
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function equirectangularToNicolosi(image) {
  const src = ProjectionUtils.getSourceData(image).data;
  const result = nicolosiConvertFromEquirectangularPixels(
    src,
    image.width,
    image.height,
  );
  const canvas = document.createElement("canvas");
  canvas.width = result.width;
  canvas.height = result.height;
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(result.width, result.height);
  imgData.data.set(result.out);
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

const nicolosi = {
  id: "nicolosi",
  name: "Nicolosi Globular",
  description: "Two hemispheres side by side (2:1 ratio)",

  renderConfig(container, onChange) {
    ProjectionUtils.renderConfig(this, container, onChange);
  },

  showConfig() {
    ProjectionUtils.showSliders(this, "nicolosi");
  },

  renderInputOverlay(ctx, width, height) {
    ProjectionUtils.renderOverlayMask(
      ctx,
      width,
      height,
      function (oCtx, w, h) {
        const radius = h / 2;
        oCtx.beginPath();
        oCtx.arc(radius, radius, radius, 0, 2 * Math.PI);
        oCtx.fill();
        oCtx.beginPath();
        oCtx.arc(w - radius, radius, radius, 0, 2 * Math.PI);
        oCtx.fill();
      },
    );
  },

  getConfig() {
    return ProjectionUtils.getSliderConfig("nicolosi");
  },

  prepareImage(image, config) {
    return ProjectionUtils.prepareImage(image, config);
  },

  toEquirectangular(image) {
    return nicolosiToEquirectangular(
      ProjectionUtils.downscaleForPreview(image),
    );
  },

  fromEquirectangular(image) {
    return equirectangularToNicolosi(
      ProjectionUtils.downscaleForPreview(image),
    );
  },

  toEquirectangularFullRes(image) {
    return ProjectionUtils.convertWithWorker(
      image,
      "projections/nicolosi/nicolosi-worker.js",
      function (sourceData, img) {
        return {
          data: {
            src: sourceData.data,
            hemi: img.height,
            direction: "to-equirectangular",
          },
          transfer: [sourceData.data.buffer],
        };
      },
    );
  },

  fromEquirectangularFullRes(image) {
    return ProjectionUtils.convertWithWorker(
      image,
      "projections/nicolosi/nicolosi-worker.js",
      function (sourceData, img) {
        return {
          data: {
            src: sourceData.data,
            width: img.width,
            height: img.height,
            direction: "from-equirectangular",
          },
          transfer: [sourceData.data.buffer],
        };
      },
    );
  },
};
