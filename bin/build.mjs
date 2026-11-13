#!/usr/bin/env node
// Static build: render tiles to SVG files for CDN delivery.
//
// The same tiles that api/[tile].js serves per-request are written to disk
// here, so a profile needs no running server at all -- a scheduled Action
// commits the output and a CDN serves it. Each config entry uses exactly the
// query params the HTTP API accepts, so there is one mental model for both.
//
//   node bin/build.mjs                  # uses ./gitmatrix.json
//   node bin/build.mjs --config x.json
//   node bin/build.mjs --demo           # synthetic data, no token needed
//   node bin/build.mjs --out public

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { FETCHERS } from '../lib/github.js';
import { resolveTheme } from '../lib/theme.js';
import { TILES, slugs } from '../lib/tiles/index.js';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

/** Synthetic year of contributions, so --demo runs with no token or network. */
function demoData() {
  return Array.from({ length: 365 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    count: Math.max(0, Math.round(7 + 6 * Math.sin(i / 11) + (i % 23 === 0 ? 12 : 0))),
  }));
}

async function main() {
  const configPath = resolve(flag('config', 'gitmatrix.json'));
  let config;
  try {
    config = JSON.parse(await readFile(configPath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`no config at ${configPath}\nsee gitmatrix.json in the repo for the format`);
      process.exit(1);
    }
    console.error(`could not parse ${configPath}: ${err.message}`);
    process.exit(1);
  }

  const demo = has('demo');
  const outDir = resolve(flag('out', config.out ?? 'dist'));
  const username = flag('username', config.username);
  const entries = config.tiles ?? [];

  if (!entries.length) {
    console.error('config lists no tiles');
    process.exit(1);
  }
  if (!demo && !username) {
    console.error('config needs a "username" (or pass --username)');
    process.exit(1);
  }

  const token = process.env.GITHUB_TOKEN;
  if (!demo && !token) {
    console.error('GITHUB_TOKEN is not set (or pass --demo for synthetic data)');
    process.exit(1);
  }

  // Tiles sharing a data source share one fetch.
  const cache = new Map();
  const load = async (kind) => {
    if (!cache.has(kind)) {
      cache.set(kind, demo ? demoData() : await FETCHERS[kind](username, token));
    }
    return cache.get(kind);
  };

  let written = 0;
  for (const [i, entry] of entries.entries()) {
    const def = TILES[String(entry.tile ?? '').toLowerCase()];
    if (!def) {
      console.error(`tiles[${i}]: unknown tile "${entry.tile}" (available: ${slugs.join(', ')})`);
      process.exit(1);
    }
    const file = entry.file ?? `${def.slug}.svg`;
    const target = join(outDir, file);

    const svg = def.render(await load(def.data), resolveTheme(entry), entry);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, svg, 'utf8');

    console.log(`  ${file.padEnd(28)} ${String(svg.length).padStart(7)} bytes  (${def.slug})`);
    written++;
  }

  console.log(`\nwrote ${written} tile${written === 1 ? '' : 's'} to ${outDir}${demo ? ' [demo data]' : ''}`);
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(1);
});
