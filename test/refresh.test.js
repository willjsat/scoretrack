import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEntity } from '../src/refresh.js';
import { normalizePage, scoreAtRank } from '../src/raiderio.js';

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
