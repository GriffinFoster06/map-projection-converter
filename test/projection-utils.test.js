const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadProjectionUtils() {
  const sharedPath = path.join(__dirname, "..", "projections", "shared.js");
  const code = fs.readFileSync(sharedPath, "utf8");
  const context = {
    module: { exports: {} },
    exports: {},
    console,
    Math,
  };
  vm.createContext(context);
  vm.runInContext(`${code}\nmodule.exports = { ProjectionUtils };`, context, {
    filename: "shared.js",
  });
  return context.module.exports.ProjectionUtils;
}

test("equirectangular mapping round-trips lat/lon", () => {
  const ProjectionUtils = loadProjectionUtils();
  const width = 360;
  const height = 180;
  const lambda = Math.PI / 3;
  const phi = -Math.PI / 6;

  const pos = ProjectionUtils.latLonToEquirectangular(
    lambda,
    phi,
    width,
    height,
  );
  const ll = ProjectionUtils.equirectangularToLatLon(
    pos.x,
    pos.y,
    width,
    height,
  );

  assert.ok(Math.abs(ll.lambda - lambda) < 0.02);
  assert.ok(Math.abs(ll.phi - phi) < 0.02);
});

test("projection bounds helpers invert consistently", () => {
  const ProjectionUtils = loadProjectionUtils();
  const bounds = { xMin: -2, xMax: 2, yMin: -1, yMax: 1 };
  const width = 5;
  const height = 3;
  const pixel = { x: 3, y: 2 };

  const projected = ProjectionUtils.pixelToProjected(
    pixel.x,
    pixel.y,
    bounds,
    width,
    height,
  );
  const roundTrip = ProjectionUtils.projectedToPixel(
    projected.x,
    projected.y,
    bounds,
    width,
    height,
  );

  assert.ok(Math.abs(roundTrip.x - pixel.x) < 1e-6);
  assert.ok(Math.abs(roundTrip.y - pixel.y) < 1e-6);
});

test("bilinear sampling blends nearby pixels", () => {
  const ProjectionUtils = loadProjectionUtils();
  const src = new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 255,
    0, 0, 255, 255, 255, 255, 255, 255,
  ]);
  const out = new Uint8ClampedArray(4);

  const ok = ProjectionUtils.sampleBilinear(src, 2, 2, 0.5, 0.5, out, 0);

  assert.equal(ok, true);
  assert.ok(Math.abs(out[0] - 127.5) < 1);
  assert.ok(Math.abs(out[1] - 127.5) < 1);
  assert.ok(Math.abs(out[2] - 127.5) < 1);
  assert.equal(out[3], 255);
});

test("bilinear sampling returns transparent for out of bounds", () => {
  const ProjectionUtils = loadProjectionUtils();
  const src = new Uint8ClampedArray(16).fill(255);
  const out = new Uint8ClampedArray([10, 10, 10, 10]);

  const ok = ProjectionUtils.sampleBilinear(src, 2, 2, -1, 0, out, 0);

  assert.equal(ok, false);
  assert.deepEqual(Array.from(out), [0, 0, 0, 0]);
});
