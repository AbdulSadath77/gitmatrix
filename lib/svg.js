// Shared chrome every tile sits inside, so tiles only draw their own content.
//
// Escaping contract: `title`, `footer` and `body` arrive ALREADY ESCAPED.
// Escaping is owned by the trust boundary in validate.js -- escaping again
// here would turn "&lt;" into "&amp;lt;" and render the entities literally.

/**
 * @param {object} o
 * @param {number} o.width
 * @param {number} o.height
 * @param {import('./theme.js').Theme} o.theme
 * @param {string} [o.title] pre-escaped
 * @param {string} [o.footer] pre-escaped
 * @param {boolean} [o.border]
 * @param {number} [o.radius]
 * @param {string} o.body raw SVG markup produced by a tile
 */
export function tile({ width, height, theme, title, footer, border = true, radius = 6, body }) {
  const heading = title
    ? `<text x="${width / 2}" y="30" fill="${theme.fg}" font-size="15" font-weight="600"
         text-anchor="middle" font-family="monospace">${title}</text>`
    : '';
  const foot = footer
    ? `<text x="${width / 2}" y="${height - 12}" fill="${theme.muted}" fill-opacity="0.45"
         font-size="10" text-anchor="middle" font-family="monospace">${footer}</text>`
    : '';
  const frame = border
    ? `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${radius}"
         fill="none" stroke="${theme.border}" stroke-opacity="0.25"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"
    viewBox="0 0 ${width} ${height}" role="img" aria-label="${title || 'gitmatrix tile'}">
  <rect width="${width}" height="${height}" rx="${radius}" fill="${theme.bg}"/>
  ${frame}${heading}${body}${foot}
</svg>`;
}

/** Centred message, for empty and error states. `body` must be pre-escaped. */
export function message(body, { width, height, theme, radius = 6 }) {
  return tile({
    width, height, theme, radius,
    body: `<text x="${width / 2}" y="${height / 2}" fill="${theme.fg}" font-size="13"
             text-anchor="middle" dominant-baseline="middle"
             font-family="monospace">${body}</text>`,
  });
}
