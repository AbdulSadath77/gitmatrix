// Tile registry. Adding a tile means adding one entry here -- the API route
// and the gallery both read from this map, so neither needs editing.

import * as activity from './activity.js';

/**
 * @typedef {object} Tile
 * @property {string} slug         URL segment: /api/<slug>
 * @property {string} summary      one line, for the gallery
 * @property {'calendar'} data     which fetcher feeds it
 * @property {Record<string,string>} options
 * @property {(data:any, theme:any, q:any)=>string} render
 */

/** @type {Record<string, Tile>} */
export const TILES = {
  activity: {
    slug: 'activity',
    summary: 'Daily contributions as a smooth area + line chart',
    data: 'calendar',
    options: activity.options,
    render: activity.render,
  },
};

export const slugs = Object.keys(TILES);
