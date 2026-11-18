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

import { existsSync } from 'node:fs';
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

  // Optional, and unset in CI by design. Both sources are public: `calendar`
  // reads the contributions page, `profile` uses unauthenticated REST.
  const token = process.env.GITHUB_TOKEN;

  // Tiles sharing a data source share one fetch -- the promise is cached, so a
  // failing source costs one attempt rather than one per tile that uses it.
  // That matters against a 60/hr budget shared with every other runner.
  const cache = new Map();
  const load = (kind) => {
    if (!cache.has(kind)) {
      cache.set(kind, demo ? Promise.resolve(demoData()) : FETCHERS[kind](username, token));
    }
    return cache.get(kind);
  };

  let written = 0;
  let kept = 0;
  for (const [i, entry] of entries.entries()) {
    const def = TILES[String(entry.tile ?? '').toLowerCase()];
    if (!def) {
      console.error(`tiles[${i}]: unknown tile "${entry.tile}" (available: ${slugs.join(', ')})`);
      process.exit(1);
    }
    const file = entry.file ?? `${def.slug}.svg`;
    const target = join(outDir, file);

    let data;
    try {
      data = await load(def.data);
    } catch (err) {
      // An existing file here was seeded from the last publish, so a tile
      // whose source is briefly unreachable keeps serving a slightly stale
      // render. Without one there is nothing to serve, and a missing file
      // would mean a broken image in someone's README -- so that still fails.
      if (!existsSync(target)) {
        console.error(`${def.slug}: ${err.message}`);
        process.exit(1);
      }
      console.warn(`  ${file.padEnd(28)} ${'kept'.padStart(7)}       (${def.slug}: ${err.message})`);
      kept++;
      continue;
    }

    const svg = def.render(data, resolveTheme(entry), entry);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, svg, 'utf8');

    console.log(`  ${file.padEnd(28)} ${String(svg.length).padStart(7)} bytes  (${def.slug})`);
    written++;
  }

  const summary = kept ? `wrote ${written}, kept ${kept}` : `wrote ${written} tile${written === 1 ? '' : 's'}`;
  console.log(`\n${summary} to ${outDir}${demo ? ' [demo data]' : ''}`);
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(1);
});
