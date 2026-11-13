// Stats tile: profile aggregates. Replaces the github-readme-stats card,
// which has been returning 503.

import { tile } from '../svg.js';
import { bool, int, text } from '../validate.js';

export const options = {
  width: 'px, 320-1600 (default 460)',
  forks: 'count forked repos as your own (default false)',
  border: 'draw the outer frame (default true)',
  radius: 'corner radius, 0-24 (default 6)',
  title: 'heading text, up to 80 chars',
};

/**
 * Forks are excluded by default. Including them is why third-party cards
 * disagree about repo counts -- one says 57, another 28, for the same account.
 */
export function summarise(profile, { includeForks = false } = {}) {
  const repos = (profile.repos ?? []).filter((r) => includeForks || !r.fork);
  const years = profile.createdAt
    ? Math.max(0, (Date.now() - Date.parse(profile.createdAt)) / 31557600000)
    : 0;
  return {
    repos: repos.length,
    stars: repos.reduce((a, r) => a + r.stars, 0),
    forks: repos.reduce((a, r) => a + r.forks, 0),
    followers: profile.followers ?? 0,
    following: profile.following ?? 0,
    years,
  };
}

export function render(profile, theme, q = {}) {
  const width = int(q.width, 460, 320, 1600);
  const includeForks = bool(q.forks, false);
  const border = bool(q.border, true);
  const radius = int(q.radius, 6, 0, 24);
  const title = text(q.title, 80);

  const s = summarise(profile, { includeForks });
  const since = profile.createdAt ? profile.createdAt.slice(0, 4) : '—';

  const rows = [
    ['REPOSITORIES', String(s.repos)],
    ['TOTAL STARS', String(s.stars)],
    ['TOTAL FORKS', String(s.forks)],
    ['FOLLOWERS', String(s.followers)],
    ['FOLLOWING', String(s.following)],
    ['MEMBER SINCE', `${since} · ${s.years.toFixed(1)}y`],
  ];

  const padT = title ? 54 : 26;
  const lineH = 27;
  const body = rows
    .map(([label, value], i) => {
      const y = padT + 6 + i * lineH;
      const rule = i < rows.length - 1
        ? `<line x1="24" y1="${y + 9}" x2="${width - 24}" y2="${y + 9}" stroke="${theme.fg}"
             stroke-opacity="0.1" stroke-width="1"/>`
        : '';
      return `<text x="24" y="${y}" fill="${theme.muted}" font-size="11.5"
          letter-spacing="1.1" font-family="monospace">${label}</text>
        <text x="${width - 24}" y="${y}" fill="${theme.fg}" font-size="15" font-weight="700"
          text-anchor="end" font-family="monospace">${value}</text>${rule}`;
    })
    .join('');

  return tile({
    width,
    height: padT + 6 + rows.length * lineH + 22,
    theme, title, border, radius,
    footer: `@${profile.login}`,
    body,
  });
}
