const WINKEL_PHI1 = Math.acos(2 / Math.PI);
const WINKEL_COS_PHI1 = 2 / Math.PI;
// Max extents: at equator lambda=pi → x_max = (2+pi)/2; at pole → y_max = pi/2
const WINKEL_X_MAX = (2 + Math.PI) / 2;
const WINKEL_Y_MAX = Math.PI / 2;

function winkelTripelForward(lambda, phi) {
  const cosPhi = Math.cos(phi);
  const cosHalfLambda = Math.cos(lambda / 2);
  const alpha = Math.acos(cosPhi * cosHalfLambda);

  let sincAlpha;
  if (alpha === 0) {
    sincAlpha = 1;
  } else {
    sincAlpha = Math.sin(alpha) / alpha;
  }

  const xAitoff = (2 * cosPhi * Math.sin(lambda / 2)) / sincAlpha;
  const yAitoff = Math.sin(phi) / sincAlpha;

  return {
    x: (lambda * WINKEL_COS_PHI1 + xAitoff) / 2,
    y: (phi + yAitoff) / 2,
  };
}

function winkelTripelInverse(x, y) {
  let lambda = (x / WINKEL_X_MAX) * Math.PI;
  let phi = (y / WINKEL_Y_MAX) * (Math.PI / 2);
  const tol = 1e-7;
  const delta = 1e-6;

  for (let i = 0; i < 12; i++) {
    const proj = winkelTripelForward(lambda, phi);
    const fx = proj.x - x;
    const fy = proj.y - y;
    if (Math.abs(fx) + Math.abs(fy) < tol) {
      return { lambda, phi };
    }

    const projL = winkelTripelForward(lambda + delta, phi);
    const projP = winkelTripelForward(lambda, phi + delta);
    const dFx_dL = (projL.x - proj.x) / delta;
    const dFy_dL = (projL.y - proj.y) / delta;
    const dFx_dP = (projP.x - proj.x) / delta;
    const dFy_dP = (projP.y - proj.y) / delta;
    const det = dFx_dL * dFy_dP - dFx_dP * dFy_dL;

    if (Math.abs(det) < 1e-12) break;

    const dLambda = (-fx * dFy_dP + fy * dFx_dP) / det;
    const dPhi = (-dFx_dL * fy + dFy_dL * fx) / det;
    lambda += dLambda;
    phi += dPhi;
    lambda = Math.max(-Math.PI, Math.min(Math.PI, lambda));
    phi = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, phi));
  }

  const finalProj = winkelTripelForward(lambda, phi);
  if (Math.abs(finalProj.x - x) + Math.abs(finalProj.y - y) < tol * 10) {
    return { lambda, phi };
  }

  return null;
}

function winkelTripelConvertPixels(src, srcW, srcH) {
  const srcWmax = srcW - 1;
  const srcHmax = srcH - 1;
  const outW = srcW;
  const outH = Math.round(srcW / 2);
  const out = new Uint8ClampedArray(outW * outH * 4);

  for (let y = 0; y < outH; y++) {
    const phi = Math.PI / 2 - (y / outH) * Math.PI;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);
    const outRowBase = y * outW * 4;

    for (let x = 0; x < outW; x++) {
      const lambda = (x / outW) * 2 * Math.PI - Math.PI;

      const cosHalfLambda = Math.cos(lambda / 2);
      const alpha = Math.acos(cosPhi * cosHalfLambda);

      let sincAlpha;
      if (alpha === 0) {
        sincAlpha = 1;
      } else {
        sincAlpha = Math.sin(alpha) / alpha;
      }

      const xAitoff = (2 * cosPhi * Math.sin(lambda / 2)) / sincAlpha;
      const yAitoff = sinPhi / sincAlpha;

      const xW = (lambda * WINKEL_COS_PHI1 + xAitoff) / 2;
      const yW = (phi + yAitoff) / 2;

      const px = (xW / WINKEL_X_MAX + 1) * 0.5 * srcWmax;
      const py = (1 - yW / WINKEL_Y_MAX) * 0.5 * srcHmax;

      if (px < 0 || px > srcWmax || py < 0 || py > srcHmax) continue;

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

function winkelTripelConvertFromEquirectangularPixels(src, srcW, srcH) {
  const aspectRatio = WINKEL_X_MAX / WINKEL_Y_MAX;
  const outW = srcW;
  const outH = Math.round(outW / aspectRatio);
  const out = new Uint8ClampedArray(outW * outH * 4);
  const bounds = {
    xMin: -WINKEL_X_MAX,
    xMax: WINKEL_X_MAX,
    yMin: -WINKEL_Y_MAX,
    yMax: WINKEL_Y_MAX,
  };

  for (let y = 0; y < outH; y++) {
    const outRowBase = y * outW * 4;
    for (let x = 0; x < outW; x++) {
      const proj = ProjectionUtils.pixelToProjected(x, y, bounds, outW, outH);
      const inv = winkelTripelInverse(proj.x, proj.y);
      if (!inv) {
        const oi = outRowBase + x * 4;
        out[oi] = 0;
        out[oi + 1] = 0;
        out[oi + 2] = 0;
        out[oi + 3] = 0;
        continue;
      }

      const srcPos = ProjectionUtils.latLonToEquirectangular(
        inv.lambda,
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
