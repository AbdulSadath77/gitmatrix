// Smooth curve interpolation.
//
// Uses monotone cubic Hermite interpolation (Fritsch-Carlson, 1980) rather than
// Catmull-Rom. Both cost about the same to implement, but Catmull-Rom overshoots
// around local extrema -- on contribution data that means the curve dips below
// zero after a spike, drawing an area fill under the baseline. Monotone cubic
// cannot overshoot by construction, so the curve stays inside the data range.

const f = (n) => (Math.round(n * 10) / 10).toString();

/**
 * Tangents for a monotone cubic Hermite spline through (xs[i], ys[i]).
 * @returns {number[]} one tangent per point
 */
export function monotoneTangents(xs, ys) {
  const n = xs.length;
  if (n < 2) return new Array(n).fill(0);

  // Secant slope of each segment.
  const delta = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    const dx = xs[i + 1] - xs[i];
    delta[i] = dx === 0 ? 0 : (ys[i + 1] - ys[i]) / dx;
  }

  // Interior tangents average their neighbours, except at a local extremum
  // (sign change) where a zero tangent is what keeps the curve from bulging
  // past the data point.
  const m = new Array(n);
  m[0] = delta[0];
  m[n - 1] = delta[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = delta[i - 1] * delta[i] <= 0 ? 0 : (delta[i - 1] + delta[i]) / 2;
  }

  // Fritsch-Carlson: project any tangent pair outside the monotonicity region
  // back onto a circle of radius 3. This is the step that bounds the curve.
  for (let i = 0; i < n - 1; i++) {
    if (delta[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / delta[i];
    const b = m[i + 1] / delta[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * delta[i];
      m[i + 1] = t * b * delta[i];
    }
  }
  return m;
}

/**
 * SVG path through the given points.
 *
 * @param {[number, number][]} pts
 * @param {number} smoothing 0 = straight segments, 1 = full monotone cubic.
 *   Intermediate values blend toward straight by shortening the control arms,
 *   which keeps the no-overshoot guarantee for the whole range.
 */
export function curvePath(pts, smoothing = 1) {
  if (!pts.length) return '';
  if (pts.length === 1) return `M${f(pts[0][0])},${f(pts[0][1])}`;

  if (smoothing <= 0) {
    return `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' L')}`;
  }

  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const m = monotoneTangents(xs, ys);

  let d = `M${f(xs[0])},${f(ys[0])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    // Hermite -> cubic Bezier: control points sit one third of the span away,
    // offset along the tangent.
    const arm = ((xs[i + 1] - xs[i]) / 3) * smoothing;
    d +=
      ` C${f(xs[i] + arm)},${f(ys[i] + m[i] * arm)}` +
      ` ${f(xs[i + 1] - arm)},${f(ys[i + 1] - m[i + 1] * arm)}` +
      ` ${f(xs[i + 1])},${f(ys[i + 1])}`;
  }
  return d;
}

/** Close a line path into an area that drops to `baseY`. */
export function areaPath(linePath, firstX, lastX, baseY) {
  if (!linePath) return '';
  return `${linePath} L${f(lastX)},${f(baseY)} L${f(firstX)},${f(baseY)} Z`;
}
