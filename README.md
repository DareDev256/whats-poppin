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

## Security

- **SRI** — CDN scripts verified with SHA-384 subresource integrity hashes
- **CSP** — Content-Security-Policy with zero `unsafe-inline` (scripts and styles), `object-src 'none'`, `upgrade-insecure-requests`, `base-uri`/`form-action`/`frame-ancestors` lockdown
- **SW CSP enforcement** — All SW-served responses (cached + offline) get CSP and security headers injected — no unprotected responses
- **Permissions-Policy** — Disables camera, microphone, geolocation, payment, USB, sensors
- **Referrer-Policy** — `no-referrer` prevents information leakage to CDN/third parties
- **SafeStorage** — All localStorage wrapped in try-catch with FNV-1a integrity checksums
- **Score integrity** — High scores validated against checksums to detect tampering
- **SW hardening** — Service worker validates response origins, handles network failures gracefully

## Tests

```bash
npm test
```

96 unit tests covering cascade simulation (drop → re-match), full turn cycle integration (swap → match → pop → drop → verify), game-over stat derivation, power-up analysis→effect integration, swap edge cases (both-null, self-swap), deadlock detection, match-finding algorithm (cross-shaped, boundary patterns), grid gravity/drop simulation, adjacency validation, streak tier resolution, adlib tier selection, area-of-effect calculations, scoring formula boundaries, shape detection, and game constant integrity. Uses Vitest.

## Tech Stack

- **Phaser 3** — Game engine (loaded from jsDelivr CDN with SRI)
- **Web Audio API** — All sound synthesized, zero external files
- **Vanilla JS** — No build step, no framework. Shared UI utilities (`createButton`, `drawDarkGridBg`, `UI_FONT`) keep scene code DRY
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
