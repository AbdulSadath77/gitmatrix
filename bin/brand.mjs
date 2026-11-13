#!/usr/bin/env node
// Generates assets/logo.svg and assets/cover.svg.
//
// The curves are drawn by lib/curve.js, the same monotone cubic code the tiles
// use, so the branding is literally produced by the library it advertises.
// Committed as static files; rerun only when the brand changes.
//
//   node bin/brand.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { areaPath, curvePath } from '../lib/curve.js';

const FG = '#00FF41';
const BG = '#0D1117';
const AREA = '#003311';
const DIM = '#8b949e';
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';

/** Map a value series into plot coordinates. */
function plot(vals, x0, y0, w, h) {
  const peak = Math.max(...vals);
  const low = Math.min(...vals);
  const span = peak - low || 1;
  const step = w / (vals.length - 1);
  return vals.map((v, i) => [x0 + i * step, y0 + h - ((v - low) / span) * h]);
}

/** Faint contribution-grid texture. */
function grid(x0, y0, cols, rows, cell, gap, op) {
  let out = '';
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const level = (Math.sin(c * 0.55 + r * 1.1) + 1) / 2;
      const x = (x0 + c * (cell + gap)).toFixed(1);
      const y = (y0 + r * (cell + gap)).toFixed(1);
      const o = (op * (0.2 + level * 0.8)).toFixed(3);
      out += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="1" fill="${FG}" fill-opacity="${o}"/>`;
    }
  }
  return out;
}

const GLOW =
  '<filter id="g" x="-30%" y="-60%" width="160%" height="220%">' +
  '<feGaussianBlur stdDeviation="3.2" result="b"/>' +
  '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';

// `textLength` with `lengthAdjust` pins each string to an exact width, so the
// layout holds even where the viewer has none of the listed monospace fonts.
const text = (x, y, s, { size, fill, len, weight = '400', opacity = '1', glow = false }) =>
  `<text x="${x}" y="${y}" fill="${fill}" font-family="${MONO}" font-size="${size}"` +
  ` font-weight="${weight}" text-anchor="middle" textLength="${len}"` +
  ` lengthAdjust="spacingAndGlyphs" opacity="${opacity}"` +
  `${glow ? ' filter="url(#g)"' : ''}>${s}</text>`;

function logo() {
  const pts = plot([2, 4, 3, 7, 11, 8, 13, 17, 14, 21], 26, 44, 76, 44);
  const line = curvePath(pts, 1);
  const [lastX, lastY] = pts.at(-1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="gitmatrix">
  <defs>${GLOW}</defs>
  <rect width="128" height="128" rx="26" fill="${BG}"/>
  <rect x="1" y="1" width="126" height="126" rx="25" fill="none" stroke="${FG}" stroke-opacity="0.3" stroke-width="2"/>
  <g>${grid(26, 26, 10, 8, 6, 2.2, 0.1)}</g>
  <path d="${areaPath(line, pts[0][0], lastX, 88)}" fill="${AREA}" fill-opacity="0.9"/>
  <path d="${line}" fill="none" stroke="${FG}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#g)"/>
  <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="6" fill="${FG}" filter="url(#g)"/>
  ${text(64, 113, 'gm', { size: 15, fill: FG, len: 62, weight: '700' })}
</svg>
`;
}

function cover() {
  // The curve is confined to a bottom band. An earlier version ran it through
  // the middle and it crossed the badge line, making the text unreadable.
  const pts = plot([6, 9, 7, 13, 11, 18, 23, 17, 26, 21, 30, 37, 32, 43, 39, 51], 0, 312, 1200, 66);
  const line = curvePath(pts, 1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400" role="img" aria-label="gitmatrix - self-hosted SVG tiles for GitHub profile READMEs">
  <defs>${GLOW}
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${FG}" stop-opacity="0.26"/>
      <stop offset="1" stop-color="${FG}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${FG}" stop-opacity="0"/>
      <stop offset="0.5" stop-color="${FG}" stop-opacity="0.5"/>
      <stop offset="1" stop-color="${FG}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="400" rx="14" fill="${BG}"/>

  <!-- bottom band: grid texture + curve, kept clear of all type -->
  <g>${grid(24, 300, 74, 6, 9, 6, 0.07)}</g>
  <path d="${areaPath(line, 0, 1200, 400)}" fill="url(#fade)"/>
  <path d="${line}" fill="none" stroke="${FG}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" filter="url(#g)"/>

  <!-- type block -->
  ${text(600, 96, '\u25C8 COMPONENTS \u25C8', { size: 13, fill: FG, len: 150, opacity: '0.75' })}
  ${text(600, 186, 'gitmatrix', { size: 84, fill: FG, len: 548, weight: '700', glow: true })}
  <rect x="420" y="208" width="360" height="1" fill="url(#rule)"/>
  ${text(600, 244, 'self-hosted SVG tiles for GitHub profile READMEs', { size: 18, fill: '#E6EDF3', len: 560 })}
  ${text(600, 278, 'ZERO DEPENDENCIES \u00B7 NO TOKEN \u00B7 CDN DELIVERED \u00B7 7 THEMES', { size: 14, fill: DIM, len: 600 })}

  <rect x="1" y="1" width="1198" height="398" rx="14" fill="none" stroke="${FG}" stroke-opacity="0.22"/>
</svg>
`;
}

const outDir = resolve('assets');
await mkdir(outDir, { recursive: true });
for (const [name, svg] of [['logo.svg', logo()], ['cover.svg', cover()]]) {
  await writeFile(resolve(outDir, name), svg, 'utf8');
  console.log(`  ${name.padEnd(12)} ${String(svg.length).padStart(6)} bytes`);
}
console.log(`\nwrote brand assets to ${outDir}`);
