// Token-free contribution data.
//
// https://github.com/users/<login>/contributions is public and needs no auth.
// It is the same source Platane/snk reads, which is why a snake workflow runs
// with no secrets configured.
//
// Trade-off: this is HTML, not an API, so GitHub can change it -- they already
// removed the `data-count` attribute that older scrapers relied on. Exact
// counts now live in <tool-tip> elements joined to each day cell by id.
// parseContributionsHtml throws loudly rather than returning a plausible-looking
// empty year, so a markup change fails the build instead of silently rendering
// a flat chart. When a token is available, lib/github.js prefers the stable
// GraphQL API instead.

/**
 * @param {string} html body of /users/<login>/contributions
 * @returns {{date: string, count: number}[]} ordered oldest -> newest
 */
export function parseContributionsHtml(html) {
  // id -> date. Attribute order is not guaranteed, so each is matched
  // independently inside the tag rather than as one fixed sequence.
  const dates = new Map();
  for (const m of String(html).matchAll(/<td\b[^>]*>/g)) {
    const tag = m[0];
    if (!tag.includes('ContributionCalendar-day')) continue;
    const date = /data-date="(\d{4}-\d{2}-\d{2})"/.exec(tag)?.[1];
    const id = /\bid="([^"]+)"/.exec(tag)?.[1];
    // Some cells are grid padding and carry no date; skip them.
    if (date && id) dates.set(id, date);
  }

  if (dates.size === 0) {
    throw new Error(
      'no contribution day cells found -- GitHub markup may have changed ' +
        '(expected <td class="ContributionCalendar-day" data-date=... id=...>)',
    );
  }

  // id -> exact count, read from the tooltip label.
  //   "No contributions on November 16th."
  //   "1 contribution on November 9th."
  //   "6 contributions on November 23rd."
  const counts = new Map();
  for (const m of String(html).matchAll(/<tool-tip\b[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const id = m[1];
    if (!dates.has(id)) continue;
    const label = m[2].trim();
    if (/^no\b/i.test(label)) {
      counts.set(id, 0);
      continue;
    }
    const n = Number((/^([\d,]+)/.exec(label)?.[1] ?? '').replace(/,/g, ''));
    if (Number.isFinite(n)) counts.set(id, n);
  }

  if (counts.size === 0) {
    throw new Error(
      'found day cells but no tooltip counts -- GitHub markup may have changed ' +
        '(expected <tool-tip for="contribution-day-component-...">N contributions on ...</tool-tip>)',
    );
  }

  // The grid is laid out one row per weekday, so cell order is not date order.
  return [...dates]
    .map(([id, date]) => ({ date, count: counts.get(id) ?? 0 }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Fetch and parse the public calendar. No authentication. */
export async function fetchContributions(login) {
  const res = await fetch(`https://github.com/users/${encodeURIComponent(login)}/contributions`, {
    headers: {
      // GitHub serves this partial to a plain browser-ish request.
      'User-Agent': 'gitmatrix',
      Accept: 'text/html',
    },
  });
  if (res.status === 404) throw new Error(`no such user: ${login}`);
  if (!res.ok) throw new Error(`github responded ${res.status}`);
  return parseContributionsHtml(await res.text());
}
