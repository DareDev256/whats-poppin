# Changelog

## [0.8.1] — 2026-03-30

### Fixed
- Race condition in audio playback initiation — `AudioContext.resume()` is async but was called synchronously, causing `startBgBeat()` and SFX to fire into a still-suspended context on mobile browsers
- Serialized resume with promise tracking (`_resumePromise`) to prevent overlapping resume calls from multiple scene handlers
- Added `_pendingBgBeat` deferred start so the background beat reliably begins after the context is confirmed running
- All SFX methods (`playSelect`, `playPop`, `playStreakHit`, `playInvalid`, `playLand`, `playShuffle`) now gate on `_isReady()` (context state === 'running') instead of just `initialized`, preventing silent scheduling failures
- `stopBgBeat()` clears `_pendingBgBeat` to prevent a deferred beat from starting after game ends

## [0.8.0] — 2026-03-29

### Added
- **Hall of Fame** — Top 10 ranked leaderboard scene with per-game history. Entries track score, best streak, game mode, and date
- Gold (👑), silver (⚔️), and bronze (🔥) medal styling for top 3 entries with distinct border accents
- New entries highlighted with animated green glow pulse and emphasized border
- Each entry displays streak tier label (NICE/FIRE/GODLIKE/LEGENDARY) when applicable
- Hall of Fame button on Game Over screen with your placement rank, and on Title screen with top score preview
- Rank badge on Game Over card — shows Hall of Fame placement (#1–#10) with tier-appropriate styling
- `HallOfFame` data object with schema-validated SafeStorage persistence — score clamped to 1e8, streak to 1000, mode whitelist (timed/zen), date regex validation
- 9 unit tests covering ranked insertion, score sorting, 10-entry cap, rank calculation, zero-score rejection, type injection sanitization, overflow clamping, and mode whitelist enforcement

## [0.7.2] — 2026-03-29

### Fixed
- Cascade cycle (drop → refill → re-match) no longer runs during pause — `this.time.paused` now freezes all `delayedCall` and `addEvent` timers alongside tweens and the countdown timer
- Tip rotation and ambient particle spawning also correctly freeze while paused
- `cleanupPause()` (restart/exit) now restores the scene clock so subsequent scenes aren't stuck with a frozen timer
- Added 4 tests covering pause/resume scene clock behavior

## [0.7.1] — 2026-03-28

### Security
- Hardened `CareerStats.load()` with schema-validated deserialization — only whitelisted keys (`gamesPlayed`, `totalScore`, `totalPops`, `bestStreak`, `bestScore`) pass through, all others are stripped
- Added `_sanitize()` method that enforces type checking (rejects non-numeric values), non-negative clamping, and upper-bound limits per field to prevent type confusion, property injection, and integer overflow
- `record()` now re-sanitizes after arithmetic to prevent accumulated values from exceeding bounds
- Added 7 security-focused tests: property injection, string/array type confusion, negative clamping, overflow capping, NaN/null rejection, array payload defense, and post-arithmetic bound enforcement

## [0.7.0] — 2026-03-28

### Added
- Streak Tier Progress Bar — horizontal progress indicator between hype bar and game grid, visually tracking combo progress toward the next tier (3x NICE → 5x FIRE → 8x GODLIKE → 12x LEGENDARY)
- Tier markers with color-coded notches (green/gold/red/purple) and labeled positions (3x, 5x, 8x, 12x)
- Fill bar animates with tier-appropriate color as streak grows, resets smoothly on failed swaps
- Glow pulse effect fires on tier threshold hits — expanded fill with fade-out animation
- Escalating camera shake on high streaks: 5x (subtle), 8x (medium), 12x (intense) — adds visceral impact to big combos

## [0.6.2] — 2026-03-27

### Changed
- Extracted `drawCard()` utility — eliminates 15+ duplicated `fillRoundedRect`/`strokeRoundedRect` card-drawing blocks across all scenes (StatsScene, ScanScene, GameOverScene, TipsScene, GameScene, TutorialScene)
- Extracted `drawSceneHeader()` utility — unifies scene title rendering across TipsScene, StatsScene, and ScanScene
- Replaced TipsScene hand-rolled back button with `createButton()` for consistent hover behavior
- Refactored `_drawSoundBtnBg` and pause button to use `drawCard()` internally

## [0.6.1] — 2026-03-27

### Security
- Eliminated last `unsafe-inline` CSP directive — service worker offline fallback page now uses pre-cached external `src/offline.css` instead of inline `<style>` tags
- Tightened `OFFLINE_CSP` from `style-src 'unsafe-inline'` to `style-src 'self'` — the entire app now has zero `unsafe-inline` across all code paths (main page, SW responses, and offline fallback)
- Bumped SW cache version to `whatspoppin-v6` to ensure existing installs pick up the new `offline.css` asset

## [0.6.0] — 2026-03-26

### Added
- Performance Scan scene — deep player evaluation accessible from Career Stats. Calculates skill bracket (Rookie/Player/Baller/Elite/Goated/Mythic) based on average score, displays animated progress bars for avg score, points-per-pop efficiency, and streak peak, then generates 3 progressive challenges tailored to the player's current stats (next bracket target, streak tier unlock, efficiency improvement, consistency proof)
- Scan icon added to procedural Icons system — radar crosshair in cyan (`#00e5ff`)
- ScanScene registered in Phaser config and navigable from StatsScene via "PERFORMANCE SCAN" button

## [0.5.1] — 2026-03-26

### Fixed
- Audio timer leak — `stopBgBeat()` now clears the pending `setTimeout`, preventing orphaned `bgLoop()` callbacks on rapid start/stop cycles (game restart, pause toggle)
- Audio memory leak — `bgNodes` array cleared each bar to prevent unbounded accumulation of stopped `AudioNode` references during long Zen mode sessions (~13K dead refs per 30 min)
- Redundant grid scan — `resolveInitialMatches()` was calling `findAllMatches()` twice per loop iteration; now caches the result and re-scans only after mutations

## [0.5.0] — 2026-03-24

### Added
- Sound toggle system — mute/unmute audio from the title screen (top-right speaker icon) or the in-game pause menu
- Persistent mute preference — sound state saved via SafeStorage and restored across sessions and scene transitions
- Speaker and muted-speaker icons added to procedural Icons system (no external assets)
- AudioEngine `setMuted()` / `toggleMute()` methods with smooth gain ramping (no clicks or pops)
- Pause menu now includes a SOUND: ON/OFF toggle button between the tip and resume button
- Pause card height expanded to accommodate sound toggle without cramping other controls

## [0.4.1] — 2026-03-24

### Fixed
- Cascade race condition — `startCascadeCycle()` delayed timers now bail out when `gameOver` is true, preventing score/stat mutation after the game has ended
- `processMatches()` guarded against `gameOver` to stop match processing on a dead game
- Timer event explicitly cancelled in `endGame()` to prevent ghost ticks
- GameOverScene now shows "GAME OVER" in Zen mode instead of hardcoded "TIME'S UP"
- "Play Again" button now replays the correct mode (was hardcoded to timed)
- Exiting via pause menu now saves career stats and high score, fixing data loss for Zen mode players who quit mid-session

## [0.4.0] — 2026-03-23

### Added
- Career Stats system — persistent cross-session stat tracking (games played, total score, total pops, best score, best streak) using checksummed SafeStorage
- Stats Scene — dedicated dashboard with 2×2 stat grid, lifetime score bar, per-game averages, and highest streak tier with character display
- Career Stats button on title screen (appears after first game) showing games played and total pops
- Session pop tracking in GameScene — accumulates pops across all matches and power-up activations
- Career data passed to GameOverScene for future integration (new records, career totals)

## [0.3.5] — 2026-03-23

### Added
- 26 new unit tests covering two previously untested modules: SafeStorage and CareerStats
- SafeStorage tests: checksum tamper detection, integer parsing edge cases (negative, NaN, Infinity), fallback behavior, legacy data without checksums, value coercion
- CareerStats tests: cross-session accumulation (score, pops, streak), record flag accuracy, corrupted JSON recovery, partial data forward compatibility, zero-score games, persistence across load/record cycles
- processMatches totalPops accumulation tests for cascade simulation

## [0.3.4] — 2026-03-22

### Changed
- Decomposed `processMatches()` (137-line god method) into three focused methods: `calculateMatchScore()` for pure scoring logic, `applyMatchFeedback()` for sensory feedback (sound, shake, flash, popup, hype bar), and `startCascadeCycle()` for the recursive drop → refill → re-check loop
- `processMatches()` now reads as a clean orchestrator — each responsibility is independently readable and modifiable
- No behavioral changes — all 82 tests pass unchanged

## [0.3.3] — 2026-03-21

### Security
- Extracted inline `<style>` to external `src/styles.css` — removes last `'unsafe-inline'` from CSP (`style-src 'self'`), closing CSS injection vector
- Offline fallback page now uses a minimal `default-src 'none'` CSP scoped to its own synthesized response, preventing privilege escalation from the relaxed inline style allowance
- Added `manifest.json` and `src/styles.css` to service worker cache — PWA manifest now works offline
- Bumped service worker cache to `whatspoppin-v5` to invalidate stale caches

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
