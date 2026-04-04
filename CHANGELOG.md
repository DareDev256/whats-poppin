# Changelog

## [0.13.2] — 2026-04-04

### Changed
- **`GameScene.update()` decomposition** — Extracted the monolithic 105-line `update()` method into three focused render subsystems: `renderPowerUpOverlays(time)`, `renderFeverMeter(time)`, and `renderHintGlow(time)`. Each method owns a single visual concern with its own JSDoc, early-return guard, and reduced nesting depth. The fever bar color selection was also simplified from a mutable 5-branch if/else chain to a declarative ternary. Zero behavioral change — purely structural improvement for maintainability

## [0.13.1] — 2026-04-03

### Fixed
- **`shareScore` variable shadowing** — Renamed local `safeScore` variable to `cleanScore` to avoid shadowing the module-level `safeScore()` function, preventing silent breakage if the function is called later in the same scope
- **Unguarded stat column division** — Replaced raw `1 / (statItems.length + 1)` with `safeDiv()` for consistent defensive arithmetic in the game-over stats layout
- **Streak multiplier floor** — Added `Math.max(1, ...)` and `Number.isFinite()` guard to `streakMultiplier` so corrupted/NaN streak values can never zero-multiply earned points away silently

## [0.13.0] — 2026-04-02

### Added
- **Cascade Chain Counter** — Gravity-induced chain reactions now display a graffiti-style "CHAIN ×N" banner at screen center with glitch text effect (offset shadow duplicate), spring-scale entrance, and fade-out. Color escalates with depth: cyan (×2) → gold (×3) → magenta (×4+). Deep chains (×3+) trigger extra camera shake for impact
- **Chain score bonus** — Each cascade level adds +25 points to the base score before multipliers. A ×3 chain during a ×5 streak earns an extra 250 points. Bonus indicator text appears below the chain banner
- **Chain stats in game over** — "BEST CHAIN" column appears in the end-game stats row when the player achieved a ×2+ chain. Also included in the share card text
- **7 new tests** — Chain bonus scoring: depth 1 (no bonus), depth 2/3 (additive), streak scaling, power-up stacking, size bonus stacking, deep chain with full multipliers

## [0.12.1] — 2026-04-01

### Added
- **Comprehensive JSDoc for `processMatches()`** — The core game loop orchestrator now has full documentation: 8-stage pipeline table (power-up detection → pop → activate → create → fever → scoring → milestones/achievements → gravity cascade), recursion model explanation, scoring formula breakdown, parameter/return annotations, and cross-references to `findAllMatches`, `PowerUpSystem.analyze`, `safeScore`, and `Achievements.check`
- **README: Match Processing Pipeline section** — New architecture section with ASCII pipeline diagram, recursion model, and scoring formula. Architecture tree updated to reference `processMatches()`

## [0.12.0] — 2026-03-31

### Added
- **Fever Mode** — Combo energy meter that fills with consecutive matches and triggers a 2× score bonus state. Left-edge vertical bar with 4 color stages (blue → green → yellow → red → gold). At 100% fill, FEVER MODE activates for 6 seconds with dramatic banner announcement, pulsing gold border, and enhanced star-burst particles. Matching during fever extends the timer by 1.5s (max 10s). Meter drains slowly during idle moments to maintain tension. Score popup shows 🔥 indicator during fever. Fever count displayed in game over stats and share card. Tips scene updated with Fever Mode strategy section

## [0.11.0] — 2026-03-31

### Added
- **Achievement system** — 8 progression milestones that unlock during gameplay: FIRST BLOOD (first pop), ON FIRE (5× streak), DEMON TIME (8× streak), TRANSCENDENT (12× streak), BIG MONEY (5,000+ score), UNTOUCHABLE (10,000+ score), POP MACHINE (500 lifetime pops), DEDICATED (10 games played). Each achievement fires a slide-in toast notification with star icon, tier-colored card, and a satisfying two-tone unlock sound (ascending triangle waves). Multiple unlocks in one match stagger automatically. Achievement progress is shown in the Your Legacy dashboard with a 2-column grid layout, color-coded dot indicators, and unlock/lock states. All achievements persist via SafeStorage with `whatspoppin_ach_<id>` keys. Session + lifetime stats are checked both during gameplay (processMatches) and at game end (endGame) to catch every unlock path

## [0.10.4] — 2026-03-30

### Added
- **32 new unit tests across 3 untested critical paths** — New `core.test.js` covering: `scanRuns` (10 tests: horizontal/vertical 3-match detection, end-of-row matches, null hole handling, two separate matches in one row, single-cell edge case, full-row match), `textStyle`/`TEXT_PRESETS` (5 tests: immutability, override merging without mutation, unknown preset error, fontFamily invariant, preset completeness), and `SafeStorage` (17 tests: round-trip string/int, tamper detection, cross-key replay attack prevention, scientific/hex/float/negative/overflow rejection in getInt, checksum determinism and key-binding, salt caching and format validation). Total test count: 149 passing

## [0.10.3] — 2026-03-30

### Changed
- **Text style preset system (`TEXT_PRESETS` + `textStyle()`)** — Extracted 8 named typography presets (heading, stat, label, muted, accent, body, popup, badge) and a composable `textStyle(preset, overrides)` factory function. Replaced ~30 inline style objects across all 7 scenes, eliminating repetitive `fontFamily: UI_FONT` / `fontStyle: 'bold'` / `stroke: '#000000'` boilerplate at every `this.add.text()` call site. Each text element now declares its visual intent by name instead of re-specifying 3-6 raw properties. Net reduction of 75 lines with zero visual change. Typography changes (font, stroke weight, color palette) now update from a single location instead of hunting across 54 scattered call sites

## [0.10.2] — 2026-03-30

### Changed
- **Character drawing: extract `drawEye()` and `drawShadow()` helpers** — Consolidated ~70 lines of duplicated eye-drawing code (sclera → iris → pupil → highlight) across all 4 characters (Kira, Blaze, Ronin, Empress) into a single parameterized `drawEye()` function. Each character's eye personality (Kira's dark almond eyes, Blaze's fierce orange, Ronin's narrow red slits, Empress's piercing purple with sub-glow) is now expressed as a compact config object instead of 16-20 raw lines. Also extracted `drawShadow()` for the 4 identical ground-shadow ellipses. Net reduction of ~55 lines with zero visual change

## [0.10.1] — 2026-03-29

### Fixed
- **Division-by-zero and NaN guard hardening** — Added `safeDiv()` utility to centralise defensive division across scoring and stats display (avg-per-move, avg-per-game). Added `safeScore()` to clamp score accumulation in `processMatches`, preventing NaN/Infinity propagation through the scoring pipeline. Upgraded `endGame` scene hand-off from weak `|| 0` fallbacks to `safeScore()` (catches Infinity, which `|| 0` misses). All 5 division sites now route through the same guard
- **13 new unit tests** — `safeDiv` (zero, NaN, Infinity, negative, overflow) and `safeScore` (NaN, Infinity, negative, undefined, custom max). Total: 117 tests

## [0.10.0] — 2026-03-28

### Added
- **Streak multiplier badge** — A prominent animated HUD element that makes the scoring multiplier visible during active streaks. Appears as a floating badge centered above the score bar showing ×2 through ×10. The ring grows with multiplier level, changes color to match streak tier (green → gold → red → purple), bounces in on first appearance, punches on each increment, and pulses with a breathing glow at ×8+. Fades out smoothly when the streak breaks. The multiplier was always in the scoring formula but completely invisible to players — now they can see exactly why streaks matter
- **5 new unit tests** — Multiplier badge visibility thresholds, cap at ×10, parity with scoring formula, tier color escalation. Total: 104 tests

## [0.9.0] — 2026-03-28

### Added
- **Live milestone notifications** — "NEW HIGH SCORE!" and "BEST STREAK: Nx" banners fire instantly mid-game the moment you surpass a personal record. Gold horizontal glow band with scale-in text and sparkle burst for high scores; red variant for best streaks. Each milestone fires only once per game. First-ever games (no stored records) stay clean — no false celebrations. When both milestones trigger on the same match, the streak banner staggers 1.8s to avoid overlap
- **8 new unit tests** — Milestone detection logic: fire-once semantics, no-record guard, simultaneous dual-fire, equality edge cases, first-game suppression. Total: 99 tests

## [0.8.1] — 2026-03-26

### Changed
- **HUD toolbar: extract `createToolbarBtn()` helper** — Consolidated 3 identical toolbar button creation blocks (pause, hint, mute) in GameScene into a single `createToolbarBtn()` factory function. Each button previously duplicated 8 lines of Graphics fill/stroke, depth assignment, and hit-zone wiring. The factory handles bg rendering, icon placement, and interactive hit-zone setup in one call, returning refs for downstream use. Net reduction of ~20 lines with zero behavioral change

## [0.8.0] — 2026-03-26

### Added
- **Lifetime Stats Dashboard ("Your Legacy")** — New StatsScene accessible from the title screen via a trophy-adorned button. Displays lifetime statistics with animated count-up values and color-coded progress bars: total games played (with timed/zen split), all-time high score, cumulative score, total bubbles popped (with per-game averages), and best streak ever achieved
- **Persistent stat tracking** — Every completed game now records lifetime counters in SafeStorage: games per mode, total bubbles popped, cumulative score, and all-time best streak. All values are checksum-protected and tamper-resistant
- **Best grade showcase** — Stats dashboard displays best letter grades earned per mode with dramatic scale-in reveal animations. Streak-tier character appears in the header when a streak milestone has been reached
- **Trophy icon** — New `Icons.trophy()` procedurally drawn icon for the stats button

## [0.7.1] — 2026-03-26

### Security
- **SafeStorage: keyed checksums with per-install salt** — `_checksum()` now binds the storage key name and a per-install cryptographic salt into the FNV-1a digest. Previously the checksum only hashed the raw value, allowing cross-key replay attacks (copy a valid value+checksum between keys) and pre-computed cheat scripts that work on every installation. The salt is generated via `crypto.getRandomValues()` and stored under an opaque key
- **SafeStorage: strict integer validation** — `getInt()` now rejects scientific notation (`1e10`), hex (`0xff`), and float strings (`3.14`) via `/^\d{1,10}$/` allowlist. Previously `parseInt(raw, 10)` would silently accept these formats, allowing crafted values to bypass range expectations

## [0.7.0] — 2026-03-25

### Changed
- **AudioEngine: extract `_tone()` helper** — Consolidated 15+ duplicated oscillator+gain+envelope boilerplate blocks across `playSelect`, `playPop`, `playInvalid`, `playLand`, `playNice`, `playFire`, `playGodlike`, `playLegendary`, `bgKick`, `bgSnare`, and `bgBass` into a single `_tone(t, opts)` method. Supports frequency sweeps, attack envelopes, and background node tracking. Net reduction of ~147 lines with zero behavioral change. Sound methods now read as declarative voice descriptions instead of low-level Web Audio wiring

## [0.6.1] — 2026-03-24

### Added
- **Hint & Auto-Select deep-dive in README** — New dedicated section documenting the dual-trigger hint system (manual lightbulb + 5s idle auto-select), `findHintMove()` algorithm, charge economy, visual feedback (gold pulsing glow with sine-wave animation), and a state machine diagram showing IDLE → AUTO_HINT / MANUAL_HINT transitions

## [0.6.0] — 2026-03-24

### Added
- **Performance grade system** — Every game ends with a letter grade (S/A/B/C/D/F) based on score and best streak combined. S-grade requires 5000+ score AND 8+ streak — high score alone isn't enough, you need to chain. Grade reveals with a dramatic scale-in animation after the score counts up
- **S-grade visual flair** — Achieving S-grade triggers a pulsing gold glow ring and breathing scale animation on the grade letter, making it screenshot-worthy
- **Per-mode best grade persistence** — Best grade earned is stored separately for Timed and Zen modes via SafeStorage. Displayed as compact badges on the title screen below the high score
- **Grade in share card** — Score sharing now includes your grade and its label (e.g., "Grade: S — SUPREME"), adding social bragging rights
- **Compact character display on Game Over** — Streak-tier character now renders as a small badge beside the grade instead of a large hero element, keeping the layout clean
- **9 new unit tests** — Grade threshold logic, streak/score interaction, rank monotonicity, edge cases (high score + low streak, low score + high streak). Total: 91 tests

## [0.5.2] — 2026-03-23

### Security
- **CSP: add `object-src 'none'`** — Blocks plugin/object loading (Flash, Java applets) from same origin. Previously relied on `default-src 'self'` fallback which was too permissive
- **CSP: add `upgrade-insecure-requests`** — Forces HTTPS for all subresource loads. README documented this directive but it was missing from both `index.html` and `sw.js`
- **Add `X-Frame-Options: DENY`** — Clickjacking protection for legacy browsers that don't support CSP `frame-ancestors`. Added as both HTML meta tag and SW response header
- **SW: harden all cached responses** — Previously, only the offline fallback and 503 error responses received security headers. Cached responses from `caches.match()` were returned raw without CSP, `X-Content-Type-Options`, or `Referrer-Policy`. Now every same-origin response served through the SW gets the full security header set via `hardenResponse()`. Cross-origin (opaque) CDN responses are exempt to preserve SRI verification
- **SW: add `Referrer-Policy: no-referrer`** — Injected on all SW-served responses, matching the `<meta>` tag in `index.html`
- **SW cache version bump** — `whatspoppin-v4` → `whatspoppin-v5` to force existing installations to pick up the hardened SW

## [0.5.1] — 2026-03-23

### Fixed
- **Game Over crash** — `GameOverScene.create()` crashed with `TypeError` when receiving undefined data (e.g. scene restart without params, race condition during transition). Destructuring now falls back to safe defaults
- **Share score crash** — `shareScore()` called `.toLocaleString()` on potentially undefined values; now validates all numeric inputs before formatting
- **High score NaN guard** — `endGame()` validates `this.score` is finite before comparing/writing to SafeStorage, preventing NaN from corrupting the stored high score
- **Scene hand-off hardening** — `endGame()` defensively coerces all values passed to GameOverScene, closing the gap between GameScene (which already guarded `data?.mode`) and GameOverScene (which didn't)

## [0.5.0] — 2026-03-21

### Added
- **Sound toggle** — persistent mute/unmute button on both the title screen and in-game HUD (left of hint button). Uses `AudioEngine.toggleMute()` to zero/restore master gain. Mute preference stored in SafeStorage, restored across sessions via `restoreMuteState()`
- **Score sharing** — "SHARE SCORE" button on the Game Over screen generates a formatted text score card with final score, best streak (with tier label), moves, avg/move, and game mode. Uses Web Share API on mobile, falls back to Clipboard API on desktop. Animated toast notification confirms the action
- **3 new procedural icons** — `Icons.sound()` (speaker with sound waves), `Icons.soundOff()` (speaker with red X), `Icons.share()` (upload/export arrow with box)
- **Game mode passthrough** — Game Over screen now receives the current game mode and "PLAY AGAIN" restarts in the same mode (was hardcoded to timed)

## [0.4.0] — 2026-03-21

### Added
- **Hint system** — tap the lightbulb button (top-right, beside pause) to reveal a valid swap with pulsing gold rings and a directional guide line
- **Auto-hint on idle** — after 5 seconds of inactivity, a hint appears automatically to keep players moving (the "auto-select" feature)
- **Hint economy** — timed mode gives 3 hints (displayed as a counter badge); zen mode has unlimited hints
- **Lightbulb icon** — new `Icons.hint()` procedural icon with radiating rays
- Hint visualization renders in the game loop (`update()`) with smooth sine-wave pulsing — outer glow ring + inner ring + connecting guide line between the two swap targets
- Hints auto-clear on any player interaction (tap, swipe, or swap)

## [0.3.4] — 2026-03-21

### Changed
- Added JSDoc documentation to `PowerUpSystem` class — `analyze()`, `isLOrTShape()`, `getAffectedCells()` now have full param/return docs and behavioral descriptions
- Added JSDoc documentation to `PowerUpRenderer.draw()` with parameter descriptions
- Added JSDoc block to `POWERUP_TYPES` enum explaining each type and its match pattern trigger
- Added comprehensive JSDoc to `SafeStorage` in `init.js` — block-level usage example, method docs for `get()`, `getInt()`, `set()`, and `_checksum()`
- Expanded `drawDarkGridBg()` JSDoc with return type and visual description
- Updated README: added Architecture section documenting file roles and load order, added `npm run dev` command, confirmed test count (82), added `npm run dev` command, documented race condition guards in Security section

## [0.3.3] — 2026-03-20

### Changed
- Extracted `getStreakLevel(streak)` helper replacing 4 duplicated `STREAK_LEVELS.filter().pop()` chains across `showScorePopup`, `updateStreakUI`, `triggerHypeBar`, and `GameOverScene`
- Extracted `getAdlibTier(streak)` helper replacing inline `Math.max(...Object.keys().map().filter())` expression — clearer intent, no intermediate array allocations
- Extracted `scanRuns()` direction-agnostic line scanner replacing duplicated horizontal and vertical match-detection loops in `findAllMatches()` — single implementation, two axis calls
- Net reduction of ~20 lines while improving readability and extensibility

## [0.3.2] — 2026-03-20

### Changed
- Extracted unified `createButton()` factory replacing 3 duplicated button methods across TitleScene, GameOverScene, and GameScene — single source of truth for button rendering, hover states, and hit zones
- Extracted `drawDarkGridBg()` utility replacing duplicated dark grid background drawing in TitleScene and GameScene
- Extracted `UI_FONT` constant replacing 40+ hardcoded `'"Segoe UI", system-ui, sans-serif'` strings — font changes are now a one-liner
- Net reduction of ~30 lines while improving maintainability

## [0.3.1] — 2026-03-18

### Security
- Fixed CSP gap in service worker: offline fallback responses now carry full `Content-Security-Policy` and `X-Content-Type-Options: nosniff` headers — previously had zero CSP protection
- Added missing CSP directives `base-uri 'self'`, `form-action 'self'`, and `frame-ancestors 'none'` to both `index.html` meta tag and SW synthesized responses — closes base-tag injection, form hijack, and clickjacking vectors
- Bumped service worker cache to `whatspoppin-v4` to invalidate stale caches
- Offline fallback page now renders a styled, branded page instead of raw unstyled HTML

## [0.3.0] — 2026-03-18

### Security
- Removed `'unsafe-inline'` from CSP `script-src` — inline scripts extracted to `src/init.js`, closing primary XSS vector
- Added `Permissions-Policy` header disabling camera, microphone, geolocation, payment, USB, and sensor APIs
- Added `Referrer-Policy: no-referrer` to prevent information leakage to third-party CDN
- Wrapped all localStorage operations in `SafeStorage` with try-catch — prevents crashes in private browsing or when storage is disabled/full
- Added FNV-1a checksum validation on stored values (high score, played flag) — detects casual localStorage tampering
- Hardened service worker fetch: validates response origins before caching, returns graceful offline fallback on network failure instead of unhandled rejection
- Bumped service worker cache to `whatspoppin-v3` to invalidate stale caches
- Scoped service worker registration to `'/'`

## [0.2.3] — 2026-03-17

### Added
- 20 new tests for critical untested paths: deadlock detection (`hasPossibleMoves`), advanced match patterns (cross-shaped, parallel, boundary, full-board, sub-minimum), gravity edge cases (alternating gaps, empty columns, multi-gap row data), BOMB/LINE edge positions (middle-edge clipping, sparse rows/columns), and scoring boundary conditions
- Total test count: 82 (up from 62)

## [0.2.2] — 2026-03-17

### Added
- 28 new tests covering untested critical paths: match-finding algorithm (horizontal, vertical, L-shaped grouping, null gaps, long runs), adjacency validation (horizontal, vertical, diagonal, same-cell, distance-2), grid swap primitive (data consistency, double-swap idempotency, null handling), streak tier resolution (all thresholds and between-tier behavior), adlib tier selection (tier boundaries and edge case), and gravity/drop simulation (gap filling, multi-drop stacking, full-column no-op)
- Total test count: 62 (up from 34)

## [0.2.1] — 2026-03-17

### Added
- 34 unit tests with Vitest covering critical game logic: power-up analysis, L/T shape detection, area-of-effect cell calculations, scoring formula, edge cases (grid corners, null cells, unknown types), and game constant integrity
- `npm test` now runs the test suite (was previously a no-op)

## [0.2.0] — 2026-03-17

### Security
- Added Subresource Integrity (SRI) hash for CDN-loaded Phaser script — prevents supply chain attacks
- Added Content-Security-Policy meta tag restricting script/style/connect sources
- Hardened localStorage reads with explicit radix and NaN guards on `parseInt`
- Sanitized score writes to prevent storing non-numeric values

### Fixed
- Service worker now caches the actual CDN URL for Phaser instead of a non-existent `node_modules/` path — offline play actually works now
- Bumped service worker cache version to `whatspoppin-v2` to invalidate stale caches

## [0.1.1] — 2026-03-17

### Added
- Lifetime stats scene with persistent progress tracking

## [0.1.0] — 2026-03-16

### Added
- Initial release — bubble pop game with cultural sauce
- Core match-3 gameplay, power-ups, streak system
- 4 procedurally drawn characters (Kira, Blaze, Ronin, Empress)
- Synthesized audio engine (Web Audio API)
- Timed and Zen game modes
- Interactive tutorial
- PWA support with service worker
