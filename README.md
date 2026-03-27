# What's Poppin

Bubble pop game with cultural sauce. Match bubbles, build streaks, unleash characters.

## Features

- **Core gameplay** — Swap adjacent bubbles, match 3+ to pop, chain cascades
- **Power-ups** — Match 4 (Line Clear), Match 5+ (Bomb), L/T shape (Color Nuke)
- **Streak system** — Chain matches for multipliers, unlock characters at 3x/5x/8x/12x
- **4 characters** — Kira, Blaze, Ronin, Empress — each with unique vibes
- **Synthesized audio** — Lo-fi beat, melodic pops, 808 bass hits, streak SFX (Web Audio API) with mute toggle. Audio engine properly cleans up timers and nodes to prevent memory leaks in long sessions
- **Sound controls** — Toggle audio from title screen or pause menu, preference persists across sessions
- **Two modes** — Timed (90s) and Zen (no timer), each with mode-aware game-over and replay. Pause fully freezes all game logic including cascades, timers, and ambient effects
- **Career stats** — Cross-session tracking: games played, total pops, best score/streak, averages, tier unlocks
- **Performance scan** — Deep player evaluation: skill bracket rating (Rookie → Mythic), animated stat bars for avg score / efficiency / streak peak, and 3 progressive challenges tailored to your stats
- **Tutorial** — Interactive walkthrough for new players
- **PWA** — Installable, offline-capable, mobile-optimized

## Security

- **SRI** — CDN scripts verified with SHA-384 subresource integrity hashes
- **CSP** — Content-Security-Policy with zero `unsafe-inline` — scripts load from `'self'` + CDN, styles from external `src/styles.css` only. Locked down with `base-uri`/`form-action`/`frame-ancestors`
- **SW CSP enforcement** — All SW-served responses get CSP and security headers injected. Offline fallback uses a minimal `default-src 'none'` policy scoped to its synthesized response
- **Permissions-Policy** — Disables camera, microphone, geolocation, payment, USB, sensors
- **Referrer-Policy** — `no-referrer` prevents information leakage to CDN/third parties
- **SafeStorage** — All localStorage wrapped in try-catch with FNV-1a integrity checksums
- **Score integrity** — High scores validated against checksums to detect tampering
- **SW hardening** — Service worker validates response origins, handles network failures gracefully

## Tests

```bash
npm test
```

108 unit tests (all passing) covering SafeStorage (checksum tamper detection, integer parsing edge cases, fallback behavior), CareerStats persistence (cross-session accumulation, record flags, corrupted JSON recovery, forward compatibility), cascade simulation (drop → re-match), full turn cycle integration (swap → match → pop → drop → verify), game-over stat derivation, power-up analysis→effect integration, swap edge cases (both-null, self-swap), deadlock detection, match-finding algorithm (cross-shaped, boundary patterns), grid gravity/drop simulation, adjacency validation, streak tier resolution, adlib tier selection, area-of-effect calculations, scoring formula boundaries, shape detection, and game constant integrity. Uses Vitest.

## Tech Stack

- **Phaser 3** — Game engine (loaded from jsDelivr CDN with SRI)
- **Web Audio API** — All sound synthesized, zero external files
- **Vanilla JS** — No build step, no framework. Shared UI utilities (`createButton`, `drawDarkGridBg`, `UI_FONT`) keep scene code DRY. Core game loop decomposed into focused methods (`calculateMatchScore`, `applyMatchFeedback`, `startCascadeCycle`)
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
