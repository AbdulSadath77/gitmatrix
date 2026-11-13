// GitHub data fetchers, keyed by the `data` field on a tile.

import { fetchContributions } from './contributions.js';

const CALENDAR_QUERY = `query($login:String!){
  user(login:$login){
    contributionsCollection{
      contributionCalendar{
        totalContributions
        weeks{ contributionDays{ date contributionCount } }
      }
    }
  }
}`;

/** Flatten GitHub's week/day nesting into one ordered series. */
export function flattenCalendar(calendar) {
  return calendar.weeks
    .flatMap((w) => w.contributionDays)
    .map((d) => ({ date: d.date, count: d.contributionCount }));
}

async function graphql(query, variables, token) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'gitmatrix',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`github responded ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

/**
 * Data sources, keyed by a tile's `data` field.
 *
 * `token` is optional. With one, the stable GraphQL API is used. Without, the
 * public HTML calendar is parsed instead -- so gitmatrix runs with no secrets
 * configured at all. GraphQL is preferred when available only because an API
 * cannot be reshaped by a frontend change.
 *
 * @type {Record<string, (login:string, token?:string)=>Promise<any>>}
 */
export const FETCHERS = {
  async calendar(login, token) {
    if (!token) return fetchContributions(login);
    const data = await graphql(CALENDAR_QUERY, { login }, token);
    if (!data?.user) throw new Error(`no such user: ${login}`);
    return flattenCalendar(data.user.contributionsCollection.contributionCalendar);
  },
};
