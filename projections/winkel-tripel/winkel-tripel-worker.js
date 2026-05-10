importScripts("../shared.js", "winkel-tripel-core.js");

self.onmessage = function (e) {
  const direction = e.data.direction || "to-equirectangular";
  const result =
    direction === "from-equirectangular"
      ? winkelTripelConvertFromEquirectangularPixels(
          e.data.src,
          e.data.width,
          e.data.height,
        )
      : winkelTripelConvertPixels(e.data.src, e.data.width, e.data.height);
  self.postMessage(result, [result.out.buffer]);
};
