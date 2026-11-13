// Activity tile: daily contribution counts as a smooth area + line chart.

import { curvePath, areaPath } from '../curve.js';
import { tile, message } from '../svg.js';
import { bool, int, num, text } from '../validate.js';

/** Options this tile accepts, for the gallery and the docs to enumerate. */
export const options = {
  width: 'px, 320-1600 (default 800)',
  height: 'px, 160-800 (default 320)',
  smoothing: '0-1, 0 = straight segments, 1 = full curve (default 1)',
  days: 'trim to the most recent N days, 7-366 (default all)',
  points: 'show a dot per data point (default false)',
  grid: 'show horizontal reference lines (default true)',
  dots: 'radius of point markers, 1-5 (default 2)',
  fill: 'draw the area under the line (default true)',
  border: 'draw the outer frame (default true)',
  radius: 'corner radius, 0-24 (default 6)',
  title: 'heading text, up to 80 chars',
};

/**
 * @param {{date:string,count:number}[]} days oldest -> newest
 * @param {import('../theme.js').Theme} theme
 * @param {Record<string,string>} q raw query params
 */
export function render(days, theme, q = {}) {
  const width = int(q.width, 800, 320, 1600);
  const height = int(q.height, 320, 160, 800);
  const radius = int(q.radius, 6, 0, 24);
  const smoothing = num(q.smoothing, 1, 0, 1);
  const border = bool(q.border, true);
  const fill = bool(q.fill, true);
  const grid = bool(q.grid, true);
  const showPoints = bool(q.points, false);
  const dotR = num(q.dots, 2, 1, 5);
  const title = text(q.title, 80);

  const window = int(q.days, 0, 7, 366);
  const series = window > 0 ? days.slice(-window) : days;

  if (!series.length) {
    return message('NO CONTRIBUTION DATA', { width, height, theme, radius });
  }

  // Two footer rows: month labels, then the summary line.
  const pad = { top: title ? 56 : 28, right: 24, bottom: 48, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const baseY = pad.top + plotH;

  // A flat-zero series would divide by zero and collapse every point onto the
  // baseline; flooring the peak at 1 keeps the scale valid.
  const peak = Math.max(...series.map((d) => d.count), 1);
  const stepX = series.length > 1 ? plotW / (series.length - 1) : 0;
  const x = (i) => pad.left + i * stepX;
  const y = (n) => baseY - (n / peak) * plotH;

  const pts = series.map((d, i) => [x(i), y(d.count)]);
  const line = curvePath(pts, smoothing);

  const gridLines = grid
    ? [0, 0.25, 0.5, 0.75, 1]
        .map((frac) => {
          const n = Math.round(peak * frac);
          const gy = y(n).toFixed(1);
          return `<line x1="${pad.left}" y1="${gy}" x2="${width - pad.right}" y2="${gy}"
                    stroke="${theme.fg}" stroke-opacity="0.12" stroke-width="1"/>
                  <text x="${pad.left - 8}" y="${gy}" fill="${theme.muted}" fill-opacity="0.5"
                    font-size="10" text-anchor="end" dominant-baseline="middle"
                    font-family="monospace">${n}</text>`;
        })
        .join('')
    : '';

  let lastMonth = null;
  const months = series
    .map((d, i) => {
      const m = d.date.slice(0, 7);
      if (m === lastMonth) return '';
      lastMonth = m;
      const label = new Date(`${d.date}T00:00:00Z`)
        .toLocaleString('en', { month: 'short', timeZone: 'UTC' })
        .toUpperCase();
      return `<text x="${x(i).toFixed(1)}" y="${height - 30}" fill="${theme.muted}"
                fill-opacity="0.55" font-size="10" text-anchor="middle"
                font-family="monospace">${label}</text>`;
    })
    .join('');

  const area = fill
    ? `<path d="${areaPath(line, pts[0][0], pts[pts.length - 1][0], baseY)}"
         fill="${theme.area}" fill-opacity="0.85"/>`
    : '';

  const dots = showPoints
    ? pts
        .map(([px, py]) => `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${dotR}"
             fill="${theme.fg}"/>`)
        .join('')
    : '';

  const total = series.reduce((a, d) => a + d.count, 0);

  return tile({
    width, height, theme, title, border, radius,
    footer: `${total} CONTRIBUTIONS / PEAK ${peak} / ${series.length} DAYS`,
    body: `${gridLines}${months}${area}
      <path d="${line}" fill="none" stroke="${theme.fg}" stroke-width="2"
        stroke-linejoin="round" stroke-linecap="round"/>${dots}`,
  });
}
