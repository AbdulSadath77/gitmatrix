#!/usr/bin/env node
// Builds the public site:
//
//   site/index.html       components showcase
//   site/docs/index.html  reference documentation
//
// Both pages are generated from the tile registry: the component list, the
// options tables and the copy-paste snippets all come from
// lib/tiles/index.js. Adding a tile updates both pages with no edit here, so
// the published docs cannot drift from the code.
//
//   node bin/gallery.mjs
//   node bin/gallery.mjs --demo        # synthetic data, no network
//   node bin/gallery.mjs --out public

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FETCHERS } from '../lib/github.js';
import { THEMES, resolveTheme } from '../lib/theme.js';
import { TILES } from '../lib/tiles/index.js';

const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const has = (n) => argv.includes(`--${n}`);

const REPO = flag('repo', process.env.GITHUB_REPOSITORY ?? 'AbdulSadath77/gitmatrix');
const USER = flag('username', REPO.split('/')[0]);

const H = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => H[c]);
const code = (s) => `<pre><code>${esc(s)}</code></pre>`;

/** Make an inlined SVG fluid rather than fixed-width. */
const inline = (svg) => svg.replace(/\swidth="\d+"\s+height="\d+"/, ' width="100%"');

function demoData() {
  return Array.from({ length: 365 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    count: Math.max(0, Math.round(7 + 6 * Math.sin(i / 11) + (i % 23 === 0 ? 12 : 0))),
  }));
}

function demoProfile() {
  const langs = ['TypeScript', 'JavaScript', 'Rust', 'Python', 'Go', 'CSS'];
  return {
    login: 'octocat', name: 'Octocat', createdAt: '2021-04-02T00:00:00Z',
    followers: 128, following: 42, publicRepos: 24,
    repos: Array.from({ length: 24 }, (_, i) => ({
      name: `repo-${i}`,
      language: langs[i % langs.length],
      stars: (i * 7) % 23,
      forks: i % 4,
      fork: i % 8 === 0,
    })),
  };
}

const CSS = `
:root{--fg:#00FF41;--bg:#0D1117;--dim:#7d8590;--line:rgba(0,255,65,.18);--panel:#0b0f14}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:#E6EDF3;
  font:15px/1.65 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.wrap{max-width:980px;margin:0 auto;padding:0 20px 80px}
header{border-bottom:1px solid var(--line);padding:40px 0 30px;margin-bottom:8px}
.cover{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--panel)}
h1{margin:0;font-size:34px;letter-spacing:-.5px;color:var(--fg)}
.tag{color:var(--dim);margin:10px 0 0}
.badges{margin-top:18px;display:flex;gap:8px;flex-wrap:wrap}
.badge{border:1px solid var(--line);color:var(--fg);padding:3px 10px;border-radius:999px;font-size:12px}
nav{margin:24px 0 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
nav a{color:var(--fg);text-decoration:none;border:1px solid var(--line);
  padding:5px 12px;border-radius:4px;font-size:13px}
nav a:hover{background:rgba(0,255,65,.08)}
nav a.on{background:rgba(0,255,65,.12);border-color:rgba(0,255,65,.45)}
nav .sep{flex:1}
section{border-top:1px solid var(--line);padding-top:40px;margin-top:46px}
section:first-of-type{border-top:0;padding-top:32px;margin-top:0}
h2{color:var(--fg);font-size:25px;margin:0 0 6px}
h3{color:var(--fg);font-size:14px;letter-spacing:.14em;text-transform:uppercase;
  margin:34px 0 12px;font-weight:600}
h4{color:#E6EDF3;font-size:15px;margin:26px 0 8px}
.summary{color:var(--dim);margin:0 0 22px}
.label{color:var(--dim);font-size:13px;margin:16px 0 6px}
.hero{border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--panel)}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
figure{margin:0;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--panel)}
figcaption{color:var(--dim);font-size:12px;padding:8px 12px;border-top:1px solid var(--line)}
pre{background:var(--panel);border:1px solid var(--line);border-radius:6px;
  padding:13px 15px;overflow-x:auto;margin:0 0 10px}
code{color:var(--fg);font-size:13px}
p code,td code,li code{background:var(--panel);padding:1px 5px;border-radius:3px}
table{width:100%;border-collapse:collapse;font-size:13.5px;margin:0 0 18px}
th{text-align:left;color:var(--fg);border-bottom:1px solid var(--line);padding:9px 10px;
  font-size:12px;letter-spacing:.1em;text-transform:uppercase}
td{border-bottom:1px solid rgba(125,133,144,.14);padding:9px 10px;vertical-align:top}
td:first-child{white-space:nowrap}
ul{color:var(--dim);padding-left:20px}
li{margin:6px 0}
a{color:var(--fg)}
footer{border-top:1px solid var(--line);margin-top:54px;padding-top:24px;color:var(--dim);font-size:13px}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

function page({ title, description, header, body, footer }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
${header}
${body}
<footer>${footer}</footer>
</div>
</body>
</html>
`;
}

function nav(current, keys) {
  const link = (href, label, on) =>
    `<a href="${href}"${on ? ' class="on"' : ''}>${esc(label)}</a>`;
  const base = current === 'docs' ? '../' : '';
  return `<nav>
    ${link(base || './', 'components', current === 'home')}
    ${link(current === 'docs' ? './' : 'docs/', 'docs', current === 'docs')}
    <span class="sep"></span>
    ${link(`https://github.com/${REPO}`, 'source \u2192', false)}
  </nav>`;
}

function optionsTable(options) {
  const rows = Object.entries(options)
    .map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(v)}</td></tr>`)
    .join('\n');
  return `<table><thead><tr><th>option</th><th>accepts</th></tr></thead><tbody>
${rows}
</tbody></table>`;
}

/** Showcase section: preview, snippet, theme strip, smoothing strip. */
function showcaseSection(key, def, data) {
  const theme = resolveTheme({ theme: 'matrix' });
  const isSeries = Array.isArray(data);
  const hero = def.render(data, theme, {
    title: `\u25C8 ${key.toUpperCase()} \u25C8`, width: 900, height: 300,
  });

  // Series tiles get a shorter window so half-width previews stay legible.
  const recent = isSeries ? data.slice(-90) : data;
  const strip = (items) => `<div class="grid">${items.join('\n')}</div>`;

  const themeStrip = Object.keys(THEMES).map((name) => {
    const svg = def.render(recent, resolveTheme({ theme: name }), {
      title: name.toUpperCase(), width: 440, height: 190,
    });
    return `<figure>${inline(svg)}<figcaption>?theme=${esc(name)}</figcaption></figure>`;
  });

  const smoothStrip = 'smoothing' in def.options
    ? ['0', '0.5', '1'].map((s) => {
        const svg = def.render(recent, theme, {
          title: `SMOOTHING ${s}`, smoothing: s, width: 440, height: 190,
        });
        return `<figure>${inline(svg)}<figcaption>?smoothing=${s}</figcaption></figure>`;
      })
    : null;

  return `<section id="${esc(key)}">
  <h2>${esc(key)}</h2>
  <p class="summary">${esc(def.summary)}</p>
  <div class="hero">${inline(hero)}</div>
  <h3>Use it</h3>
  ${code(`<img src="https://cdn.jsdelivr.net/gh/${REPO}@tiles/${key}.svg" width="100%" />`)}
  <p class="label">Full option reference: <a href="docs/#${esc(key)}">docs \u2192</a></p>
  <h3>Themes</h3>
  ${strip(themeStrip)}
  ${smoothStrip ? `<h3>Smoothing</h3>\n  ${strip(smoothStrip)}` : ''}
</section>`;
}

/** Docs section: one entry per tile, options only. */
function docsSection(key, def) {
  return `<section id="${esc(key)}">
  <h2>${esc(key)}</h2>
  <p class="summary">${esc(def.summary)}</p>
  <h3>Endpoint</h3>
  ${code(`/api/${key}?username=${USER}`)}
  <h3>Static file</h3>
  ${code(`https://cdn.jsdelivr.net/gh/${REPO}@tiles/${key}.svg`)}
  <h3>Options</h3>
  ${optionsTable(def.options)}
</section>`;
}

async function main() {
  const outDir = resolve(flag('out', 'site'));
  const keys = Object.keys(TILES);

  // One fetch per distinct data source, shared by the tiles that declare it.
  // Real data when reachable, synthetic otherwise -- a docs page must not fail
  // because a network call did.
  const needed = [...new Set(keys.map((k) => TILES[k].data))];
  const datasets = {};
  let live = 0;
  for (const kind of needed) {
    if (!has('demo')) {
      try {
        datasets[kind] = await FETCHERS[kind](USER, process.env.GITHUB_TOKEN);
        live += 1;
        continue;
      } catch (err) {
        console.warn(`  ! ${kind} fetch failed (${err.message}); using synthetic data`);
      }
    }
    datasets[kind] = kind === 'calendar' ? demoData() : demoProfile();
  }
  const source = live === needed.length ? `live data for @${USER}`
    : live === 0 ? 'synthetic data' : `partly live data for @${USER}`;

  // Inline the cover so the page makes no external requests. Falls back to
  // plain type if the asset is missing, rather than failing the build.
  let cover;
  try {
    cover = `<div class="cover">${inline(await readFile(resolve('assets/cover.svg'), 'utf8'))}</div>`;
  } catch {
    cover = '<h1>gitmatrix</h1>\n  <p class="tag">Self-hosted SVG tiles for GitHub profile READMEs.</p>';
  }

  const foot = (extra = '') =>
    `${extra}<a href="https://github.com/${REPO}">${esc(REPO)}</a> \u00b7 MIT`;

  // ---- showcase ----
  const home = page({
    title: 'gitmatrix \u2014 SVG tiles for GitHub profile READMEs',
    description: 'A component library of customizable SVG tiles for GitHub profile READMEs. Zero dependencies, no token, CDN-delivered.',
    header: `<header>
  ${cover}
  <div class="badges">
    <span class="badge">${keys.length} component${keys.length === 1 ? '' : 's'}</span>
    <span class="badge">${Object.keys(THEMES).length} themes</span>
    <span class="badge">zero dependencies</span>
    <span class="badge">no token required</span>
  </div>
  ${nav('home', keys)}
</header>`,
    body: keys.map((k) => showcaseSection(k, TILES[k], datasets[TILES[k].data])).join('\n\n'),
    footer: foot(`Previews rendered with ${esc(source)} \u00b7 `),
  });

  // ---- docs ----
  const themeRows = Object.entries(THEMES)
    .map(([name, t]) => `<tr><td><code>${esc(name)}</code></td><td><code>${esc(t.fg)}</code> on <code>${esc(t.bg)}</code></td></tr>`)
    .join('\n');

  const docs = page({
    title: 'gitmatrix \u2014 documentation',
    description: 'Reference documentation for gitmatrix: delivery, theming, options and adding a tile.',
    header: `<header>
  <h1>documentation</h1>
  <p class="tag">Delivery, theming, per-component options, and adding a component.</p>
  ${nav('docs', keys)}
</header>`,
    body: `<section id="start">
  <h2>Getting started</h2>
  <p class="summary">Two ways to serve a tile. Pick by whether anyone other than
  you needs to request it.</p>

  <h3>Static, from a CDN</h3>
  <p class="label">Recommended. A scheduled Action renders the tiles, commits
  them to a <code>tiles</code> branch, and a CDN serves them as static files.
  No server, no quota, nothing that can be switched off.</p>
  ${code(`<img src="https://cdn.jsdelivr.net/gh/${REPO}@tiles/activity.svg" width="100%" />`)}
  <ul>
    <li>Edit <code>gitmatrix.json</code> to list the tiles you want.</li>
    <li>Run the <strong>Build tiles</strong> workflow.</li>
    <li>No secrets required.</li>
  </ul>

  <h3>Rendered on demand</h3>
  <p class="label">Only needed when you want <code>?username=anyone</code>
  resolved at request time. Deploy the repo to any Node host; no environment
  variables are required.</p>
  ${code(`<img src="https://YOUR-APP.vercel.app/api/activity?username=${USER}" width="100%" />`)}

  <h3>Where the data comes from</h3>
  <ul>
    <li><code>calendar</code> &mdash; the public contributions page. No token.</li>
    <li><code>profile</code> &mdash; two unauthenticated REST calls.</li>
  </ul>
  <p class="label">Tiles sharing a source share one fetch, so the full set costs
  ${needed.length} request${needed.length === 1 ? '' : 's'} against a 60/hour
  unauthenticated budget.</p>
</section>

<section id="theming">
  <h2>Theming</h2>
  <p class="summary">Every token is independently overridable, so a preset is a
  starting point rather than a fixed look.</p>
  <table><thead><tr><th>preset</th><th>foreground / background</th></tr></thead>
  <tbody>${themeRows}</tbody></table>
  <h3>Per-token overrides</h3>
  <table><thead><tr><th>param</th><th>controls</th></tr></thead><tbody>
    <tr><td><code>color</code></td><td>lines, headings, gridlines</td></tr>
    <tr><td><code>bg</code></td><td>background</td></tr>
    <tr><td><code>area</code></td><td>area fill</td></tr>
    <tr><td><code>border</code></td><td>frame stroke, defaults to <code>color</code></td></tr>
    <tr><td><code>muted</code></td><td>axis and footer text, defaults to <code>color</code></td></tr>
  </tbody></table>
  ${code('?theme=nord&color=00FF41&area=003311')}
  <p class="label">Colours are 3, 4, 6 or 8 hex digits, with or without
  <code>#</code>. Anything else falls back to the theme value, so a malformed
  colour can never reach the output.</p>
</section>

<section id="resolution">
  <h2>Resolution and smoothing</h2>
  <p class="summary">Grouping matters more than smoothing.</p>
  <p class="label">A year at daily resolution is about 370 points. On an 800px
  chart that is roughly 2px per point, and no amount of smoothing is visible
  &mdash; the curve renders as a picket fence. <code>group=week</code> gives
  ~53 points and <code>group=month</code> ~13, which is where a curve reads as
  a curve. Weekly is the default.</p>
  <p class="label">Grouping changes resolution only: the total is preserved
  exactly, and the test suite asserts that across all three modes.</p>
  <h3>Smoothing</h3>
  <p class="label">The curve is a monotone cubic Hermite spline, not
  Catmull-Rom. Catmull-Rom costs the same to write but overshoots around local
  extrema, which on contribution data means the curve dips below zero after a
  spike and the area fill paints under the baseline. Measured on a spike series
  bounded to <code>[10, 100]</code>:</p>
  <table><thead><tr><th>method</th><th>rendered y range</th></tr></thead><tbody>
    <tr><td>monotone cubic</td><td><code>[10.00, 100.00]</code> &mdash; bounded</td></tr>
    <tr><td>Catmull-Rom</td><td><code>[10.00, 106.65]</code> &mdash; 6.65px past the baseline</td></tr>
  </tbody></table>
  <p class="label">The suite samples the emitted B&eacute;zier curves and
  asserts the path stays inside the data range at every smoothing level.</p>
</section>

<section id="components-ref">
  <h2>Components</h2>
  <p class="summary">Every tile also accepts <code>theme</code>,
  <code>title</code>, <code>border</code>, <code>radius</code> and
  <code>width</code>. Out-of-range values clamp to the nearest bound;
  unparseable values fall back to the default, so a bad query degrades to a
  working tile rather than an error.</p>
</section>

${keys.map((k) => docsSection(k, TILES[k])).join('\n\n')}

<section id="adding">
  <h2>Adding a component</h2>
  <p class="summary">Three steps. No routing changes &mdash; the API route, the
  static build and both pages of this site all read the registry.</p>
  <h4>1. A data source, if nothing else provides it</h4>
  ${code(`// lib/github.js
export const FETCHERS = {
  async mySource(login, token) { /* ... */ },
};`)}
  <h4>2. The tile</h4>
  ${code(`// lib/tiles/mytile.js
export const options = { width: 'px, 320-1600 (default 800)' };

export function render(data, theme, q) {
  return tile({ /* ... */ });
}`)}
  <p class="label"><code>render</code> must be pure &mdash; data in, string out,
  no IO. That is what lets the suite test every component without a token or a
  network.</p>
  <h4>3. The registry</h4>
  ${code(`// lib/tiles/index.js
export const TILES = {
  mytile: {
    slug: 'mytile',
    summary: 'What it shows',
    data: 'mySource',
    options: mytile.options,
    render: mytile.render,
  },
};`)}
  <p class="label">The suite then checks it automatically: the slug matches its
  key, <code>render</code> is a function, the declared data source has a
  fetcher, options are documented, and the tile renders across all
  ${Object.keys(THEMES).length} themes, on empty data, and with an injected
  title.</p>
</section>`,
    footer: foot(),
  });

  await mkdir(resolve(outDir, 'docs'), { recursive: true });
  await writeFile(resolve(outDir, 'index.html'), home, 'utf8');
  await writeFile(resolve(outDir, 'docs/index.html'), docs, 'utf8');
  // Without this, Pages runs the output through Jekyll and drops files that
  // begin with an underscore.
  await writeFile(resolve(outDir, '.nojekyll'), '', 'utf8');

  console.log(`  index.html       ${String(home.length).padStart(7)} bytes  (${keys.length} components, ${source})`);
  console.log(`  docs/index.html  ${String(docs.length).padStart(7)} bytes`);
  console.log(`\nwrote site to ${outDir}`);
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(1);
});
