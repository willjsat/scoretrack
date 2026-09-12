import { entities } from './catalog.js';
import { normalizePage, scoreAtRank } from './raiderio.js';

async function mapLimit(items, limit, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return output;
}

export async function calculateEntity(provider, season, entity) {
  const query = { season, className: entity.className, specName: entity.specName };
  const first = normalizePage(await provider.rankings(query));
  if (!first.total || !first.pageSize) throw new Error(`No ranking population returned for ${entity.id}`);

  const rank1 = Math.max(1, Math.ceil(first.total * 0.01));
  const rank5 = Math.max(1, Math.ceil(first.total * 0.05));
  const pageNumbers = [...new Set([rank1, rank5].map(rank => Math.floor((rank - 1) / first.pageSize)))];
  const pages = new Map([[0, first]]);
  await Promise.all(pageNumbers.filter(page => page !== 0).map(async page => {
    pages.set(page, normalizePage(await provider.rankings({ ...query, page })));
  }));

  const lookup = rank => scoreAtRank(pages.get(Math.floor((rank - 1) / first.pageSize)), rank);
  const top1 = lookup(rank1);
  const top5 = lookup(rank5);
  if (!Number.isFinite(top1) || !Number.isFinite(top5)) throw new Error(`Malformed scores returned for ${entity.id}`);
  return { ...entity, population: first.total, top1, top5, rank1, rank5 };
}

export async function refreshScores(provider, { concurrency = 4, onProgress = () => {} } = {}) {
  const season = await provider.activeSeason();
  const list = entities();
  let completed = 0;
  const rows = await mapLimit(list, concurrency, async entity => {
    try {
      return await calculateEntity(provider, season, entity);
    } catch (error) {
      return { ...entity, error: error.message };
    } finally {
      onProgress(++completed, list.length);
    }
  });
  const successful = rows.filter(row => !row.error).length;
  if (!successful) throw new Error('Raider.IO did not return data for any class or specialization.');
  return { season, refreshedAt: new Date().toISOString(), source: 'Raider.IO', rows };
}
