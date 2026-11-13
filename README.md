<div align="center">

<img src="assets/cover.svg" alt="gitmatrix — self-hosted SVG tiles for GitHub profile READMEs" width="100%" />

### [Components](https://abdulsadath77.github.io/gitmatrix/) · [Documentation](https://abdulsadath77.github.io/gitmatrix/docs/)

</div>

---

## Why self-hosted

A shared tile service is one person's hosting account answering image requests
for thousands of other people's profiles. When that account hits its free-tier
limit the images stop loading everywhere at once, and nobody using them can do
anything about it.

gitmatrix inverts that. It is deployed **per user**, so you serve only your own
profile and own the thing your README depends on. The recommended path removes
the server entirely: a scheduled Action renders the tiles, commits them, and a
CDN serves static files. Nothing to run out of, nothing to switch off.

## Quick start

```bash
git clone https://github.com/AbdulSadath77/gitmatrix
cd gitmatrix
node test.mjs          # no token or network needed
node test.mjs --write  # emits demo SVGs
```

Render tiles to files without a token or a network:

```bash
node bin/build.mjs --demo
```

## Delivery

Two transports, same tiles, same options. Pick by whether anyone other than you
needs to query them.

### Static + CDN — recommended for your own profile

Your username and theme never change; only the data does, once a day. So there
is nothing to render per-request. A scheduled Action renders the SVGs, commits
them to a `tiles` branch, and a CDN serves them. **No server, no quota, no
a quota to exhaust — structurally.**

Setup — **no secrets required**:

1. Edit `gitmatrix.json` to list the tiles you want.
2. Run the **Build tiles** workflow.

Contribution data comes from the public `github.com/users/<login>/contributions`
endpoint, the same source `Platane/snk` reads — which is why a snake workflow
runs with nothing configured. Set a `TILES_TOKEN` secret only if you would
rather go through the GraphQL API, which cannot be reshaped by a GitHub
frontend change.

Then embed from whichever CDN you prefer. All three serve `image/svg+xml`
correctly (measured):

| Source | URL | `Cache-Control` |
|---|---|---|
| jsDelivr | `cdn.jsdelivr.net/gh/USER/gitmatrix@tiles/activity.svg` | `max-age=604800, s-maxage=43200` |
| raw.githubusercontent | `raw.githubusercontent.com/USER/gitmatrix/tiles/activity.svg` | `max-age=300` |
| GitHub Pages | enable Pages on the `tiles` branch | Fastly-backed |

jsDelivr is the fastest but holds branch URLs for ~12h, so the workflow calls
`purge.jsdelivr.net` after each publish to make a new render live immediately.
`raw.githubusercontent` has a 5-minute TTL and needs no purge, which is simpler
if you would rather not depend on jsDelivr at all.

```markdown
<img src="https://cdn.jsdelivr.net/gh/YOUR_NAME/gitmatrix@tiles/activity.svg" width="100%" />
```

### Vercel function — only if others will use it

Needed when you want `?username=anyone` resolved on demand. Import the repo to
Vercel — no environment variables required. Set `GITHUB_TOKEN` only to opt into
the GraphQL API.

```markdown
<img src="https://YOUR-APP.vercel.app/api/activity?username=YOUR_NAME" width="100%" />
```

Be aware of what you are signing up for: if other people point at your
instance, you are paying for their profile images and inherit the failure mode
described above. Responses carry `s-maxage` so repeat views are served from the
edge without invoking the function, which keeps that manageable.

### Static build

```bash
node bin/build.mjs                  # uses ./gitmatrix.json
node bin/build.mjs --config x.json
node bin/build.mjs --out public
node bin/build.mjs --demo           # synthetic data, no network
```

Each entry in `gitmatrix.json` takes exactly the query params the HTTP API
accepts, so there is one mental model for both transports:

```json
{
  "username": "YOUR_NAME",
  "out": "dist",
  "tiles": [
    { "tile": "activity", "file": "activity.svg", "title": "LAST YEAR" },
    { "tile": "activity", "file": "activity-30d.svg", "days": 30, "points": true }
  ]
}
```

Tiles declaring the same `data` source share a single fetch. The suite renders
every config entry, so a bad tile name or option combination fails `node
test.mjs` rather than the nightly build.

## Components

| Component | Shows | Data |
|---|---|---|
| [`activity`](#apiactivity) | contributions as a smooth area + line chart | calendar |
| [`calendar`](#apicalendar) | the contribution grid, one column per week | calendar |
| [`streak`](#apistreak) | total, current streak, longest streak | calendar |
| [`languages`](#apilanguages) | language split as a stacked bar | profile |
| [`stats`](#apistats) | repos, stars, forks, followers, account age | profile |

Two data sources, both unauthenticated: `calendar` reads the public
contributions page, `profile` makes two REST calls. Tiles sharing a source
share one fetch, so the full set above costs three requests against a 60/hr
unauthenticated budget.

Every tile also accepts `theme`, `color`, `bg`, `area`, `border`, `muted`,
`title`, `border`, `radius` and `width`. Out-of-range values clamp; unparseable
ones fall back to the default.

### `/api/activity`

Daily contributions as a smooth area + line chart.

| Option | Range | Default |
|---|---|---|
| `username` | 1-39 chars of `[A-Za-z0-9-]` | **required** |
| `group` | `day` \| `week` \| `month` | `week` |
| `smoothing` | `0`-`1` | `1` |
| `days` | `7`-`366`, trims to most recent N | all |
| `width` | `320`-`1600` | `800` |
| `height` | `160`-`800` | `320` |
| `points` | boolean, dot per data point | `false` |
| `dots` | `1`-`5`, marker radius | `2` |
| `grid` | boolean, horizontal reference lines | `true` |
| `fill` | boolean, area under the line | `true` |
| `border` | boolean, outer frame | `true` |
| `radius` | `0`-`24`, corner radius | `6` |
| `title` | up to 80 chars | none |
| `ttl` | `300`-`86400`, shared-cache seconds | `7200` |

Out-of-range values clamp to the nearest bound; unparseable values fall back to
the default. A bad query degrades to a working tile rather than an error.

### `/api/calendar`

The contribution grid. Sized from its own content, so it never clips or leaves
dead space.

| Option | Range | Default |
|---|---|---|
| `cell` | `6`-`20` px square | `11` |
| `gap` | `1`-`6` px | `3` |
| `levels` | `3`-`6` shade steps | `5` |
| `labels` | boolean, month + weekday labels | `true` |

Shade thresholds are quantiles of the non-zero days, not fixed counts, so the
grid stays readable whether a peak day is 3 commits or 300.

### `/api/streak`

| Option | Range | Default |
|---|---|---|
| `width` | `320`-`1600` | `760` |
| `height` | `160`-`800` | `240` |

A zero on the current day does not break the streak — the day is not over yet,
so it is skipped rather than counted as a miss.

### `/api/languages`

| Option | Range | Default |
|---|---|---|
| `top` | `3`-`12` languages listed | `6` |
| `forks` | boolean, include forked repos | `false` |

Counts repositories per language, not bytes. Byte-accurate shares need one
request per repo or a token; see the note in `lib/tiles/languages.js`.

### `/api/stats`

| Option | Range | Default |
|---|---|---|
| `forks` | boolean, count forks as your own | `false` |

Forks are excluded by default, so the count reflects your own work. A profile
with 59 public repos of which 30 are forks reports 29. Pass `forks=true` to
count everything.

## Theming

Seven presets: `matrix` (default) · `amber` · `ice` · `dracula` · `nord` ·
`rose` · `mono`.

```
?theme=nord
```

Every token is independently overridable, so a preset is a starting point
rather than a fixed look:

| Param | Token |
|---|---|
| `color` | line, headings, gridlines |
| `bg` | background |
| `area` | area fill |
| `border` | frame stroke (defaults to `color`) |
| `muted` | axis and footer text (defaults to `color`) |

```
?theme=nord&color=00FF41&area=003311
```

Colors are `3`/`4`/`6`/`8` hex digits, with or without `#`. Anything else is
rejected in favour of the theme value — a malformed color can never reach the
output.

## Smoothing

`smoothing` interpolates between straight segments (`0`) and a full curve (`1`).

**Grouping matters more than smoothing.** A year at daily resolution is ~370
points; on an 800px chart that is about 2px per point, and no amount of
smoothing is visible — the curve renders as a picket fence. `group=week` gives
~53 points and `group=month` ~13, which is where a curve reads as a curve.
Weekly is the default for that reason. Grouping changes resolution only: the
total is preserved exactly, and the suite asserts it across all three modes.

The curve is a **monotone cubic Hermite spline** (Fritsch-Carlson), not
Catmull-Rom. Catmull-Rom is the usual pick and costs the same to write, but it
overshoots around local extrema. On contribution data that means the curve dips
below zero after a spike and the area fill paints under the baseline. Measured
on a spike series with data bounded to `[10, 100]`:

| Method | Rendered y range |
|---|---|
| monotone cubic | `[10.00, 100.00]` — bounded |
| Catmull-Rom | `[10.00, 106.65]` — 6.65px past the baseline |

`test.mjs` samples the emitted Bézier curves and asserts the rendered path stays
inside the data range at every smoothing level, so a regression here fails the
suite rather than quietly shipping a chart that bleeds under its own axis.

## Site

Two routes, both generated from the tile registry, so the published docs cannot
drift from the code:

| Route | Contents |
|---|---|
| `/` | component showcase — live previews, theme strips, copy-paste snippets |
| `/docs/` | reference — delivery, theming, per-component options, adding a component |

```bash
node bin/gallery.mjs          # live data for the configured user
node bin/gallery.mjs --demo   # synthetic data, no network
node bin/gallery.mjs --out public
```

The **Build tiles** workflow publishes both to the `gh-pages` branch. Set
Pages to that branch once (Settings → Pages → Source: `gh-pages` / root) and it
stays current on every run. Because both pages render every component, a broken
tile fails the site build — publishing doubles as a check on the whole set.

## Adding a tile

Three steps, no routing changes — `api/[tile].js` and the registry handle
dispatch.

**1.** If the tile needs data nothing else fetches, add a fetcher to
`lib/github.js`:

```js
export const FETCHERS = {
  async languages(login, token) { /* ... */ },
};
```

**2.** Add `lib/tiles/<name>.js` exporting `options` and `render`:

```js
export const options = { width: 'px, 320-1600 (default 800)' };

export function render(data, theme, q) {
  return tile({ /* ... */ });
}
```

`render` must be **pure** — data in, string out, no IO. That is what lets the
suite test every tile without a token or a network.

**3.** Register it in `lib/tiles/index.js`:

```js
export const TILES = {
  languages: {
    slug: 'languages',
    summary: 'Language split across public repos',
    data: 'languages',
    options: languages.options,
    render: languages.render,
  },
};
```

The suite then checks it automatically: slug matches its key, `render` is a
function, the declared `data` has a fetcher, and options are documented.

## Layout

```
bin/build.mjs       static build -> dist/*.svg for CDN delivery
bin/gallery.mjs     public gallery -> site/index.html, from the registry
bin/brand.mjs       regenerates assets/logo.svg and assets/cover.svg
gitmatrix.json      which tiles to render statically
lib/curve.js        monotone cubic spline -> SVG path
lib/theme.js        presets + per-token override resolution
lib/validate.js     trust boundary: every query param passes through here
lib/svg.js          shared chrome (frame, title, footer)
lib/tiles/          one file per tile, pure render functions
  activity.js       smooth area + line chart
  calendar.js       contribution grid
  streak.js         total / current / longest
  languages.js      stacked language bar
  stats.js          profile aggregates
  index.js          the registry every entry point reads
lib/github.js       data sources, keyed by tile.data
lib/contributions.js  token-free parser for the public calendar HTML
api/[tile].js       single dynamic route for every tile
test.mjs            assert-based suite, no framework
.github/workflows/  nightly render -> tiles branch -> CDN purge
```

## Brand

`assets/logo.svg` and `assets/cover.svg` are generated by `node bin/brand.mjs`,
with their curves drawn by `lib/curve.js` — the same monotone cubic code the
tiles use. Strings are pinned with `textLength` and `lengthAdjust`, so the
layout holds even where the viewer has none of the listed monospace fonts.

## Licence

MIT
