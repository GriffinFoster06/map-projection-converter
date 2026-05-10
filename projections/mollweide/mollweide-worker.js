importScripts("../shared.js", "mollweide-core.js");

self.onmessage = function (e) {
  const direction = e.data.direction || "to-equirectangular";
  const result =
    direction === "from-equirectangular"
      ? mollweideConvertFromEquirectangularPixels(
          e.data.src,
          e.data.width,
          e.data.height,
        )
      : mollweideConvertPixels(e.data.src, e.data.width, e.data.height);
  self.postMessage(result, [result.out.buffer]);
};
