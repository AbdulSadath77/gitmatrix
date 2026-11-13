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

async function rest(path, token) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'gitmatrix',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 404) throw new Error('no such user');
  if (res.status === 403 || res.status === 429) {
    throw new Error('github rate limit reached (60/hr unauthenticated)');
  }
  if (!res.ok) throw new Error(`github responded ${res.status}`);
  return res.json();
}

/**
 * Normalised profile: the user record plus their repositories, flattened to
 * just the fields tiles use. Two unauthenticated REST calls.
 *
 * `fork` is kept so tiles can exclude forks. It matters: this account has 59
 * public repos but only 29 of its own, which is why third-party cards disagree
 * about the repo count.
 */
async function fetchProfile(login, token) {
  const user = await rest(`/users/${encodeURIComponent(login)}`, token);

  // Paginate, capped. 300 repos is far past where a profile card stays
  // meaningful, and each page is another request against a 60/hr budget.
  const repos = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await rest(
      `/users/${encodeURIComponent(login)}/repos?per_page=100&page=${page}&sort=pushed`,
      token,
    );
    repos.push(...batch);
    if (batch.length < 100) break;
  }

  return {
    login: user.login,
    name: user.name ?? user.login,
    createdAt: user.created_at,
    followers: user.followers ?? 0,
    following: user.following ?? 0,
    publicRepos: user.public_repos ?? repos.length,
    repos: repos.map((r) => ({
      name: r.name,
      language: r.language ?? null,
      stars: r.stargazers_count ?? 0,
      forks: r.forks_count ?? 0,
      fork: Boolean(r.fork),
    })),
  };
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

  profile: fetchProfile,
};
