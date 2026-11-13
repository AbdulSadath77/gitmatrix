// One dynamic route serves every tile: /api/activity, /api/<next tile>, ...
// New tiles need no change here, only a registry entry.

import { TILES, slugs } from '../lib/tiles/index.js';
import { FETCHERS } from '../lib/github.js';
import { resolveTheme } from '../lib/theme.js';
import { isUser, int } from '../lib/validate.js';

export default async function handler(req, res) {
  const q = req.query ?? {};
  const tile = TILES[String(q.tile ?? '').toLowerCase()];

  if (!tile) {
    res.status(404).json({ error: 'unknown tile', available: slugs });
    return;
  }
  if (!isUser(q.username)) {
    res.status(400).json({ error: 'username must be 1-39 chars of [A-Za-z0-9-]' });
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'GITHUB_TOKEN env var is not set' });
    return;
  }

  try {
    const data = await FETCHERS[tile.data](q.username, token);
    const svg = tile.render(data, resolveTheme(q), q);

    // Shared-cache for 2h by default (clamped 5m-24h). Vercel's edge and
    // GitHub's camo proxy both honour this, so repeat views do not invoke the
    // function. This is the control that keeps a popular tile inside the free
    // tier instead of ending at HTTP 402.
    const ttl = int(q.ttl, 7200, 300, 86400);

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=86400`);
    res.status(200).send(svg);
  } catch (err) {
    res.status(502).json({ error: String(err?.message ?? err) });
  }
}
