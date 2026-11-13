// Tile registry. Adding a tile means adding one entry here -- the API route,
// the static build and the gallery all read from this map, so none of them
// need editing.

import * as activity from './activity.js';
import * as calendar from './calendar.js';
import * as languages from './languages.js';
import * as stats from './stats.js';
import * as streak from './streak.js';

/**
 * @typedef {object} Tile
 * @property {string} slug            URL segment: /api/<slug>
 * @property {string} summary         one line, for the gallery
 * @property {'calendar'|'profile'} data  which fetcher feeds it
 * @property {string} [replaces]      the third-party service it stands in for
 * @property {Record<string,string>} options
 * @property {(data:any, theme:any, q:any)=>string} render
 */

/** @type {Record<string, Tile>} */
export const TILES = {
  activity: {
    slug: 'activity',
    summary: 'Daily, weekly or monthly contributions as a smooth area + line chart',
    data: 'calendar',
    replaces: 'github-readme-activity-graph (402)',
    options: activity.options,
    render: activity.render,
  },
  calendar: {
    slug: 'calendar',
    summary: 'The contribution grid, one column per week',
    data: 'calendar',
    replaces: 'ghchart.rshah.org',
    options: calendar.options,
    render: calendar.render,
  },
  streak: {
    slug: 'streak',
    summary: 'Total contributions, current streak and longest streak',
    data: 'calendar',
    replaces: 'github-readme-streak-stats',
    options: streak.options,
    render: streak.render,
  },
  languages: {
    slug: 'languages',
    summary: 'Language split across public repositories, as a stacked bar',
    data: 'profile',
    replaces: 'github-readme-stats/top-langs (503)',
    options: languages.options,
    render: languages.render,
  },
  stats: {
    slug: 'stats',
    summary: 'Repositories, stars, forks, followers and account age',
    data: 'profile',
    replaces: 'github-readme-stats (503)',
    options: stats.options,
    render: stats.render,
  },
};

export const slugs = Object.keys(TILES);
