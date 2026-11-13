// Themes are plain token maps. Every token is independently overridable by
// query param, so a theme is just a convenient starting point rather than a
// fixed look.

import { hexColor } from './validate.js';

/** @typedef {{fg:string,bg:string,area:string,border:string,muted:string}} Theme */

/** @type {Record<string, Theme>} */
export const THEMES = {
  matrix: { fg: '#00FF41', bg: '#0D1117', area: '#003311', border: '#00FF41', muted: '#00FF41' },
  amber: { fg: '#FFB000', bg: '#0D0B06', area: '#3A2600', border: '#FFB000', muted: '#FFB000' },
  ice: { fg: '#7DF9FF', bg: '#06101A', area: '#06303A', border: '#7DF9FF', muted: '#7DF9FF' },
  dracula: { fg: '#BD93F9', bg: '#282A36', area: '#44475A', border: '#BD93F9', muted: '#F8F8F2' },
  nord: { fg: '#88C0D0', bg: '#2E3440', area: '#3B4252', border: '#88C0D0', muted: '#ECEFF4' },
  rose: { fg: '#FF5C8A', bg: '#17090F', area: '#45111F', border: '#FF5C8A', muted: '#FF5C8A' },
  mono: { fg: '#E6EDF3', bg: '#0D1117', area: '#21262D', border: '#E6EDF3', muted: '#8B949E' },
};

export const DEFAULT_THEME = 'matrix';

/**
 * Resolve a theme from a query object. Unknown theme names fall back to the
 * default rather than erroring, so a typo degrades to a working tile.
 *
 * Per-token overrides: `color` (fg), `bg`, `area`, `border`, `muted`.
 */
export function resolveTheme(q = {}) {
  const base = THEMES[String(q.theme ?? '').toLowerCase()] ?? THEMES[DEFAULT_THEME];
  return {
    fg: hexColor(q.color, base.fg),
    bg: hexColor(q.bg, base.bg),
    area: hexColor(q.area, base.area),
    border: hexColor(q.border, hexColor(q.color, base.border)),
    muted: hexColor(q.muted, hexColor(q.color, base.muted)),
  };
}
