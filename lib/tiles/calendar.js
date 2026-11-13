// Calendar tile: the contribution grid, one column per week.
// Computed from the calendar series -- no extra request.

import { tile, message } from '../svg.js';
import { bool, int, num, text } from '../validate.js';

export const options = {
  cell: 'px square size, 6-20 (default 11)',
  gap: 'px between cells, 1-6 (default 3)',
  levels: 'shade steps, 3-6 (default 5)',
  labels: 'show month and weekday labels (default true)',
  border: 'draw the outer frame (default true)',
  radius: 'corner radius, 0-24 (default 6)',
  title: 'heading text, up to 80 chars',
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DOW = ['', 'MON', '', 'WED', '', 'FRI', ''];

/**
 * Bucket counts into shade levels.
 *
 * Thresholds are quantiles of the non-zero days rather than fixed numbers, so
 * the grid stays readable whether a peak day is 3 commits or 300. Zero always
 * maps to level 0.
 */
export function levelsFor(days, steps) {
  const nonzero = days.filter((d) => d.count > 0).map((d) => d.count).sort((a, b) => a - b);
  if (!nonzero.length) return () => 0;
  const cuts = Array.from({ length: steps - 1 }, (_, i) =>
    nonzero[Math.min(nonzero.length - 1, Math.floor(((i + 1) / (steps - 1)) * (nonzero.length - 1)))]);
  return (count) => {
    if (count <= 0) return 0;
    let lv = 1;
    for (let i = 0; i < cuts.length - 1; i++) if (count > cuts[i]) lv = i + 2;
    return Math.min(lv, steps - 1);
  };
}

export function render(days, theme, q = {}) {
  const cell = int(q.cell, 11, 6, 20);
  const gap = int(q.gap, 3, 1, 6);
  const steps = int(q.levels, 5, 3, 6);
  const labels = bool(q.labels, true);
  const border = bool(q.border, true);
  const radius = int(q.radius, 6, 0, 24);
  const title = text(q.title, 80);

  if (!days.length) {
    return message('NO CONTRIBUTION DATA', { width: 400, height: 180, theme, radius });
  }

  // One column per week, rows Sunday..Saturday, matching GitHub's layout.
  const columns = [];
  for (const d of days) {
    const dow = new Date(`${d.date}T00:00:00Z`).getUTCDay();
    if (!columns.length || dow === 0) columns.push(new Array(7).fill(null));
    columns[columns.length - 1][dow] = d;
  }

  const pitch = cell + gap;
  const padL = labels ? 34 : 12;
  const padT = (title ? 50 : 16) + (labels ? 16 : 0);
  // Size follows the grid, so the tile never clips or leaves dead space.
  const width = padL + columns.length * pitch + 12;
  // +28 keeps the Saturday row clear of the footer line.
  const height = padT + 7 * pitch + 28;

  const levelOf = levelsFor(days, steps);
  // Level 0 is a faint track; the rest ramp opacity up to full.
  const opacity = (lv) => (lv === 0 ? 0.07 : 0.2 + (lv / (steps - 1)) * 0.8);

  let cells = '';
  let monthLabels = '';
  let lastMonth = null;
  columns.forEach((week, c) => {
    const x = padL + c * pitch;
    week.forEach((d, r) => {
      if (!d) return;
      const lv = levelOf(d.count);
      cells += `<rect x="${x}" y="${padT + r * pitch}" width="${cell}" height="${cell}" rx="2"
        fill="${theme.fg}" fill-opacity="${opacity(lv).toFixed(3)}"/>`;
    });
    if (labels) {
      const first = week.find(Boolean);
      const m = first && first.date.slice(5, 7);
      if (m && m !== lastMonth) {
        lastMonth = m;
        monthLabels += `<text x="${x}" y="${padT - 7}" fill="${theme.muted}" fill-opacity="0.6"
          font-size="9" font-family="monospace">${MONTHS[Number(m) - 1]}</text>`;
      }
    }
  });

  const dowLabels = labels
    ? DOW.map((d, r) => (d
        ? `<text x="${padL - 7}" y="${padT + r * pitch + cell - 2}" fill="${theme.muted}"
             fill-opacity="0.6" font-size="9" text-anchor="end"
             font-family="monospace">${d}</text>`
        : '')).join('')
    : '';

  const total = days.reduce((a, d) => a + d.count, 0);

  return tile({
    width, height, theme, title, border, radius,
    footer: `${total} CONTRIBUTIONS / ${columns.length} WEEKS`,
    body: `${monthLabels}${dowLabels}${cells}`,
  });
}
