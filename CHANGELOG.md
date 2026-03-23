# Changelog

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
