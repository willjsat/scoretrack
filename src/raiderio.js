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
    const data = await this.get('mythic-plus/static-data', { region: 'world' });
    const seasons = data.seasons ?? data.seasonData ?? [];
    const now = Date.now();
    const inDateRange = item => {
      const start = Date.parse(item.starts?.us ?? item.startsAt ?? item.start ?? '');
      const end = Date.parse(item.ends?.us ?? item.endsAt ?? item.end ?? '');
      return Number.isFinite(start) && start <= now && (!Number.isFinite(end) || now < end);
    };
    const active = data.currentSeason ?? data.current_season
      ?? seasons.find(item => item.current || item.isCurrent || item.is_current)
      ?? seasons.find(inDateRange)
      ?? seasons.at(-1);
    const season = typeof active === 'string' ? active : active?.slug ?? active?.id ?? active?.season;
    if (!season) throw new Error('Could not determine the active Mythic+ season. Set RAIDER_IO_SEASON.');
    return season;
  }

  async rankings({ season, className, specName, page = 0 }) {
    return this.get('mythic-plus/rankings/characters', {
      region: 'world', season, class: className, spec: specName, role: 'all', page
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
