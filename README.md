<div align="center">

# gitmatrix

**Flexible, self-hosted SVG tiles for GitHub profile READMEs.**

Zero runtime dependencies · no build step · every token customizable

</div>

---

## Why self-hosted

Most profile-README tile services are a single Vercel project owned by one
volunteer, serving images for thousands of other people's profiles. That ends
one way:

```
GET github-readme-activity-graph.vercel.app/graph?username=...
→ 402 Payment Required / DEPLOYMENT_DISABLED
```

`402` is Vercel cutting off a maintainer who ran out of free tier. The code was
fine; the hosting economics were not. gitmatrix is built to be deployed **per
user**, so you serve only your own profile and stay inside the free tier
indefinitely. Responses carry `s-maxage`, so Vercel's edge and GitHub's camo
proxy absorb repeat views without invoking the function at all.

## Quick start

```bash
git clone https://github.com/AbdulSadath77/gitmatrix
cd gitmatrix
node test.mjs          # no token or network needed
node test.mjs --write  # emits demo SVGs
```

Deploy: import the repo to Vercel and set one environment variable.

| Variable | Value |
|---|---|
| `GITHUB_TOKEN` | Classic PAT. Scope-less is enough — contribution data is public. |

Then embed:

```markdown
<img src="https://YOUR-APP.vercel.app/api/activity?username=YOUR_NAME" width="100%" />
```

## Tiles

### `/api/activity`

Daily contributions as a smooth area + line chart.

| Option | Range | Default |
|---|---|---|
| `username` | 1-39 chars of `[A-Za-z0-9-]` | **required** |
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
lib/curve.js        monotone cubic spline -> SVG path
lib/theme.js        presets + per-token override resolution
lib/validate.js     trust boundary: every query param passes through here
lib/svg.js          shared chrome (frame, title, footer)
lib/tiles/          one file per tile, pure render functions
lib/github.js       GraphQL fetchers, keyed by tile.data
api/[tile].js       single dynamic route for every tile
test.mjs            assert-based suite, no framework
```

## Licence

MIT
