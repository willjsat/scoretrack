const BASE_URL = 'https://raider.io/api/v1';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export class RaiderIO {
  constructor({ fetchImpl = fetch, season, retries = 3 } = {}) {
    this.fetch = fetchImpl;
    this.season = season;
    this.retries = retries;
  }

  async get(path, params = {}) {
    const url = new URL(`${BASE_URL}/${path}`);
    Object.entries(params).forEach(([key, value]) => value != null && url.searchParams.set(key, value));
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const response = await this.fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'ScoreTrack/1.0 (percentile dashboard)' }
      });
      if (response.ok) return response.json();
      if (attempt === this.retries || ![429, 500, 502, 503, 504].includes(response.status)) {
        throw new Error(`Raider.IO returned ${response.status} for ${url.pathname}`);
      }
      await sleep(750 * 2 ** attempt);
    }
  }

  async activeSeason() {
    if (this.season) return this.season;
    // The static-data route requires an expansion_id and therefore cannot be
    // used to discover the expansion. Rankings defaults to the active season,
    // and echoes the resolved season in its response parameters.
    const data = await this.rankings({ className: 'Mage', specName: 'Frost', page: 0 });
    const season = data.rankings?.params?.season
      ?? data.params?.season
      ?? data.rankings?.season?.slug
      ?? data.season?.slug
      ?? data.season;
    // Keep omitting the season query if Raider.IO changes where it exposes the
    // label. The rankings API will continue to use its active-season default.
    return typeof season === 'string' && season ? season : 'current';
  }

  async rankings({ season, className, specName, page = 0 }) {
    return this.get('mythic-plus/rankings/characters', {
      region: 'world', season: season === 'current' ? null : season,
      class: className, spec: specName, role: 'all', page
    });
  }
}

export function normalizePage(payload) {
  const root = payload.rankings ?? payload;
  const rows = root.rankedCharacters ?? root.ranked_characters ?? root.characters ?? [];
  const pagination = root.pagination ?? payload.pagination ?? {};
  return {
    rows,
    pageSize: Number(pagination.pageSize ?? pagination.perPage ?? rows.length),
    total: Number(pagination.totalItems ?? pagination.total ?? pagination.totalCount ?? 0)
  };
}

function rowScore(row) {
  return Number(row.score ?? row.mythicPlusScore ?? row.mythic_plus_score ?? row.character?.mythicPlusScore);
}

export function scoreAtRank(page, rank) {
  const exact = page.rows.find(row => Number(row.rank) === rank);
  if (exact) return rowScore(exact);
  const offset = (rank - 1) % page.pageSize;
  return rowScore(page.rows[offset]);
}
