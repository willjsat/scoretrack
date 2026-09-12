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

test('discovers the active season from a default rankings request', async () => {
  let requestedUrl;
  const provider = new RaiderIO({ retries: 0, fetchImpl: async url => {
    requestedUrl = url;
    return { ok: true, async json() { return { rankings: { params: { season: 'season-live-1' } } }; } };
  } });
  assert.equal(await provider.activeSeason(), 'season-live-1');
  assert.equal(requestedUrl.pathname, '/api/v1/mythic-plus/rankings/characters');
  assert.equal(requestedUrl.searchParams.has('season'), false);
});

test('keeps the API active-season default when its label is absent', async () => {
  const urls = [];
  const provider = new RaiderIO({ retries: 0, fetchImpl: async url => {
    urls.push(url);
    return { ok: true, async json() { return { rankings: {} }; } };
  } });
  assert.equal(await provider.activeSeason(), 'current');
  await provider.rankings({ season: 'current', className: 'Mage', specName: 'Frost' });
  assert.equal(urls.every(url => !url.searchParams.has('season')), true);
});
