import { resolve } from 'node:path';
import { RaiderIO } from './raiderio.js';
import { refreshScores } from './refresh.js';
import { writeStore } from './store.js';

const result = await refreshScores(new RaiderIO({
  season: process.env.RAIDER_IO_SEASON,
  expansionId: Number(process.env.RAIDER_IO_EXPANSION_ID ?? 11)
}), {
  onProgress: (done, total) => process.stdout.write(`\rRefreshing ${done}/${total}`)
});
await writeStore(resolve(process.env.DATA_FILE ?? './data/scores.json'), result);
console.log(`\nSaved ${result.rows.length} rankings for ${result.season}.`);
