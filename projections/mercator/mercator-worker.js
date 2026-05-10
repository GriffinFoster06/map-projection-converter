importScripts("../shared.js", "mercator-core.js");

self.onmessage = function (e) {
  const direction = e.data.direction || "to-equirectangular";
  const result =
    direction === "from-equirectangular"
      ? mercatorConvertFromEquirectangularPixels(
          e.data.src,
          e.data.width,
          e.data.height,
        )
      : mercatorConvertPixels(e.data.src, e.data.width, e.data.height);
  self.postMessage(result, [result.out.buffer]);
};
