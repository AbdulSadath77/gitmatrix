#!/usr/bin/env node
// Builds the public gallery -> site/index.html
//
// Everything on the page is generated from the tile registry: the component
// list, the options tables, the copy-paste snippets. Adding a tile updates the
// docs with no edit here, and the suite fails if a registered tile is missing
// from the output -- so the published docs cannot drift from the code.
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

function demoData() {
  return Array.from({ length: 365 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    count: Math.max(0, Math.round(7 + 6 * Math.sin(i / 11) + (i % 23 === 0 ? 12 : 0))),
  }));
}

/** Strip the outer <svg> wrapper so previews inline cleanly into the page. */
const inline = (svg) => svg.replace(/\swidth="\d+"\s+height="\d+"/, ' width="100%"');

function optionsTable(options) {
  const rows = Object.entries(options)
    .map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(v)}</td></tr>`)
    .join('\n');
  return `<table><thead><tr><th>option</th><th>accepts</th></tr></thead><tbody>
${rows}
</tbody></table>`;
}

function section(key, def, data) {
  const theme = resolveTheme({ theme: 'matrix' });
  const hero = def.render(data, theme, {
    title: `◈ ${key.toUpperCase()} ◈`,
    width: 900,
    height: 300,
  });

  const recent = data.slice(-90);
  const themeStrip = Object.keys(THEMES)
    .map((name) => {
      const svg = def.render(recent, resolveTheme({ theme: name }), {
        title: name.toUpperCase(),
        width: 440,
        height: 190,
      });
      return `<figure>${inline(svg)}<figcaption>?theme=${esc(name)}</figcaption></figure>`;
    })
    .join('\n');

  // Only tiles that document a `smoothing` option get the smoothing strip.
  const smoothStrip = 'smoothing' in def.options
    ? ['0', '0.5', '1']
        .map((s) => {
          const svg = def.render(recent, theme, {
            title: `SMOOTHING ${s}`,
            smoothing: s,
            width: 440,
            height: 190,
          });
          return `<figure>${inline(svg)}<figcaption>?smoothing=${s}</figcaption></figure>`;
        })
        .join('\n')
    : '';

  return `<section id="${esc(key)}">
  <h2>${esc(key)}</h2>
  <p class="summary">${esc(def.summary)}</p>

  <div class="hero">${inline(hero)}</div>

  <h3>Use it</h3>
  <p class="label">Static, from the CDN — no server:</p>
  <pre><code>&lt;img src="https://cdn.jsdelivr.net/gh/${esc(REPO)}@tiles/${esc(key)}.svg" width="100%" /&gt;</code></pre>
  <p class="label">Or rendered on demand, if you deploy the function:</p>
  <pre><code>&lt;img src="https://YOUR-APP.vercel.app/api/${esc(key)}?username=${esc(USER)}" width="100%" /&gt;</code></pre>

  <h3>Options</h3>
  ${optionsTable(def.options)}

  <h3>Themes</h3>
  <div class="grid">${themeStrip}</div>
  ${smoothStrip ? `<h3>Smoothing</h3>\n  <div class="grid">${smoothStrip}</div>` : ''}
</section>`;
}

const CSS = `
:root{--fg:#00FF41;--bg:#0D1117;--dim:#7d8590;--line:rgba(0,255,65,.18);--panel:#0b0f14}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:#E6EDF3;
  font:15px/1.65 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.wrap{max-width:980px;margin:0 auto;padding:0 20px 80px}
header{border-bottom:1px solid var(--line);padding:40px 0 32px;margin-bottom:8px}
.cover{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--panel)}
h1{margin:0;font-size:38px;letter-spacing:-.5px;color:var(--fg)}
.tag{color:var(--dim);margin:10px 0 0}
.badges{margin-top:18px;display:flex;gap:8px;flex-wrap:wrap}
.badge{border:1px solid var(--line);color:var(--fg);padding:3px 10px;border-radius:999px;font-size:12px}
nav{margin:26px 0 0;display:flex;gap:8px;flex-wrap:wrap}
nav a{color:var(--fg);text-decoration:none;border:1px solid var(--line);
  padding:5px 12px;border-radius:4px;font-size:13px}
nav a:hover{background:rgba(0,255,65,.08)}
section{border-top:1px solid var(--line);padding-top:40px;margin-top:48px}
h2{color:var(--fg);font-size:25px;margin:0 0 6px}
h3{color:var(--fg);font-size:14px;letter-spacing:.14em;text-transform:uppercase;
  margin:36px 0 12px;font-weight:600}
.summary{color:var(--dim);margin:0 0 24px}
.label{color:var(--dim);font-size:13px;margin:16px 0 6px}
.hero{border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--panel)}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
figure{margin:0;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--panel)}
figcaption{color:var(--dim);font-size:12px;padding:8px 12px;border-top:1px solid var(--line)}
pre{background:var(--panel);border:1px solid var(--line);border-radius:6px;
  padding:13px 15px;overflow-x:auto;margin:0 0 10px}
code{color:var(--fg);font-size:13px}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th{text-align:left;color:var(--fg);border-bottom:1px solid var(--line);padding:9px 10px;
  font-size:12px;letter-spacing:.1em;text-transform:uppercase}
td{border-bottom:1px solid rgba(125,133,144,.14);padding:9px 10px;vertical-align:top}
td:first-child{white-space:nowrap;width:150px}
a{color:var(--fg)}
footer{border-top:1px solid var(--line);margin-top:56px;padding-top:26px;color:var(--dim);font-size:13px}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

async function main() {
  const outDir = resolve(flag('out', 'site'));
  const keys = Object.keys(TILES);

  // Real data when reachable, synthetic otherwise, so the gallery always
  // builds -- a docs page must not fail because a network call did.
  let data;
  let source;
  if (has('demo')) {
    data = demoData();
    source = 'synthetic data';
  } else {
    try {
      data = await FETCHERS.calendar(USER, process.env.GITHUB_TOKEN);
      source = `live data for @${USER}`;
    } catch (err) {
      console.warn(`  ! live fetch failed (${err.message}); using synthetic data`);
      data = demoData();
      source = 'synthetic data';
    }
  }

  const sections = keys.map((k) => section(k, TILES[k], data)).join('\n\n');
  const navLinks = keys.map((k) => `<a href="#${esc(k)}">${esc(k)}</a>`).join('\n    ');

  // Inline the cover so the page still makes no external requests. Falls back
  // to plain type if the asset is missing, rather than failing the build.
  let cover;
  try {
    cover = `<div class="cover">${inline(await readFile(resolve('assets/cover.svg'), 'utf8'))}</div>`;
  } catch {
    cover = '<h1>gitmatrix</h1>\n  <p class="tag">Self-hosted SVG tiles for GitHub profile READMEs.</p>';
  }

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>gitmatrix — self-hosted SVG tiles for GitHub profiles</title>
<meta name="description" content="A component library of customizable SVG tiles for GitHub profile READMEs. Zero dependencies, no token, CDN-delivered.">
<meta property="og:title" content="gitmatrix">
<meta property="og:description" content="Self-hosted SVG tiles for GitHub profile READMEs.">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
<header>
  ${cover}
  <div class="badges">
    <span class="badge">${keys.length} component${keys.length === 1 ? '' : 's'}</span>
    <span class="badge">${Object.keys(THEMES).length} themes</span>
    <span class="badge">zero dependencies</span>
    <span class="badge">no token required</span>
  </div>
  <nav>
    ${navLinks}
    <a href="https://github.com/${esc(REPO)}">source →</a>
  </nav>
</header>

<section id="start" style="border-top:0;padding-top:34px;margin-top:0">
  <h2>Why self-hosted</h2>
  <p class="summary">Most profile-tile services are one volunteer's Vercel project
  serving images for thousands of other people's profiles. That ends as
  <code>402 Payment Required</code> when the free tier runs out — the code is fine,
  the hosting economics are not. gitmatrix is deployed per user, so you serve only
  your own profile.</p>
  <p class="label">The recommended path needs no server at all. A scheduled Action
  renders the tiles, commits them to a <code>tiles</code> branch, and a CDN serves
  them as static files:</p>
  <pre><code>&lt;img src="https://cdn.jsdelivr.net/gh/${esc(REPO)}@tiles/activity.svg" width="100%" /&gt;</code></pre>
  <p class="label">Contribution data comes from the public
  <code>github.com/users/&lt;login&gt;/contributions</code> endpoint, so no PAT and no
  secret are needed.</p>
</section>

${sections}

<footer>
  Previews rendered with ${esc(source)} ·
  <a href="https://github.com/${esc(REPO)}#adding-a-tile">add a tile</a> ·
  <a href="https://github.com/${esc(REPO)}">${esc(REPO)}</a> · MIT
</footer>
</div>
</body>
</html>
`;

  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, 'index.html'), html, 'utf8');
  // Pages would otherwise run the output through Jekyll and drop files that
  // begin with an underscore.
  await writeFile(resolve(outDir, '.nojekyll'), '', 'utf8');

  console.log(`  index.html  ${String(html.length).padStart(7)} bytes  (${keys.length} tiles, ${source})`);
  console.log(`\nwrote gallery to ${outDir}`);
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(1);
});
