importScripts("../shared.js", "robinson-core.js");

self.onmessage = function (e) {
  const direction = e.data.direction || "to-equirectangular";
  const result =
    direction === "from-equirectangular"
      ? robinsonConvertFromEquirectangularPixels(
          e.data.src,
          e.data.width,
          e.data.height,
        )
      : robinsonConvertPixels(e.data.src, e.data.width, e.data.height);
  self.postMessage(result, [result.out.buffer]);
};
