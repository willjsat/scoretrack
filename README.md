# ScoreTrack

A zero-database web dashboard that shows the live Mythic+ score needed to sit at the **top 5%** and **top 1%** boundary for every World of Warcraft class and specialization.

## Why Raider.IO?

ScoreTrack uses [Raider.IO's ranking API](https://raider.io/api) because Raider.IO maintains a queryable worldwide Mythic+ character ranking, including class and specialization filters. Blizzard's [Mythic Keystone Leaderboard API](https://develop.battle.net/documentation/world-of-warcraft/game-data-apis) exposes timed leaderboard runs rather than a complete, filterable character-score population; Warcraft Logs is centered on combat logs and parses. For percentile boundaries, Raider.IO is therefore the closest match to the data this product actually needs.

The app does not treat Raider.IO's published title cutoffs as spec percentiles. Instead, it:

1. Requests each worldwide class/spec ranking and its total population.
2. Calculates boundary ranks as `ceil(population × 0.01)` and `ceil(population × 0.05)`.
3. Requests only the pages containing those two ranks and records their exact scores.

This costs at most three requests per category per refresh instead of downloading every character.

## Run locally

Requirements: **Node.js 20+**. There are no package dependencies and no database to provision.

```bash
cp .env.example .env # optional; Node does not auto-load this file
npm start
```

Open <http://localhost:3000>. The first snapshot is generated in the background and can take a few minutes. It is atomically stored at `data/scores.json`, so subsequent restarts immediately serve the last good data while refreshing it.

Environment variables can be supplied directly:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `REFRESH_INTERVAL_HOURS` | `3` | Refresh cadence |
| `DATA_FILE` | `./data/scores.json` | Snapshot location; mount this path for persistence in a container |
| `RAIDER_IO_SEASON` | auto-detected | Override the season slug if needed |
| `RAIDER_IO_EXPANSION_ID` | `11` | Expansion used for season discovery (11 is Midnight) |

Run a one-off refresh with `npm run refresh`. The server otherwise refreshes immediately at startup and every three hours after each attempt. The browser polls server status, displays a second-accurate countdown, and preserves the last successful snapshot if Raider.IO is temporarily unavailable.

Season discovery requests Raider.IO's static data with the required `expansion_id`, then selects the season marked current or whose dates contain the current time. Ranking requests always include that resolved season because the rankings route returns HTTP 400 when it is omitted. Set `RAIDER_IO_SEASON` to bypass discovery, or update `RAIDER_IO_EXPANSION_ID` when a new expansion launches.

The rankings route lives at `/api/mythic-plus/rankings/characters`. It is distinct from Raider.IO's documented `/api/v1` character-profile routes; adding the `v1` prefix produces a 404. ScoreTrack sends Raider.IO's lowercase hyphenated filter values and explicit `all` spec/faction filters.

## Deploy

Any long-running Node host works. Set the start command to `npm start` and optionally attach a small persistent volume at `/app/data`. Serverless hosts are not a good fit because their instances sleep and cannot guarantee the in-process three-hour schedule.

## Accuracy notes

- Thresholds represent characters present in Raider.IO's ranking dataset, not every WoW account.
- A character's score/spec attribution follows Raider.IO's ranking response.
- Categories rejected by the upstream API remain visible as unavailable without discarding successful categories.
- The dashboard labels the source, season, population, and last update so the figures have clear context.

## Tests

```bash
npm test
```
