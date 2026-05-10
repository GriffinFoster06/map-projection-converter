const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;
const INV_HALF_PI = 1 / HALF_PI;

function nicolosiProject(localLambda, phi) {
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const absPhi = Math.abs(phi);
  const isEquator = phi === 0;
  const isPole = absPhi === HALF_PI;
  const c_phi = (2 * phi) / Math.PI;
  const d_phi =
    isPole || isEquator ? 0 : (1 - c_phi * c_phi) / (sinPhi - c_phi);
  const d2_phi = d_phi * d_phi;
  const absLambda = Math.abs(localLambda);
  const sign = localLambda > 0 ? 1 : localLambda < 0 ? -1 : 0;
  let nx;
  let ny;

  if (localLambda === 0 || isPole) {
    nx = 0;
    ny = phi * INV_HALF_PI;
  } else if (isEquator) {
    nx = localLambda * INV_HALF_PI;
    ny = 0;
  } else if (absLambda === HALF_PI) {
    nx = localLambda * INV_HALF_PI * cosPhi;
    ny = sign;
  } else {
    const b = Math.PI / (2 * localLambda) - (2 * localLambda) / Math.PI;
    const b2 = b * b;
    const b2d2 = 1 + b2 / d2_phi;
    const d2b2 = 1 + d2_phi / b2;

    const M = ((b * sinPhi) / d_phi - b / 2) / b2d2;
    const N = ((d2_phi * sinPhi) / b2 + d_phi / 2) / d2b2;

    nx = M + Math.sqrt(M * M + (cosPhi * cosPhi) / b2d2) * sign;
    ny =
      N +
      Math.sqrt(
        N * N -
          ((d2_phi * sinPhi * sinPhi) / b2 + d_phi * sinPhi - 1) / d2b2,
      ) *
        (-phi * b > 0 ? 1 : -phi * b < 0 ? -1 : 0) *
        sign;
  }

  return { x: nx, y: ny };
}

function nicolosiInverse(nx, ny) {
  if (nx * nx + ny * ny > 1) return null;
  let localLambda = nx * HALF_PI;
  let phi = ny * HALF_PI;
  const tol = 1e-7;
  const delta = 1e-6;

  for (let i = 0; i < 12; i++) {
    const proj = nicolosiProject(localLambda, phi);
    const fx = proj.x - nx;
    const fy = proj.y - ny;
    if (!Number.isFinite(fx) || !Number.isFinite(fy)) break;
    if (Math.abs(fx) + Math.abs(fy) < tol) {
      return { localLambda, phi };
    }

    const projL = nicolosiProject(localLambda + delta, phi);
    const projP = nicolosiProject(localLambda, phi + delta);
    const dFx_dL = (projL.x - proj.x) / delta;
    const dFy_dL = (projL.y - proj.y) / delta;
    const dFx_dP = (projP.x - proj.x) / delta;
    const dFy_dP = (projP.y - proj.y) / delta;
    const det = dFx_dL * dFy_dP - dFx_dP * dFy_dL;

    if (!Number.isFinite(det) || Math.abs(det) < 1e-12) break;

    const dLambda = (-fx * dFy_dP + fy * dFx_dP) / det;
    const dPhi = (-dFx_dL * fy + dFy_dL * fx) / det;
    localLambda += dLambda;
    phi += dPhi;
    localLambda = Math.max(-HALF_PI, Math.min(HALF_PI, localLambda));
    phi = Math.max(-HALF_PI, Math.min(HALF_PI, phi));
  }

  const finalProj = nicolosiProject(localLambda, phi);
  if (
    Number.isFinite(finalProj.x) &&
    Number.isFinite(finalProj.y) &&
    Math.abs(finalProj.x - nx) + Math.abs(finalProj.y - ny) < tol * 10
  ) {
    return { localLambda, phi };
  }

  return null;
}

function nicolosiConvertPixels(src, hemi) {
  const outW = hemi * 2;
  const outH = hemi;
  const hemiMax = hemi - 1;
  const stride = hemi * 2;
  const out = new Uint8ClampedArray(outW * outH * 4);

  for (let y = 0; y < outH; y++) {
    const phi = HALF_PI - (y / outH) * Math.PI;
    const outRowBase = y * outW * 4;

    for (let x = 0; x < outW; x++) {
      const lambda = (x / outW) * TWO_PI - Math.PI;
      let localLambda, hemisphereOffset;

      if (lambda < 0) {
        hemisphereOffset = 0;
        localLambda = lambda + HALF_PI;
      } else {
        hemisphereOffset = hemi;
        localLambda = lambda - HALF_PI;
      }

      const projected = nicolosiProject(localLambda, phi);
      const nx = projected.x;
      const ny = projected.y;

      if (nx * nx + ny * ny > 1) continue;

      const px = (nx + 1) * 0.5 * hemiMax;
      const py = (1 - ny) * 0.5 * hemiMax;

      const x0 = px | 0;
      const y0 = py | 0;
      let x1 = x0 + 1;
      if (x1 > hemiMax) x1 = hemiMax;
      let y1 = y0 + 1;
      if (y1 > hemiMax) y1 = hemiMax;

      const dx = px - x0;
      const dy = py - y0;
      const idx0 = 1 - dx;
      const idy0 = 1 - dy;

      const w00 = idx0 * idy0;
      const w10 = dx * idy0;
      const w01 = idx0 * dy;
      const w11 = dx * dy;

      const i00 = (y0 * stride + x0 + hemisphereOffset) * 4;
      const i10 = (y0 * stride + x1 + hemisphereOffset) * 4;
      const i01 = (y1 * stride + x0 + hemisphereOffset) * 4;
      const i11 = (y1 * stride + x1 + hemisphereOffset) * 4;

      const oi = outRowBase + x * 4;
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
    }
  }

  return { out: out, width: outW, height: outH };
}

function nicolosiConvertFromEquirectangularPixels(src, srcW, srcH) {
  const outW = srcW;
  const outH = Math.round(outW / 2);
  const hemi = outH;
  const hemiMax = hemi - 1;
  const out = new Uint8ClampedArray(outW * outH * 4);

  for (let y = 0; y < outH; y++) {
    const outRowBase = y * outW * 4;
    const ny = 1 - (y / hemiMax) * 2;

    for (let x = 0; x < outW; x++) {
      const isLeft = x < hemi;
      const localX = isLeft ? x : x - hemi;
      const nx = (localX / hemiMax) * 2 - 1;

      const inv = nicolosiInverse(nx, ny);
      if (!inv) {
        const oi = outRowBase + x * 4;
        out[oi] = 0;
        out[oi + 1] = 0;
        out[oi + 2] = 0;
        out[oi + 3] = 0;
        continue;
      }

      let lambda = isLeft
        ? inv.localLambda - HALF_PI
        : inv.localLambda + HALF_PI;
      lambda = Math.max(-Math.PI, Math.min(Math.PI, lambda));

      const srcPos = ProjectionUtils.latLonToEquirectangular(
        lambda,
        inv.phi,
        srcW,
        srcH,
      );
      ProjectionUtils.sampleBilinear(
        src,
        srcW,
        srcH,
        srcPos.x,
        srcPos.y,
        out,
        outRowBase + x * 4,
      );
    }
  }

  return { out: out, width: outW, height: outH };
}
