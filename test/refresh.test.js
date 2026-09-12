import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEntity } from '../src/refresh.js';
import { normalizePage, scoreAtRank } from '../src/raiderio.js';
import { RaiderIO } from '../src/raiderio.js';

test('normalizes Raider.IO ranking responses', () => {
  const page = normalizePage({ rankings: { rankedCharacters: [{ rank: 1, score: 3000 }], pagination: { pageSize: 20, totalItems: 100 } } });
  assert.equal(page.pageSize, 20);
  assert.equal(page.total, 100);
  assert.equal(scoreAtRank(page, 1), 3000);
});

test('fetches pages containing the exact percentile boundary ranks', async () => {
  const requested = [];
  const provider = {
    async rankings({ page = 0 }) {
      requested.push(page);
      const rows = Array.from({ length: 20 }, (_, index) => {
        const rank = page * 20 + index + 1;
        return { rank, score: 4000 - rank };
      });
      return { rankings: { rankedCharacters: rows, pagination: { pageSize: 20, totalItems: 1000 } } };
    }
  };
  const result = await calculateEntity(provider, 'season-test', { id: 'mage-frost', type: 'spec', className: 'Mage', specName: 'Frost' });
  assert.deepEqual(requested.sort((a, b) => a - b), [0, 2]);
  assert.equal(result.rank1, 10);
  assert.equal(result.rank5, 50);
  assert.equal(result.top1, 3990);
  assert.equal(result.top5, 3950);
});

test('discovers the active season using the required expansion ID', async () => {
  let requestedUrl;
  const provider = new RaiderIO({ expansionId: 11, retries: 0, fetchImpl: async url => {
    requestedUrl = url;
    return { ok: true, async json() { return { seasons: [{ slug: 'season-live-1', current: true }] }; } };
  } });
  assert.equal(await provider.activeSeason(), 'season-live-1');
  assert.equal(requestedUrl.pathname, '/api/v1/mythic-plus/static-data');
  assert.equal(requestedUrl.searchParams.get('expansion_id'), '11');
});

test('discovers an active season from Unix timestamps', async () => {
  const now = Math.floor(Date.now() / 1000);
  const provider = new RaiderIO({ retries: 0, fetchImpl: async url => {
    return { ok: true, async json() { return { seasons: [
      { slug: 'season-old', starts: { us: now - 2000 }, ends: { us: now - 1000 } },
      { slug: 'season-live-2', starts: { us: now - 100 }, ends: { us: now + 1000 } }
    ] }; } };
  } });
  assert.equal(await provider.activeSeason(), 'season-live-2');
});

test('uses Raider.IO website ranking filters for classes and specializations', async () => {
  let requestedUrl;
  const provider = new RaiderIO({ retries: 0, fetchImpl: async url => {
    requestedUrl = url;
    return { ok: true, async json() { return {}; } };
  } });
  await provider.rankings({ season: 'season-live-1', className: 'Death Knight', specName: null, page: 7 });
  assert.equal(requestedUrl.pathname, '/api/mythic-plus/rankings/characters');
  assert.equal(requestedUrl.searchParams.get('class'), 'death-knight');
  assert.equal(requestedUrl.searchParams.get('spec'), 'all');
  assert.equal(requestedUrl.searchParams.get('faction'), 'all');
  assert.equal(requestedUrl.searchParams.get('page'), '7');
  assert.equal(requestedUrl.searchParams.get('season'), 'season-live-1');
});
