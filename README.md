# What's Poppin

Bubble pop game with cultural sauce. Match bubbles, build streaks, unleash characters.

## Features

- **Core gameplay** — Swap adjacent bubbles, match 3+ to pop, chain cascades
- **Power-ups** — Match 4 (Line Clear), Match 5+ (Bomb), L/T shape (Color Nuke)
- **Streak system** — Chain matches for multipliers, unlock characters at 3x/5x/8x/12x
- **4 characters** — Kira, Blaze, Ronin, Empress — each with unique vibes
- **Synthesized audio** — Lo-fi beat, melodic pops, 808 bass hits, streak SFX (Web Audio API)
- **Two modes** — Timed (90s) and Zen (no timer)
- **Tutorial** — Interactive walkthrough for new players
- **PWA** — Installable, offline-capable, mobile-optimized

## Architecture

```
src/
  init.js        — SafeStorage (tamper-resistant localStorage) + SW registration
  game.js        — Grid engine, 6 Phaser scenes, shared helpers (scanRuns, createButton, etc.)
  powerups.js    — PowerUpSystem (match analysis) + PowerUpRenderer (animated overlays)
  audio.js       — AudioEngine — fully synthesized sound via Web Audio API
  characters.js  — Procedurally drawn characters (Phaser Graphics API)
  icons.js       — Icons class — SVG-style icon system replacing emoji
  game.test.js   — 82 Vitest unit tests
sw.js            — Service worker with CSP header injection + offline fallback
index.html       — Entry point with CSP meta tag + SRI-verified CDN script
```

All source files attach their exports to `window` — no bundler, no module system. Load order matters: `init.js` → `icons.js` → `powerups.js` → `characters.js` → `audio.js` → `game.js`.

## Security

- **SRI** — CDN scripts verified with SHA-384 subresource integrity hashes
- **CSP** — Content-Security-Policy with no `unsafe-inline` on scripts, `object-src 'none'`, `upgrade-insecure-requests`, `base-uri`/`form-action`/`frame-ancestors` lockdown
- **SW CSP enforcement** — All SW-served responses (cached + offline) get CSP and security headers injected — no unprotected responses
- **Permissions-Policy** — Disables camera, microphone, geolocation, payment, USB, sensors
- **Referrer-Policy** — `no-referrer` prevents information leakage to CDN/third parties
- **SafeStorage** — All localStorage wrapped in try-catch with FNV-1a integrity checksums
- **Score integrity** — High scores validated against checksums to detect tampering
- **SW hardening** — Service worker validates response origins, handles network failures gracefully
- **Race condition guards** — `gameOverRef` prevents input after time-up; `transitioningRef` prevents double-fire on simultaneous timer/completion events

## Tests

```bash
npm test
```

82 unit tests covering deadlock detection, match-finding algorithm (including cross-shaped and boundary patterns), grid gravity/drop simulation (alternating gaps, empty columns), adjacency validation, swap primitives, streak tier resolution, adlib tier selection, power-up analysis, area-of-effect calculations (edge positions, sparse grids), scoring formula (boundary conditions), shape detection, and game constant integrity. Uses Vitest.

## Tech Stack

- **Phaser 3** — Game engine (loaded from jsDelivr CDN with SRI)
- **Web Audio API** — All sound synthesized, zero external files
- **Vanilla JS** — No build step, no framework. Shared utilities (`createButton`, `drawDarkGridBg`, `UI_FONT`, `getStreakLevel`, `getAdlibTier`, `scanRuns`) keep scene and game logic DRY
- **Vitest** — Unit testing (dev dependency)

## Run Locally

```bash
npm run dev
# or
npx serve . -l 3333
```

Open `http://localhost:3333`

## Deploy

Static site — deploy to Vercel, Netlify, or any static host. No build step needed.

## Credits

Built by DareDev256
