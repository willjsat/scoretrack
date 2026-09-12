import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RaiderIO } from './raiderio.js';
import { refreshScores } from './refresh.js';
import { readStore, writeStore } from './store.js';

const port = Number(process.env.PORT ?? 3000);
const intervalMs = Number(process.env.REFRESH_INTERVAL_HOURS ?? 3) * 60 * 60 * 1000;
const root = resolve(fileURLToPath(new URL('../public', import.meta.url)));
const dataFile = resolve(process.env.DATA_FILE ?? './data/scores.json');
const provider = new RaiderIO({ season: process.env.RAIDER_IO_SEASON });
let snapshot = await readStore(dataFile);
let refreshing = false;
let lastError = null;
let nextRefreshAt = Date.now();

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  lastError = null;
  try {
    snapshot = await refreshScores(provider, { onProgress: (done, total) => process.stdout.write(`\rRefreshing ${done}/${total}`) });
    await writeStore(dataFile, snapshot);
    process.stdout.write(`\nUpdated ${snapshot.rows.length} rankings.\n`);
  } catch (error) {
    lastError = error.message;
    console.error('\nRefresh failed:', error);
  } finally {
    refreshing = false;
    nextRefreshAt = Date.now() + intervalMs;
  }
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === '/api/scores') {
    return json(response, 200, { data: snapshot, status: { refreshing, lastError, nextRefreshAt: new Date(nextRefreshAt).toISOString(), intervalMs } });
  }
  const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = resolve(join(root, relative));
  if (!file.startsWith(root)) return json(response, 404, { error: 'Not found' });
  try {
    response.writeHead(200, { 'Content-Type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8` });
    response.end(await readFile(file));
  } catch { json(response, 404, { error: 'Not found' }); }
});

server.listen(port, () => console.log(`ScoreTrack is running at http://localhost:${port}`));
refresh();
setInterval(refresh, intervalMs).unref();
