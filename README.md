# What's Poppin

Bubble pop game with cultural sauce. Match bubbles, build streaks, unleash characters.

## Features

- **Core gameplay** — Swap adjacent bubbles, match 3+ to pop, chain cascades
- **Power-ups** — Match 4 (Line Clear), Match 5+ (Bomb), L/T shape (Color Nuke)
- **Streak system** — Chain matches for multipliers, unlock characters at 3x/5x/8x/12x. Visual progress bar with tier markers shows how close you are to the next tier, with glow pulses and escalating camera shake on tier hits
- **4 characters** — Kira, Blaze, Ronin, Empress — each with unique vibes
- **Synthesized audio** — Lo-fi beat, melodic pops, 808 bass hits, streak SFX (Web Audio API) with mute toggle. Audio engine properly cleans up timers and nodes to prevent memory leaks in long sessions
- **Sound controls** — Toggle audio from title screen or pause menu, preference persists across sessions
- **Two modes** — Timed (90s) and Zen (no timer), each with mode-aware game-over and replay. Pause fully freezes all game logic — scene clock, cascade timers, tip rotation, and ambient particles all halt until resume
- **Career stats** — Cross-session tracking: games played, total pops, best score/streak, averages, tier unlocks
- **Hall of Fame** — Top 10 ranked leaderboard with per-game history. Gold/silver/bronze medals for top 3, streak tier labels, mode and date tracking. New entries highlight with animated glow pulse. Schema-validated storage with score/streak clamping
- **Performance scan** — Deep player evaluation: skill bracket rating (Rookie → Mythic), animated stat bars for avg score / efficiency / streak peak, and 3 progressive challenges tailored to your stats
- **Tutorial** — Interactive walkthrough for new players
- **PWA** — Installable, offline-capable, mobile-optimized

## Security

- **SRI** — CDN scripts verified with SHA-384 subresource integrity hashes
- **CSP** — Content-Security-Policy with zero `unsafe-inline` — scripts load from `'self'` + CDN, styles from external `src/styles.css` only. Locked down with `base-uri`/`form-action`/`frame-ancestors`
- **SW CSP enforcement** — All SW-served responses get CSP and security headers injected. Offline fallback uses a pre-cached external stylesheet with strict `style-src 'self'` — zero `unsafe-inline` across all code paths
- **Permissions-Policy** — Disables camera, microphone, geolocation, payment, USB, sensors
- **Referrer-Policy** — `no-referrer` prevents information leakage to CDN/third parties
- **SafeStorage** — All localStorage wrapped in try-catch with FNV-1a integrity checksums
- **CareerStats sanitization** — Schema-validated deserialization with key whitelist, type enforcement, non-negative clamping, and upper-bound limits. Rejects injected properties, non-numeric types, and overflow values
- **HallOfFame sanitization** — Per-entry schema validation: score clamped to 1e8, streak to 1000, mode whitelist (timed/zen), date format regex. Invalid entries silently dropped on load
- **Score integrity** — High scores validated against checksums to detect tampering
- **SW hardening** — Service worker validates response origins, handles network failures gracefully

## Tests

```bash
npm test
```

128 unit tests (all passing) covering SafeStorage (checksum tamper detection, integer parsing, unicode/empty/long-string hashing, near-collision resistance), CareerStats persistence (cross-session accumulation, record flags, corrupted JSON recovery, forward compatibility, undefined/NaN/negative gameData resilience), HallOfFame leaderboard (ranked insertion, score sorting, 10-entry cap, rank calculation, zero-score rejection, type injection sanitization, overflow clamping, mode whitelist), cascade simulation (drop → re-match), cascade pause safety (scene clock freezing, resume restart), reshuffle move verification (retry logic, max-attempt cap), endGame selection cleanup, full turn cycle integration (swap → match → pop → drop → verify), game-over stat derivation, power-up analysis→effect integration, swap edge cases (double-null, boundary corners, self-swap), deadlock detection (empty grid, uniform board, isolated pairs), match-finding algorithm (cross-shaped, boundary patterns, null gaps, sub-minimum runs, grid edges), column-independent gravity/drop simulation, adjacency validation, streak tier resolution, adlib tier selection, area-of-effect calculations, scoring formula boundaries (negative inputs, zero streak, exact size-bonus thresholds), shape detection, game constant integrity, and ScanScene derived metrics (skill bracket resolution, efficiency calculation, progressive challenge generation). Uses Vitest.

## Tech Stack

- **Phaser 3** — Game engine (loaded from jsDelivr CDN with SRI)
- **Web Audio API** — All sound synthesized, zero external files
- **Vanilla JS** — No build step, no framework. Shared UI utilities (`drawCard`, `drawSceneHeader`, `createButton`, `drawDarkGridBg`, `UI_FONT`) keep scene code DRY. Core game loop decomposed into focused methods (`calculateMatchScore`, `applyMatchFeedback`, `startCascadeCycle`). Streak progress bar with tier-aware glow and camera shake for visceral combo feedback. Hall of Fame leaderboard with schema-validated SafeStorage persistence
- **CDN** — Phaser loaded from jsDelivr with integrity verification
- **Vitest** — Unit testing (dev dependency)

## Run Locally

```bash
npx serve . -l 3333
```

Open `http://localhost:3333`

## Deploy

Static site — deploy to Vercel, Netlify, or any static host. No build step needed.

## Credits

Built by DareDev256
