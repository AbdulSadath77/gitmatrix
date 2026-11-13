// Trust boundary. Every value here arrives from a public query string, so
// nothing is assumed about type, range, or content.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

/** Escape before interpolating into SVG markup. */
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

/** GitHub usernames: 1-39 chars of alphanumerics and hyphens. */
export const isUser = (s) => /^[A-Za-z0-9-]{1,39}$/.test(String(s ?? ''));

/** `#` + 3/4/6/8 hex digits, else the fallback. Never echoes bad input. */
export function hexColor(value, fallback) {
  const v = String(value ?? '').replace(/^#/, '');
  return /^(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v) ? `#${v}` : fallback;
}

/** Integer clamped to [min, max]; non-numeric input yields the fallback. */
export function int(value, fallback, min, max) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Float clamped to [min, max]; non-numeric input yields the fallback. */
export function num(value, fallback, min, max) {
  const n = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Query-string booleans: absent means fallback, `false`/`0`/`no` are false. */
export function bool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return !/^(?:false|0|no|off)$/i.test(String(value));
}

/** Escaped and length-capped free text. */
export const text = (value, max = 80) =>
  typeof value === 'string' ? esc(value.slice(0, max)) : '';
