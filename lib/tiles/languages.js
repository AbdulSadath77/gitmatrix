// Languages tile: stacked bar plus legend, from the profile's repositories.

import { tile, message } from '../svg.js';
import { bool, int, text } from '../validate.js';

export const options = {
  width: 'px, 320-1600 (default 460)',
  top: 'how many languages to list, 3-12 (default 6)',
  forks: 'include forked repos (default false)',
  border: 'draw the outer frame (default true)',
  radius: 'corner radius, 0-24 (default 6)',
  title: 'heading text, up to 80 chars',
};

/**
 * Count repositories per language.
 *
 * ponytail: this counts repos, not bytes. Byte-accurate shares need one
 * /languages request per repo -- 29 extra calls against a 60/hr unauthenticated
 * budget -- or GraphQL with a token. Upgrade path: add a byte-accurate mode
 * that activates only when a token is present.
 */
export function countLanguages(repos, { includeForks = false } = {}) {
  const counts = new Map();
  for (const r of repos) {
    if (!includeForks && r.fork) continue;
    if (!r.language) continue;
    counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    // Ties sort alphabetically so the output is stable between runs.
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function render(profile, theme, q = {}) {
  const width = int(q.width, 460, 320, 1600);
  const top = int(q.top, 6, 3, 12);
  const includeForks = bool(q.forks, false);
  const border = bool(q.border, true);
  const radius = int(q.radius, 6, 0, 24);
  const title = text(q.title, 80);

  const all = countLanguages(profile.repos ?? [], { includeForks });
  const padT = title ? 54 : 26;

  if (!all.length) {
    return message('NO LANGUAGE DATA', { width, height: 160, theme, radius });
  }

  const shown = all.slice(0, top);
  const rest = all.slice(top).reduce((a, l) => a + l.count, 0);
  const rows = rest > 0 ? [...shown, { name: 'Other', count: rest }] : shown;
  const total = rows.reduce((a, l) => a + l.count, 0);

  // Opacity ramp off the theme colour, rather than per-language brand colours:
  // it stays on-theme under all 7 presets and needs no colour table.
  const shade = (i) => (0.95 - (i / Math.max(rows.length - 1, 1)) * 0.65).toFixed(3);

  const barY = padT;
  const barH = 12;
  const barW = width - 48;
  let x = 24;
  const bar = rows
    .map((l, i) => {
      const w = (l.count / total) * barW;
      const seg = `<rect x="${x.toFixed(1)}" y="${barY}" width="${Math.max(w, 0.8).toFixed(1)}"
        height="${barH}" fill="${theme.fg}" fill-opacity="${shade(i)}"/>`;
      x += w;
      return seg;
    })
    .join('');

  const lineH = 22;
  const legend = rows
    .map((l, i) => {
      const y = barY + barH + 26 + i * lineH;
      const pct = ((l.count / total) * 100).toFixed(1);
      return `<rect x="24" y="${y - 8}" width="9" height="9" rx="2" fill="${theme.fg}"
          fill-opacity="${shade(i)}"/>
        <text x="41" y="${y}" fill="${theme.muted}" font-size="12"
          font-family="monospace">${l.name}</text>
        <text x="${width - 24}" y="${y}" fill="${theme.muted}" fill-opacity="0.6"
          font-size="12" text-anchor="end" font-family="monospace">${pct}%</text>`;
    })
    .join('');

  const height = barY + barH + 26 + rows.length * lineH + 18;
  const counted = (profile.repos ?? []).filter((r) => includeForks || !r.fork).length;

  return tile({
    width, height, theme, title, border, radius,
    footer: `${all.length} LANGUAGES / ${counted} REPOS`,
    body: `<rect x="24" y="${barY}" width="${barW}" height="${barH}" rx="2"
        fill="${theme.fg}" fill-opacity="0.08"/>${bar}${legend}`,
  });
}
