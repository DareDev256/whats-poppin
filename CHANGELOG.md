# Changelog

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
