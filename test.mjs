// Self-check. No framework, no network, no token: `node test.mjs`
// `node test.mjs --write` also emits demo SVGs for eyeballing.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { curvePath, monotoneTangents } from './lib/curve.js';
import { THEMES, resolveTheme } from './lib/theme.js';
import { bool, esc, hexColor, int, isUser, num, text } from './lib/validate.js';
import { TILES, slugs } from './lib/tiles/index.js';
import { FETCHERS, flattenCalendar } from './lib/github.js';
import { parseContributionsHtml } from './lib/contributions.js';
import { render as activity, groupSeries } from './lib/tiles/activity.js';
import { computeStreaks } from './lib/tiles/streak.js';
import { render as calendarTile, levelsFor } from './lib/tiles/calendar.js';
import { render as languagesTile, countLanguages } from './lib/tiles/languages.js';
import { render as statsTile, summarise } from './lib/tiles/stats.js';

/** Walk an SVG path, sampling each cubic so the real curve can be inspected. */
function samplePath(d, steps = 16) {
  const out = [];
  let cur = null;
  for (const seg of d.match(/[MLC][^MLCZ]*/g) ?? []) {
    const v = (seg.slice(1).match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (seg[0] === 'M') {
      cur = [v[0], v[1]];
      out.push(cur);
    } else if (seg[0] === 'L') {
      for (let i = 0; i < v.length; i += 2) {
        cur = [v[i], v[i + 1]];
        out.push(cur);
      }
    } else {
      for (let i = 0; i < v.length; i += 6) {
        const [p0, p1, p2, p3] = [cur, [v[i], v[i + 1]], [v[i + 2], v[i + 3]], [v[i + 4], v[i + 5]]];
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const u = 1 - t;
          out.push([
            u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
            u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1],
          ]);
        }
        cur = p3;
      }
    }
  }
  return out;
}

// ======================================================================
// Smoothing: the no-overshoot guarantee
// ======================================================================
// A sharp spike is the case where Catmull-Rom fails: it overshoots past the
// peak and dips below the flat run on either side, which on an area chart
// paints fill underneath the baseline. Monotone cubic must stay bounded.
const spike = [[0, 100], [10, 100], [20, 100], [30, 10], [40, 100], [50, 100], [60, 100]];
const lo = Math.min(...spike.map((p) => p[1]));
const hi = Math.max(...spike.map((p) => p[1]));

for (const smoothing of [0, 0.25, 0.5, 0.75, 1]) {
  for (const [, sy] of samplePath(curvePath(spike, smoothing))) {
    assert.ok(
      sy >= lo - 1e-6 && sy <= hi + 1e-6,
      `smoothing=${smoothing} overshot: y=${sy} outside [${lo}, ${hi}]`,
    );
  }
}

// Tangents must be flat at the peak and across flat runs, which is what
// bounds the curve. Index 3 is the spike; 1 and 2 sit in the flat run.
const tang = monotoneTangents(spike.map((p) => p[0]), spike.map((p) => p[1]));
assert.equal(tang[3], 0, 'tangent at a local extremum must be zero');
assert.equal(tang[1], 0, 'tangent inside a flat run must be zero');
assert.equal(tang.length, spike.length, 'one tangent per point');

// A monotonically rising series must stay monotonic after smoothing.
const rising = Array.from({ length: 20 }, (_, i) => [i * 10, 200 - i * 9]);
let prev = Infinity;
for (const [, sy] of samplePath(curvePath(rising, 1))) {
  assert.ok(sy <= prev + 1e-6, `monotonic input produced a reversal at y=${sy}`);
  prev = sy;
}

// smoothing=0 is straight segments; smoothing=1 is curves.
assert.ok(!curvePath(spike, 0).includes('C'), 'smoothing=0 must emit no cubics');
assert.ok(curvePath(spike, 1).includes('C'), 'smoothing=1 must emit cubics');
assert.equal(curvePath([], 1), '', 'empty input yields an empty path');
assert.equal(curvePath([[5, 6]], 1), 'M5,6', 'single point yields a move only');

// ======================================================================
// Trust boundary
// ======================================================================
assert.equal(hexColor('00FF41', '#X'), '#00FF41');
assert.equal(hexColor('#00FF41', '#X'), '#00FF41', 'leading # accepted');
assert.equal(hexColor('abc', '#X'), '#abc');
assert.equal(hexColor('00FF41AA', '#X'), '#00FF41AA', '8-digit hex accepted');
assert.equal(hexColor('00FF4', '#F'), '#F', '5 digits is not a colour');
assert.equal(hexColor('"><script>', '#F'), '#F', 'colour must not inject');
assert.equal(hexColor(undefined, '#F'), '#F');

assert.ok(isUser('AbdulSadath77'));
assert.ok(!isUser(''), 'empty rejected');
assert.ok(!isUser('a'.repeat(40)), 'over 39 chars rejected');
assert.ok(!isUser('bad name'), 'spaces rejected');
assert.ok(!isUser('../../etc/passwd'), 'traversal rejected');

assert.equal(int('900', 800, 320, 1600), 900);
assert.equal(int('99999', 800, 320, 1600), 1600, 'clamped to max');
assert.equal(int('1', 800, 320, 1600), 320, 'clamped to min');
assert.equal(int('abc', 800, 320, 1600), 800, 'non-numeric falls back');
assert.equal(num('0.5', 1, 0, 1), 0.5);
assert.equal(num('7', 1, 0, 1), 1, 'clamped to max');
assert.equal(bool(undefined, true), true, 'absent uses fallback');
assert.equal(bool('false', true), false);
assert.equal(bool('0', true), false);
assert.equal(bool('', true), true, 'empty uses fallback');

assert.equal(esc('<b>&"'), '&lt;b&gt;&amp;&quot;');
assert.equal(text('x'.repeat(200)).length, 80, 'text is length-capped');

// ======================================================================
// Themes
// ======================================================================
assert.equal(resolveTheme({ theme: 'matrix' }).fg, THEMES.matrix.fg);
assert.equal(resolveTheme({ theme: 'MATRIX' }).fg, THEMES.matrix.fg, 'name is case-insensitive');
assert.equal(resolveTheme({ theme: 'nope' }).fg, THEMES.matrix.fg, 'unknown name falls back');
assert.equal(resolveTheme({ theme: 'nord', color: 'FF0000' }).fg, '#FF0000', 'param overrides theme');
assert.equal(resolveTheme({ theme: 'nord', color: 'zzz' }).fg, THEMES.nord.fg, 'bad override ignored');
assert.equal(resolveTheme({ color: '00FF41' }).border, '#00FF41', 'border follows color');
for (const [name, t] of Object.entries(THEMES)) {
  for (const [token, value] of Object.entries(t)) {
    assert.match(value, /^#[0-9a-fA-F]{3,8}$/, `theme ${name}.${token} is not a hex colour`);
  }
}

// ======================================================================
// Registry
// ======================================================================
assert.ok(slugs.length > 0, 'at least one tile registered');
for (const [key, t] of Object.entries(TILES)) {
  assert.equal(t.slug, key, `${key}: slug must match its registry key`);
  assert.equal(typeof t.render, 'function', `${key}: render must be a function`);
  assert.ok(FETCHERS[t.data], `${key}: declares data "${t.data}" with no fetcher`);
  assert.ok(Object.keys(t.options).length > 0, `${key}: documents no options`);
}

// ======================================================================
// Activity tile
// ======================================================================
const theme = resolveTheme({ theme: 'matrix' });
const year = Array.from({ length: 365 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
  count: i % 17,
}));

const svg = activity(year, theme, { title: '◈ COMMIT FREQUENCY OVER TIME ◈' });
assert.ok(svg.startsWith('<svg') && svg.includes('</svg>'), 'must be an SVG document');
assert.ok(svg.includes('53 WEEKS'), 'footer reports the window and unit');
assert.ok(!/NaN|Infinity|undefined/.test(svg), 'no NaN/Infinity/undefined in output');

// Title is escaped exactly once -- double-escaping would render "&amp;lt;".
const nasty = activity(year, theme, { title: '</text><script>alert(1)</script>' });
assert.ok(!nasty.includes('<script>'), 'raw script tags must never reach output');
assert.ok(!nasty.includes('&amp;lt;'), 'title must not be double-escaped');

// Month labels and the footer need separate baselines, or DEC collides with
// the summary line on a full year.
const monthYs = new Set(
  [...svg.matchAll(/y="([\d.]+)"[^>]*>(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)</g)]
    .map((m) => m[1]),
);
assert.equal(monthYs.size, 1, 'month labels share one baseline');
assert.equal(monthYs.has(svg.match(/y="([\d.]+)"[^>]*>\d+ CONTRIBUTIONS/)[1]), false,
  'footer must not sit on the month baseline');

// ======================================================================
// Grouping
// ======================================================================
// The invariant that matters: grouping changes resolution, never the total.
const yearTotal = year.reduce((a, d) => a + d.count, 0);
for (const mode of ['day', 'week', 'month']) {
  const g = groupSeries(year, mode);
  assert.equal(g.reduce((a, d) => a + d.count, 0), yearTotal,
    `group=${mode} must preserve the total`);
  assert.ok(g.every((d, i) => i === 0 || g[i - 1].date < d.date),
    `group=${mode} must be strictly date-ordered`);
}
assert.equal(groupSeries(year, 'day').length, 365, 'day is a passthrough');
assert.equal(groupSeries(year, 'week').length, 53, '365 days spans 53 Sunday-started weeks');
assert.equal(groupSeries(year, 'month').length, 12, '365 days spans 12 months');
assert.deepEqual(groupSeries([], 'week'), [], 'empty input stays empty');

// Week buckets start on Sunday, matching GitHub's calendar.
for (const d of groupSeries(year, 'week')) {
  assert.equal(new Date(`${d.date}T00:00:00Z`).getUTCDay(), 0,
    `week bucket ${d.date} must start on a Sunday`);
}
// Month buckets start on the 1st.
for (const d of groupSeries(year, 'month')) {
  assert.ok(d.date.endsWith('-01'), `month bucket ${d.date} must start on the 1st`);
}
// Known arithmetic, not just invariants.
assert.deepEqual(
  groupSeries([
    { date: '2026-01-04', count: 1 }, // Sunday
    { date: '2026-01-05', count: 2 },
    { date: '2026-01-10', count: 4 }, // same week (Sat)
    { date: '2026-01-11', count: 8 }, // next Sunday
    { date: '2026-02-02', count: 16 },
  ], 'week'),
  [
    { date: '2026-01-04', count: 7 },
    { date: '2026-01-11', count: 8 },
    { date: '2026-02-01', count: 16 },
  ],
);
assert.deepEqual(
  groupSeries([
    { date: '2026-01-04', count: 1 },
    { date: '2026-01-31', count: 2 },
    { date: '2026-02-02', count: 4 },
  ], 'month'),
  [{ date: '2026-01-01', count: 3 }, { date: '2026-02-01', count: 4 }],
);

// Default is weekly, and the footer names the unit.
assert.ok(activity(year, theme, {}).includes('53 WEEKS'), 'default grouping is weekly');
assert.ok(activity(year, theme, { group: 'day' }).includes('365 DAYS'));
assert.ok(activity(year, theme, { group: 'month' }).includes('12 MONTHS'));
assert.ok(activity(year, theme, { group: 'nonsense' }).includes('53 WEEKS'),
  'unknown group falls back to weekly');
// Weekly must yield far fewer, more widely spaced points than daily -- the
// whole reason grouping exists.
assert.ok(
  activity(year, theme, { group: 'week' }).match(/ C/g).length <
    activity(year, theme, { group: 'day' }).match(/ C/g).length / 5,
  'weekly must produce many fewer curve segments than daily',
);

// Option plumbing.
assert.ok(activity(year, theme, { width: '1200' }).includes('width="1200"'));
assert.ok(activity(year, theme, { width: '99999' }).includes('width="1600"'), 'width clamped');
assert.ok(activity(year, theme, { days: '30', group: 'day' }).includes('30 DAYS'),
  'days window is applied before grouping');
assert.ok(activity(year, theme, { days: '28', group: 'week' }).match(/[45] WEEKS/),
  'a 28-day window buckets into 4-5 Sunday-started weeks');
assert.ok(!activity(year, theme, { fill: 'false' }).includes(theme.area), 'fill=false drops the area');
assert.ok(!activity(year, theme, { border: 'false' }).includes('stroke-opacity="0.25"'), 'border=false drops the frame');
assert.ok(activity(year, theme, { points: 'true' }).includes('<circle'), 'points=true draws markers');
assert.ok(!activity(year, theme, { grid: 'false' }).includes('stroke-opacity="0.12"'), 'grid=false drops gridlines');

// Degenerate series that would otherwise divide by zero.
assert.ok(activity([], theme, {}).includes('NO CONTRIBUTION DATA'), 'empty series handled');
const zeros = activity(year.map((d) => ({ ...d, count: 0 })), theme, {});
assert.ok(!/NaN|Infinity/.test(zeros), 'all-zero series must not divide by zero');
const one = activity([{ date: '2026-01-01', count: 3 }], theme, {});
assert.ok(!/NaN|Infinity/.test(one), 'single-point series must not divide by zero');

// GitHub response shape.
assert.deepEqual(
  flattenCalendar({
    weeks: [
      { contributionDays: [{ date: '2026-01-01', contributionCount: 2 }] },
      { contributionDays: [{ date: '2026-01-02', contributionCount: 5 }] },
    ],
  }),
  [{ date: '2026-01-01', count: 2 }, { date: '2026-01-02', count: 5 }],
);

// ======================================================================
// Token-free contribution parsing
// ======================================================================
// Fixture mirrors the real markup: attribute order varies, a padding cell
// carries no date, counts live in tool-tips joined by id, and the grid is laid
// out one row per weekday so cell order is not date order.
const FIXTURE = `
<td tabindex="0" data-ix="0" data-date="2026-01-04" id="cdc-0-0" data-level="1"
  role="gridcell" class="ContributionCalendar-day"></td>
<td tabindex="0" data-ix="1" data-date="2026-01-11" id="cdc-0-1" data-level="0"
  role="gridcell" class="ContributionCalendar-day"></td>
<td id="cdc-1-0" data-level="3" data-date="2026-01-05" class="ContributionCalendar-day"></td>
<td data-level="0" role="gridcell" class="ContributionCalendar-day"></td>
<tool-tip id="t1" for="cdc-0-0" class="sr-only">1 contribution on January 4th.</tool-tip>
<tool-tip id="t2" for="cdc-0-1" class="sr-only">No contributions on January 11th.</tool-tip>
<tool-tip id="t3" for="cdc-1-0" class="sr-only">1,024 contributions on January 5th.</tool-tip>
<tool-tip id="t4" for="not-a-day-cell" class="sr-only">99 contributions on March 1st.</tool-tip>
`;
const parsed = parseContributionsHtml(FIXTURE);
assert.deepEqual(parsed, [
  { date: '2026-01-04', count: 1 },
  { date: '2026-01-05', count: 1024 },
  { date: '2026-01-11', count: 0 },
], 'parsed days must be date-sorted, comma-aware, and skip padding + stray tooltips');

// A markup change must fail loudly, not yield a plausible empty year.
assert.throws(() => parseContributionsHtml('<html><body>nothing</body></html>'),
  /markup may have changed/, 'no day cells must throw');
assert.throws(() => parseContributionsHtml(
  '<td data-date="2026-01-04" id="x" class="ContributionCalendar-day"></td>'),
  /no tooltip counts/, 'day cells with no tooltips must throw');

// A day cell whose tooltip is missing defaults to 0 rather than undefined.
const partial = parseContributionsHtml(
  '<td data-date="2026-02-01" id="a" class="ContributionCalendar-day"></td>' +
  '<td data-date="2026-02-02" id="b" class="ContributionCalendar-day"></td>' +
  '<tool-tip for="a">4 contributions on February 1st.</tool-tip>');
assert.deepEqual(partial, [
  { date: '2026-02-01', count: 4 },
  { date: '2026-02-02', count: 0 },
]);

// ======================================================================
// streak
// ======================================================================
const mk = (counts, from = '2026-01-01') => counts.map((count, i) => ({
  date: new Date(Date.UTC(2026, 0, 1 + i + (from === '2026-01-01' ? 0 : 0))).toISOString().slice(0, 10),
  count,
}));

assert.deepEqual(computeStreaks(mk([1, 1, 1, 0, 1, 1])), {
  total: 5,
  longest: { len: 3, start: '2026-01-01', end: '2026-01-03' },
  current: { len: 2, start: '2026-01-05', end: '2026-01-06' },
});
// A zero on the final day must not break the streak: today is not over yet.
assert.deepEqual(computeStreaks(mk([1, 1, 1, 0])).current,
  { len: 3, start: '2026-01-01', end: '2026-01-03' },
  'trailing zero is skipped, not counted as a miss');
// Two zeros does end it.
assert.equal(computeStreaks(mk([1, 1, 0, 0])).current.len, 0,
  'a full missed day ends the streak');
assert.deepEqual(computeStreaks(mk([0, 0, 0])),
  { total: 0, longest: { len: 0, start: null, end: null },
    current: { len: 0, start: null, end: null } },
  'all-zero series yields zero streaks');
assert.equal(computeStreaks(mk(new Array(10).fill(2))).current.len, 10, 'unbroken run');
assert.equal(computeStreaks([]).total, 0, 'empty series is safe');
// The longest streak must be the first of equal-length runs, not the last.
assert.equal(computeStreaks(mk([1, 1, 0, 1, 1])).longest.start, '2026-01-01');

// ======================================================================
// calendar
// ======================================================================
const calSvg = calendarTile(year, theme, { title: 'GRID' });
assert.ok(calSvg.startsWith('<svg'), 'calendar renders an SVG');
assert.ok(!/NaN|Infinity|undefined/.test(calSvg), 'calendar output is clean');
// 365 days is 53 week columns; every dated cell must be drawn.
assert.equal(calSvg.match(/<rect [^>]*rx="2"/g).length, 365, 'one cell per day');
assert.ok(calSvg.includes('53 WEEKS'));
assert.ok(calendarTile([], theme, {}).includes('NO CONTRIBUTION DATA'));
assert.ok(!calendarTile(year, theme, { labels: 'false' }).includes('MON'), 'labels=false');
// Shade levels must be quantile-based, so a huge peak cannot flatten the rest.
const lvSmall = levelsFor(mk([1, 2, 3, 4]), 5);
const lvHuge = levelsFor(mk([1, 2, 3, 400]), 5);
assert.equal(lvSmall(0), 0, 'zero is always level 0');
assert.ok(lvSmall(4) > lvSmall(1), 'higher counts shade darker');
assert.ok(lvHuge(2) > 0, 'a 300x outlier must not flatten ordinary days to zero');
assert.equal(levelsFor(mk([0, 0]), 5)(0), 0, 'all-zero series is safe');

// ======================================================================
// languages + stats
// ======================================================================
const profile = {
  login: 'tester', name: 'Tester', createdAt: '2023-03-05T09:31:17Z',
  followers: 20, following: 123, publicRepos: 5,
  repos: [
    { name: 'a', language: 'JavaScript', stars: 10, forks: 1, fork: false },
    { name: 'b', language: 'JavaScript', stars: 5, forks: 0, fork: false },
    { name: 'c', language: 'Dart', stars: 2, forks: 0, fork: false },
    { name: 'd', language: 'Rust', stars: 99, forks: 9, fork: true },
    { name: 'e', language: null, stars: 1, forks: 0, fork: false },
  ],
};

assert.deepEqual(countLanguages(profile.repos), [
  { name: 'JavaScript', count: 2 },
  { name: 'Dart', count: 1 },
], 'forks and language-less repos are excluded by default');
assert.equal(countLanguages(profile.repos, { includeForks: true }).length, 3, 'forks=true adds Rust');
// Equal counts must sort alphabetically, so output is stable across runs.
assert.deepEqual(
  countLanguages([
    { language: 'Zig', fork: false }, { language: 'Ada', fork: false },
  ]).map((l) => l.name),
  ['Ada', 'Zig'],
);

const sum = summarise(profile);
assert.equal(sum.repos, 4, 'forks excluded; language-less repos still count as repos');
assert.equal(sum.stars, 18, 'forked repo stars excluded (10+5+2+1)');
assert.equal(sum.followers, 20);
assert.ok(sum.years > 3 && sum.years < 10, `account age looks wrong: ${sum.years}`);
assert.equal(summarise(profile, { includeForks: true }).repos, 5);
assert.equal(summarise(profile, { includeForks: true }).stars, 117, '18 + the fork\u2019s 99');
assert.equal(summarise({ login: 'x', repos: [] }).repos, 0, 'empty profile is safe');

for (const [name, fn] of [['languages', languagesTile], ['stats', statsTile]]) {
  const out = fn(profile, theme, { title: name.toUpperCase() });
  assert.ok(out.startsWith('<svg') && out.includes('</svg>'), `${name} renders an SVG`);
  assert.ok(!/NaN|Infinity|undefined/.test(out), `${name} output is clean`);
}
assert.ok(languagesTile({ login: 'x', repos: [] }, theme, {}).includes('NO LANGUAGE DATA'));
assert.ok(statsTile({ login: 'x', repos: [] }, theme, {}).includes('@x'));

// Every tile must survive every theme and the degenerate inputs.
for (const [key, def] of Object.entries(TILES)) {
  const data = def.data === 'calendar' ? year : profile;
  const empty = def.data === 'calendar' ? [] : { login: 'x', repos: [] };
  for (const name of Object.keys(THEMES)) {
    const out = def.render(data, resolveTheme({ theme: name }), {});
    assert.ok(out.startsWith('<svg'), `${key} broke on theme ${name}`);
    assert.ok(!/NaN|Infinity|undefined/.test(out), `${key} emitted NaN on theme ${name}`);
  }
  const out = def.render(empty, theme, {});
  assert.ok(out.startsWith('<svg'), `${key} broke on empty data`);
  assert.ok(!/NaN|Infinity|undefined/.test(out), `${key} emitted NaN on empty data`);
  // An injected title must never escape, on any tile.
  const evil = def.render(data, theme, { title: '</text><script>alert(1)</script>' });
  assert.ok(!evil.includes('<script>'), `${key} let a script tag through`);
}

// ======================================================================
// Static build config
// ======================================================================
// A typo here would otherwise only surface when the nightly Action fails.
const config = JSON.parse(readFileSync(new URL('./gitmatrix.json', import.meta.url), 'utf8'));
assert.ok(config.username, 'gitmatrix.json needs a username');
assert.ok(Array.isArray(config.tiles) && config.tiles.length, 'gitmatrix.json lists no tiles');
const files = new Set();
for (const [i, entry] of config.tiles.entries()) {
  assert.ok(TILES[entry.tile], `gitmatrix.json tiles[${i}]: unknown tile "${entry.tile}"`);
  const file = entry.file ?? `${entry.tile}.svg`;
  assert.ok(file.endsWith('.svg'), `tiles[${i}]: "${file}" should end in .svg`);
  assert.ok(!files.has(file), `tiles[${i}]: duplicate output file "${file}"`);
  files.add(file);
  // Render it for real, so a bad option combination fails here. The fixture
  // has to match the tile's declared data source.
  const fixture = TILES[entry.tile].data === 'calendar' ? year : profile;
  const out = TILES[entry.tile].render(fixture, resolveTheme(entry), entry);
  assert.ok(out.startsWith('<svg'), `tiles[${i}]: did not render an SVG`);
  assert.ok(!/NaN|Infinity|undefined/.test(out), `tiles[${i}]: rendered NaN/Infinity/undefined`);
}

if (process.argv.includes('--write')) {
  const wave = Array.from({ length: 180 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    count: Math.max(0, Math.round(9 + 8 * Math.sin(i / 9) + (i % 11 === 0 ? 11 : 0))),
  }));
  writeFileSync('demo-smooth.svg', activity(wave, theme,
    { title: 'SMOOTHING 1.0', smoothing: '1' }));
  writeFileSync('demo-straight.svg', activity(wave, theme,
    { title: 'SMOOTHING 0.0', smoothing: '0' }));
  console.log('wrote demo-smooth.svg demo-straight.svg');
}

console.log(`all checks passed (${slugs.length} tile${slugs.length === 1 ? '' : 's'} registered)`);
