# What's Poppin

Bubble pop game with cultural sauce. Match bubbles, build streaks, unleash characters.

## Features

- **Core gameplay** — Swap adjacent bubbles, match 3+ to pop, chain cascades
- **Power-ups** — Match 4 (Line Clear), Match 5+ (Bomb), L/T shape (Color Nuke)
- **Streak system** — Chain matches for multipliers (×2–×10), unlock characters at 3x/5x/8x/12x. Live multiplier badge shows your current bonus mid-game with tier-colored ring, bounce-in animation, and pulsing glow at ×8+
- **4 characters** — Kira, Blaze, Ronin, Empress — each with unique vibes
- **Synthesized audio** — Lo-fi beat, melodic pops, 808 bass hits, streak SFX (Web Audio API). Internal `_tone()` helper makes adding new sounds trivial
- **Hint system** — Tap the lightbulb to reveal a valid move; auto-hints after 5s idle. 3 charges in timed, unlimited in zen (see [Hint & Auto-Select System](#hint--auto-select-system) below)
- **Sound toggle** — Mute/unmute from title screen or in-game HUD. Preference persists across sessions via SafeStorage
- **Performance grades** — Earn S/A/B/C/D/F grades based on score + streak combo. S-grade requires 5000+ score AND 8+ streak — dramatic reveal animation with pulsing glow. Best grade persists per mode, included in share card
- **Fever Mode** — Chain matches to fill the left-edge meter. At 100%, FEVER MODE activates with 2× score multiplier, pulsing gold border, and enhanced star-burst particles. Keep matching during fever to extend the timer (up to 10s). The meter drains during idle moments — stay aggressive. Fever count shown in game over stats and share card
- **Live milestones** — "NEW HIGH SCORE!" and "BEST STREAK!" banners fire instantly mid-game when you beat your personal records. Gold/red glow band, scale-in text, and sparkle burst. Each fires once per game; first-ever games (no records to beat) stay clean
- **Score sharing** — Copy your score card to clipboard or share via Web Share API on mobile. Formatted for social posting
- **Lifetime stats** — "Your Legacy" dashboard tracks all-time games played (per mode), total bubbles popped, cumulative score, best streak, and best grades. Animated count-up values and color-coded progress bars. All stats checksum-protected via SafeStorage
- **Achievements** — 8 progression milestones (FIRST BLOOD, ON FIRE, DEMON TIME, TRANSCENDENT, BIG MONEY, UNTOUCHABLE, POP MACHINE, DEDICATED) that unlock during gameplay with animated toast notifications and a satisfying two-tone unlock sound. Achievement progress is displayed in the Your Legacy dashboard with color-coded unlock indicators. Persisted via SafeStorage
- **Two modes** — Timed (90s) and Zen (no timer)
- **Tutorial** — Interactive walkthrough for new players
- **PWA** — Installable, offline-capable, mobile-optimized

## Architecture

```
src/
  init.js        — SafeStorage (keyed checksums + per-install salt) + SW registration
  game.js        — Grid engine, 7 Phaser scenes (incl. StatsScene), processMatches() pipeline (see below), hint system, fever meter, TEXT_PRESETS + textStyle() typography system, achievement system (ACHIEVEMENTS + Achievements helper), shared helpers (scanRuns, createButton, createToolbarBtn, safeDiv, safeScore, etc.)
  powerups.js    — PowerUpSystem (match analysis) + PowerUpRenderer (animated overlays)
  audio.js       — AudioEngine — fully synthesized sound via Web Audio API, _tone() helper, persistent mute toggle
  characters.js  — Procedurally drawn characters (Phaser Graphics API) + shared drawEye()/drawShadow() helpers
  icons.js       — Icons class — SVG-style icon system (sound, soundOff, share, hint, trophy, etc.)
  game.test.js   — 121 Vitest unit tests (power-ups, scoring, matching, gravity, milestones, badges, safeDiv/safeScore, swap-reversal invariant)
  core.test.js   — 32 Vitest unit tests (scanRuns, textStyle/TEXT_PRESETS, SafeStorage tamper detection)
sw.js            — Service worker with CSP header injection + offline fallback
index.html       — Entry point with CSP meta tag + SRI-verified CDN script
```

All source files attach their exports to `window` — no bundler, no module system. Load order matters: `init.js` → `icons.js` → `powerups.js` → `characters.js` → `audio.js` → `game.js`.

## Security

- **SRI** — CDN scripts verified with SHA-384 subresource integrity hashes
- **CSP** — Content-Security-Policy with no `unsafe-inline` on scripts, `object-src 'none'`, `upgrade-insecure-requests`, `base-uri`/`form-action`/`frame-ancestors` lockdown
- **X-Frame-Options** — `DENY` header on both the HTML meta tag and all SW-served responses for legacy browser clickjacking protection
- **SW header hardening** — Every response served through the SW (cached, network, and offline fallback) gets security headers injected (`CSP`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `HSTS`, `COOP`). Cross-origin (opaque) CDN responses are exempt to preserve SRI integrity
- **Cache poisoning guard** — SW only caches responses with safe MIME types (HTML, CSS, JS, JSON, images). Unexpected content-types are served but never persisted
- **HSTS** — `Strict-Transport-Security` with 2-year max-age, includeSubDomains, and preload directive
- **COOP** — `Cross-Origin-Opener-Policy: same-origin` mitigates Spectre-class cross-origin attacks
- **Permissions-Policy** — Disables camera, microphone, geolocation, payment, USB, sensors
- **Referrer-Policy** — `no-referrer` prevents information leakage to CDN/third parties
- **SafeStorage** — Sealed object with 11-key allowlist, 64-char max-length guard, try-catch wrappers, and FNV-1a keyed checksums. Key allowlist is frozen — cannot be extended at runtime. Missing checksums are treated as tampered (no deletion bypass). Values exceeding max length are rejected on both read and write. `getString()` validates enum values against explicit allowlists (grades, modes). Grade writes validate mode (`timed`/`zen`) and grade (`S`–`F`). All numeric writes are `Math.floor`'d and range-clamped (scores ≤999M, streaks ≤9999). Salt integrity is self-guarded — tampering invalidates all stored data
- **Game mode validation** — `gameMode` is validated against `['timed', 'zen']` before use in storage key construction, preventing key injection via crafted scene data
- **Score integrity** — High scores validated against checksums to detect tampering; NaN/undefined guards on all score paths prevent corrupted writes
- **Scene data hardening** — GameOverScene validates all incoming data with `Number.isFinite` fallbacks, preventing crashes on undefined game state
- **SW hardening** — Service worker validates response origins, rejects non-HTTP(S) schemes, calls `clients.claim()` on activate for immediate security header coverage on all open tabs, handles network failures gracefully
- **DNS prefetch control** — Disabled to prevent DNS info leakage to third parties
- **PWA scope restriction** — Manifest `scope` locks installed PWA to `/`, preventing navigation outside the app boundary
- **Race condition guards** — `gameOverRef` prevents input after time-up; `transitioningRef` prevents double-fire on simultaneous timer/completion events

## Hint & Auto-Select System

The hint system lives in `src/game.js` on `GameScene` and has two trigger paths:

### Manual Hints (Lightbulb Button)

Tapping the lightbulb icon calls `triggerHint()`. In **Timed mode** each tap costs one of 3 hint charges (displayed as a counter badge). In **Zen mode** hints are unlimited (badge shows `∞`). When charges run out, the counter flashes red and the tap is ignored.

### Auto-Hints (Idle Detection)

A 500ms polling timer tracks `idleTime` — milliseconds since the player's last pointer interaction. When `idleTime` reaches **5 000ms** (5 seconds), `showAutoHint()` fires automatically. Auto-hints are always free and never consume charges.

Any pointer down or bubble swap resets `idleTime` to 0 and clears the active hint, so the system stays out of the way during active play.

### How Moves Are Found

`findHintMove()` scans every cell in the grid, trying each adjacent swap (right, then down). For each candidate swap it:

1. Performs the swap on the data grid (`swapGridData`)
2. Runs `findAllMatches()` to check for 3+ runs
3. Reverses the swap immediately
4. Returns the first pair `{ a: {r, c}, b: {r, c} }` that produces a match, or `null` if the board is deadlocked

Worst case is **O(rows × cols)** — fast enough for the 8×8 grid that it runs inside a 500ms timer callback with no perceptible delay.

### Visual Feedback

When a hint is active, the `update()` loop draws animated rings around the two target bubbles:

- **Gold pulsing glow** — Sine-wave oscillation (`0.5 + 0.5 * sin(time * 0.004)`) drives both opacity (0.3–0.8) and ring radius, creating a breathing effect
- **Connecting line** — A dashed gold line links the two hint bubbles so the swap direction is obvious
- Rings clear instantly on the next pointer interaction via `clearHint()`

### State Machine

```
IDLE ──(5s no input)──▶ AUTO_HINT ──(pointer down)──▶ IDLE
  │                                                      │
  └──(tap lightbulb)──▶ MANUAL_HINT ──(pointer down)──▶ IDLE
                            │
                      (charges == 0) → flash red, ignore
```

Key flags: `hintActive` (bool), `hintPair` (cell coords or null), `idleTime` (ms counter), `hintsUsed` / `maxHints` (charge economy).

## Match Processing Pipeline (`processMatches`)

The heart of the game engine. Every match — whether player-initiated or cascade-triggered — flows through `GameScene.processMatches()`, an 8-stage pipeline that orchestrates power-ups, scoring, fever, achievements, and gravity in a single recursive loop.

```
matchGroups (from findAllMatches)
  │
  ├─ 1. Power-up detection ─── PowerUpSystem.analyze() per group
  ├─ 2. Pop & destroy ──────── remove bubbles, play melodic SFX
  ├─ 3. Power-up activate ──── detonate existing power-ups (LINE/BOMB/NUKE)
  ├─ 4. Power-up create ────── transform center bubble → new power-up
  ├─ 5. Fever meter fill ───── +8% base, +3%/streak, +5%/power-up
  ├─ 6. Scoring ────────────── (base + sizeBonus + puBonus) × streak × fever
  ├─ 7. Milestones & Achs ──── live banners + 8-milestone achievement check
  └─ 8. Gravity cascade ────── drop → refill → scan → recurse if matches found
                                  └─ 300ms ─ 350ms ─ 400ms (staggered for animation)
```

**Recursion model:** Stage 8 calls `findAllMatches()` after gravity settles. If new matches exist, `processMatches()` recurses — incrementing `this.streak` each level, which naturally escalates multipliers, camera shake intensity, and visual effects. Input stays locked (`isProcessing = true`) across the entire cascade depth.

**Scoring formula:** `safeScore((popped×10 + max(0, popped-4)×15 + activatedPUs×50) × min(streak, 10) × (fever ? 2 : 1))`

All score accumulation passes through `safeScore()` to prevent NaN/Infinity from corrupting the running total — a guard added after [0.10.1] to harden the scoring pipeline.

## Tests

```bash
npm test
```

99 unit tests covering live milestone detection (fire-once semantics, no-record guard, simultaneous milestones), performance grade system (threshold logic, rank monotonicity, streak/score interaction), deadlock detection, match-finding algorithm (including cross-shaped and boundary patterns), grid gravity/drop simulation (alternating gaps, empty columns), adjacency validation, swap primitives, streak tier resolution, adlib tier selection, power-up analysis, area-of-effect calculations (edge positions, sparse grids), scoring formula (boundary conditions), shape detection, and game constant integrity. Uses Vitest.

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
