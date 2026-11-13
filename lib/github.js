// GitHub data fetchers, keyed by the `data` field on a tile.

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

/** @type {Record<string, (login:string, token:string)=>Promise<any>>} */
export const FETCHERS = {
  async calendar(login, token) {
    const data = await graphql(CALENDAR_QUERY, { login }, token);
    if (!data?.user) throw new Error(`no such user: ${login}`);
    return flattenCalendar(data.user.contributionsCollection.contributionCalendar);
  },
};
