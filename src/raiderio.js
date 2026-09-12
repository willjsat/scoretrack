const API_ROOT = 'https://raider.io/api';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export class RaiderIO {
  constructor({ fetchImpl = fetch, season, expansionId = 11, retries = 3 } = {}) {
    this.fetch = fetchImpl;
    this.season = season;
    this.expansionId = expansionId;
    this.retries = retries;
  }

  async get(path, params = {}) {
    const url = new URL(`${API_ROOT}/${path}`);
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
    const data = await this.get('v1/mythic-plus/static-data', { expansion_id: this.expansionId });
    const seasons = data.seasons ?? data.seasonData ?? [];
    const now = Date.now();
    const inProgress = season => {
      const startsAt = dateValue(season.starts?.us ?? season.startsAt ?? season.start);
      const endsAt = dateValue(season.ends?.us ?? season.endsAt ?? season.end);
      return startsAt <= now && now < endsAt;
    };
    const active = data.currentSeason ?? data.current_season
      ?? seasons.find(season => season.current || season.isCurrent || season.is_current)
      ?? seasons.find(inProgress);
    const slug = typeof active === 'string' ? active : active?.slug ?? active?.id ?? active?.season;
    if (!slug) {
      throw new Error(`Raider.IO returned no active season for expansion ${this.expansionId}. Set RAIDER_IO_SEASON explicitly.`);
    }
    return slug;
  }

  async rankings({ season, className, specName, page = 0 }) {
    return this.get('mythic-plus/rankings/characters', {
      region: 'world', season,
      class: toFilter(className), spec: specName ? toFilter(specName) : 'all',
      role: 'all', faction: 'all', page
    });
  }
}

function toFilter(value) {
  return value?.toLowerCase().replaceAll(' ', '-');
}

function dateValue(value) {
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
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
