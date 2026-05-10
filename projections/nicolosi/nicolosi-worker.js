importScripts("../shared.js", "nicolosi-core.js");

self.onmessage = function (e) {
  const direction = e.data.direction || "to-equirectangular";
  const result =
    direction === "from-equirectangular"
      ? nicolosiConvertFromEquirectangularPixels(
          e.data.src,
          e.data.width,
          e.data.height,
        )
      : nicolosiConvertPixels(e.data.src, e.data.hemi);
  self.postMessage(result, [result.out.buffer]);
};
