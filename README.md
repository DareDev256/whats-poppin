# What's Poppin 🫧

**Match-3 bubble game with cultural sauce.** Swap bubbles, chain combos, unlock characters, climb the Hall of Fame.

Built with zero build tools — vanilla JS, Phaser 3, Web Audio API. No frameworks, no bundlers, no external assets. Everything procedurally drawn, every sound synthesized.

## Gameplay

- **Core loop** — Swap adjacent bubbles, match 3+ to pop, trigger cascading combos
- **Power-ups** — Match 4 → Line Clear · Match 5+ → Bomb · L/T shape → Color Nuke
- **Streak system** — Chain matches for escalating multipliers: 3x NICE → 5x FIRE → 8x GODLIKE → 12x LEGENDARY. Progress bar with tier markers, glow pulses on threshold hits, and camera shake that intensifies with streak tier
- **4 characters** — Kira, Blaze, Ronin, Empress — procedurally drawn, each with a unique vibe
- **Two modes** — Timed (90s countdown) and Zen (infinite). Pause fully freezes all game logic — scene clock, cascade timers, tip rotation, ambient particles
- **Hall of Fame** — Top 10 ranked leaderboard with gold/silver/bronze medals, streak tier labels, animated glow on new entries. Schema-validated persistence
- **Career Stats** — Cross-session tracking: games played, total pops, best score/streak, averages, tier unlocks
- **Performance Scan** — Skill bracket rating (Rookie → Mythic), animated stat bars, 3 progressive challenges tailored to your stats
- **Tutorial** — Interactive walkthrough for new players
- **PWA** — Installable, offline-capable, mobile-optimized

## Run Locally

```bash
npm run dev
# → http://localhost:3333
```

Or without npm:

```bash
npx serve . -l 3333
```

**Deploy** — Static site, no build step. Drop on Vercel, Netlify, or any static host.

## Tests

```bash
npm test
```

129 unit tests (Vitest), all passing. Coverage:

| Module | What's tested |
|--------|--------------|
| **SafeStorage** | Checksum tamper detection, integer parsing edge cases, unicode/empty/long-string hashing, near-collision resistance |
| **CareerStats** | Cross-session accumulation, record flags, corrupted JSON recovery, forward compatibility, schema sanitization, NaN/negative resilience |
| **HallOfFame** | Ranked insertion, score sorting, 10-entry cap, zero-score rejection, type injection sanitization, overflow clamping, mode whitelist |
| **GameScene** | Cascade simulation, pause safety (scene clock freezing), reshuffle verification, endGame cleanup, full turn cycle, game-over stat derivation |
| **PowerUpSystem** | Analysis → effect integration, area-of-effect calculations, shape detection |
| **Grid Logic** | Match-finding (cross-shaped, boundary, null gaps), gravity/drop, adjacency validation, swap edge cases, deadlock detection |
| **Scoring** | Formula boundaries, zero streak, size-bonus thresholds, streak tier resolution, adlib selection |
| **ScanScene** | Skill bracket resolution, efficiency calculation, progressive challenge generation |

## Architecture

```
whats-poppin/                  ~6,200 LOC (game) + 1,400 LOC (tests)
├── index.html                 Entry point — CSP headers, SRI-verified CDN script, load order
├── sw.js                      Service worker — caching, offline fallback, CSP enforcement
├── manifest.json              PWA manifest
│
├── src/
│   ├── init.js          (79)  SafeStorage — tamper-resistant localStorage with FNV-1a checksums
│   ├── audio.js        (610)  AudioEngine — synthesized lo-fi beat, 808 bass, melodic pops, streak SFX
│   ├── icons.js        (265)  Procedural icon library — 15 icons, zero external assets
│   ├── powerups.js     (217)  PowerUpSystem (match analysis) + PowerUpRenderer (overlays)
│   ├── characters.js   (871)  Procedural character drawing — Kira, Blaze, Ronin, Empress
│   ├── game.js       (2,757)  9 scenes, grid logic, scoring, UI utilities, Phaser config
│   └── game.test.js  (1,414)  129 unit tests (Vitest)
│
├── src/styles.css             External styles (zero unsafe-inline CSP)
└── src/offline.css            Offline fallback styles
```

**Load order matters** — `init.js` exposes `SafeStorage` globally before `game.js` references it. All modules attach to `window` (no ES modules / build step). Phaser loaded from jsDelivr CDN with SRI verification.

### Scenes

| Scene | Purpose |
|-------|---------|
| `BootScene` | Asset loading, initialization |
| `TitleScene` | Main menu — mode select, stats preview, sound toggle |
| `GameScene` | Core gameplay — grid, matching, cascades, streaks, power-ups |
| `GameOverScene` | Score display, Hall of Fame rank, replay options |
| `HallOfFameScene` | Top 10 leaderboard with medals and streak tiers |
| `StatsScene` | Career stats dashboard — lifetime totals, averages, records |
| `ScanScene` | Performance evaluation — skill bracket, stat bars, challenges |
| `TutorialScene` | Interactive gameplay walkthrough |
| `TipsScene` | Tips and hints |

### Public APIs

| Module | API | Description |
|--------|-----|-------------|
| `SafeStorage` | `.get(key)` · `.set(key, val)` · `.getInt(key, fallback)` | Checksummed localStorage wrapper |
| `CareerStats` | `.load()` · `.record(gameData)` · `.save()` | Cross-session stat persistence with schema validation |
| `HallOfFame` | `.load()` · `.add(entry)` · `.getRank(score)` | Top-10 leaderboard with clamped/validated entries |
| `AudioEngine` | `.playPop()` · `.playSelect()` · `.playStreakHit()` · `.setMuted(bool)` | Synthesized audio with mute persistence |
| `PowerUpSystem` | `.analyze(matches)` | Match pattern → power-up type resolution |
| Utilities | `getStreakTier(val)` · `initAudioWithPrefs()` · `createButton()` · `drawCard()` | Shared game logic and UI helpers |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Engine | **Phaser 3.90** — loaded from jsDelivr CDN with SRI |
| Audio | **Web Audio API** — all sound synthesized, zero external files |
| Language | **Vanilla JS** — no build step, no framework, JSDoc-documented |
| Tests | **Vitest 4.1** — 129 unit tests |
| Hosting | Static — Vercel, Netlify, or any static host |

## Security

This game runs entirely client-side with no backend, but ships with defense-in-depth:

- **SRI** — CDN Phaser script verified with SHA-384 subresource integrity
- **CSP** — Zero `unsafe-inline` across all code paths (main page, SW responses, offline fallback). Scripts: `'self'` + jsDelivr CDN. Styles: `'self'` only. `object-src 'none'` blocks plugin execution. `upgrade-insecure-requests` forces HTTPS subresources
- **Permissions-Policy** — Disables camera, mic, geolocation, payment, USB, sensors
- **Referrer-Policy** — `no-referrer` prevents leakage to third parties
- **SafeStorage** — All localStorage wrapped in try-catch with FNV-1a integrity checksums
- **CareerStats sanitization** — Schema-validated deserialization: key whitelist, type enforcement, non-negative clamping, upper-bound limits
- **HallOfFame sanitization** — Per-entry validation: score clamped to 1e8, streak to 1000, mode whitelist, date regex
- **SW hardening** — Service worker validates response origins, injects CSP on all synthesized responses, `clients.claim()` ensures security patches propagate immediately

## Credits

Built by [DareDev256](https://github.com/DareDev256)

## License

MIT
