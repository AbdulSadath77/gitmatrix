// Streak tile: total contributions, current streak, longest streak.
// Computed from the calendar series -- no extra request.

import { tile, message } from '../svg.js';
import { bool, int, text } from '../validate.js';

export const options = {
  width: 'px, 320-1600 (default 760)',
  height: 'px, 160-800 (default 240)',
  border: 'draw the outer frame (default true)',
  radius: 'corner radius, 0-24 (default 6)',
  title: 'heading text, up to 80 chars',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-03-14" -> "Mar 14" */
function short(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

/**
 * @param {{date:string,count:number}[]} days oldest -> newest
 * @returns {{total:number,
 *            longest:{len:number,start:string|null,end:string|null},
 *            current:{len:number,start:string|null,end:string|null}}}
 */
export function computeStreaks(days) {
  const total = days.reduce((a, d) => a + d.count, 0);

  let longest = { len: 0, start: null, end: null };
  let run = 0;
  let runStart = null;
  for (const d of days) {
    if (d.count > 0) {
      if (run === 0) runStart = d.date;
      run += 1;
      if (run > longest.len) longest = { len: run, start: runStart, end: d.date };
    } else {
      run = 0;
    }
  }

  // Walk back from the end. A zero on the final day does not break the streak:
  // today is not over yet, so it is skipped rather than counted as a miss.
  let i = days.length - 1;
  if (i >= 0 && days[i].count === 0) i -= 1;
  let len = 0;
  let start = null;
  let end = null;
  while (i >= 0 && days[i].count > 0) {
    if (len === 0) end = days[i].date;
    start = days[i].date;
    len += 1;
    i -= 1;
  }

  return { total, longest, current: { len, start, end } };
}

export function render(days, theme, q = {}) {
  const width = int(q.width, 760, 320, 1600);
  const height = int(q.height, 240, 160, 800);
  const radius = int(q.radius, 6, 0, 24);
  const border = bool(q.border, true);
  const title = text(q.title, 80);

  if (!days.length) {
    return message('NO CONTRIBUTION DATA', { width, height, theme, radius });
  }

  const { total, longest, current } = computeStreaks(days);
  const top = title ? 54 : 26;
  const mid = top + (height - top - 30) / 2;
  const col = width / 3;

  const stat = (i, value, label, sub) => {
    const cx = col * i + col / 2;
    return `<text x="${cx.toFixed(1)}" y="${(mid - 16).toFixed(1)}" fill="${theme.fg}"
        font-size="34" font-weight="700" text-anchor="middle"
        font-family="monospace">${value}</text>
      <text x="${cx.toFixed(1)}" y="${(mid + 12).toFixed(1)}" fill="${theme.muted}"
        font-size="11" text-anchor="middle" font-family="monospace"
        letter-spacing="1.2">${label}</text>
      <text x="${cx.toFixed(1)}" y="${(mid + 34).toFixed(1)}" fill="${theme.muted}"
        fill-opacity="0.55" font-size="10" text-anchor="middle"
        font-family="monospace">${sub}</text>`;
  };

  // Ring around the middle figure, echoing the streak cards this replaces.
  // Centred on the numeral's optical centre (~12px above its baseline) and
  // sized to stop short of the label below it -- an earlier version was
  // centred lower and the stroke cut straight through the label text.
  const ringR = Math.min(30, (height - top - 60) / 2);
  const ring = `<circle cx="${(col * 1.5).toFixed(1)}" cy="${(mid - 28).toFixed(1)}"
      r="${ringR.toFixed(1)}" fill="none" stroke="${theme.fg}"
      stroke-opacity="${current.len > 0 ? '0.75' : '0.25'}" stroke-width="2"/>`;

  const dividers = [1, 2]
    .map((i) => `<line x1="${(col * i).toFixed(1)}" y1="${(top + 8).toFixed(1)}"
         x2="${(col * i).toFixed(1)}" y2="${(height - 34).toFixed(1)}"
         stroke="${theme.fg}" stroke-opacity="0.15" stroke-width="1"/>`)
    .join('');

  const span = (s, e) => (s && e ? `${short(s)} – ${short(e)}` : '—');

  return tile({
    width, height, theme, title, border, radius,
    body: `${dividers}${ring}
      ${stat(0, total, 'TOTAL', `${days.length} days tracked`)}
      ${stat(1, current.len, 'CURRENT STREAK', span(current.start, current.end))}
      ${stat(2, longest.len, 'LONGEST STREAK', span(longest.start, longest.end))}`,
  });
}
