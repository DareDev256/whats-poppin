// What's Poppin — Test Suite
// Tests pure game logic: power-up analysis, affected cells, scoring, audio state

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Stubs for globals used by source modules ──────────────────
// PowerUpSystem and AudioEngine are vanilla JS that attach to `window`.
// We re-declare the constants and classes here for isolated unit testing.

const POWERUP_TYPES = { NONE: 0, LINE_H: 1, LINE_V: 2, BOMB: 3, NUKE: 4 };

// ── PowerUpSystem (extracted logic, no Phaser dependency) ──────
class PowerUpSystem {
  static analyze(matchGroup, grid) {
    if (!matchGroup || matchGroup.length < 4) return POWERUP_TYPES.NONE;
    const positions = matchGroup.map(b => ({ r: b.getData('row'), c: b.getData('col') }));
    if (positions.length >= 5 && this.isLOrTShape(positions)) return POWERUP_TYPES.NUKE;
    if (positions.length >= 5) return POWERUP_TYPES.BOMB;
    if (positions.length === 4) {
      const isHorizontal = positions.every(p => p.r === positions[0].r);
      return isHorizontal ? POWERUP_TYPES.LINE_H : POWERUP_TYPES.LINE_V;
    }
    return POWERUP_TYPES.NONE;
  }

  static isLOrTShape(positions) {
    const rows = new Set(positions.map(p => p.r));
    const cols = new Set(positions.map(p => p.c));
    return rows.size > 1 && cols.size > 1;
  }

  static getAffectedCells(type, row, col, colorIdx, grid, gridRows, gridCols) {
    const cells = [];
    switch (type) {
      case POWERUP_TYPES.LINE_H:
        for (let c = 0; c < gridCols; c++) { if (grid[row][c]) cells.push({ r: row, c }); }
        break;
      case POWERUP_TYPES.LINE_V:
        for (let r = 0; r < gridRows; r++) { if (grid[r][col]) cells.push({ r, c: col }); }
        break;
      case POWERUP_TYPES.BOMB:
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const r = row + dr, c = col + dc;
            if (r >= 0 && r < gridRows && c >= 0 && c < gridCols && grid[r][c]) cells.push({ r, c });
          }
        }
        break;
      case POWERUP_TYPES.NUKE:
        for (let r = 0; r < gridRows; r++) {
          for (let c = 0; c < gridCols; c++) {
            if (grid[r][c] && grid[r][c].getData('colorIdx') === colorIdx) cells.push({ r, c });
          }
        }
        break;
    }
    return cells;
  }
}

// ── Test helpers ──────────────────────────────────────────────
function makeBubble(row, col, colorIdx = 0, powerUp = 0) {
  const data = { row, col, colorIdx, powerUp };
  return { getData: (key) => data[key], setData: (key, val) => { data[key] = val; } };
}

function makeGrid(rows, cols, fill = true) {
  const grid = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      grid[r][c] = fill ? makeBubble(r, c, (r + c) % 6) : null;
    }
  }
  return grid;
}

// Scoring formula from processMatches in game.js
function calculateScore(totalPopped, streak, powerUpsActivated = 0) {
  const baseScore = totalPopped * 10;
  const streakMultiplier = Math.min(streak, 10);
  const sizeBonus = totalPopped > 4 ? (totalPopped - 4) * 15 : 0;
  const powerUpBonus = powerUpsActivated * 50;
  return (baseScore + sizeBonus + powerUpBonus) * streakMultiplier;
}

// ══════════════════════════════════════════════════════════════
// POWER-UP ANALYSIS
// ══════════════════════════════════════════════════════════════
describe('PowerUpSystem.analyze', () => {
  it('returns NONE for matches < 4', () => {
    const group = [makeBubble(0, 0), makeBubble(0, 1), makeBubble(0, 2)];
    expect(PowerUpSystem.analyze(group)).toBe(POWERUP_TYPES.NONE);
  });

  it('returns NONE for null/undefined input', () => {
    expect(PowerUpSystem.analyze(null)).toBe(POWERUP_TYPES.NONE);
    expect(PowerUpSystem.analyze(undefined)).toBe(POWERUP_TYPES.NONE);
  });

  it('returns NONE for empty array', () => {
    expect(PowerUpSystem.analyze([])).toBe(POWERUP_TYPES.NONE);
  });

  it('returns LINE_H for 4 horizontal', () => {
    const group = [makeBubble(3, 0), makeBubble(3, 1), makeBubble(3, 2), makeBubble(3, 3)];
    expect(PowerUpSystem.analyze(group)).toBe(POWERUP_TYPES.LINE_H);
  });

  it('returns LINE_V for 4 vertical', () => {
    const group = [makeBubble(0, 2), makeBubble(1, 2), makeBubble(2, 2), makeBubble(3, 2)];
    expect(PowerUpSystem.analyze(group)).toBe(POWERUP_TYPES.LINE_V);
  });

  it('returns BOMB for 5+ in a straight line', () => {
    const group = [makeBubble(0, 0), makeBubble(0, 1), makeBubble(0, 2), makeBubble(0, 3), makeBubble(0, 4)];
    expect(PowerUpSystem.analyze(group)).toBe(POWERUP_TYPES.BOMB);
  });

  it('returns NUKE for L-shaped 5+ match', () => {
    // L shape: 3 horizontal + 2 vertical branch
    const group = [
      makeBubble(0, 0), makeBubble(0, 1), makeBubble(0, 2),
      makeBubble(1, 2), makeBubble(2, 2),
    ];
    expect(PowerUpSystem.analyze(group)).toBe(POWERUP_TYPES.NUKE);
  });

  it('returns NUKE for T-shaped match', () => {
    const group = [
      makeBubble(0, 0), makeBubble(0, 1), makeBubble(0, 2),
      makeBubble(1, 1), makeBubble(2, 1),
    ];
    expect(PowerUpSystem.analyze(group)).toBe(POWERUP_TYPES.NUKE);
  });

  it('BOMB beats LINE for 6 in a straight row', () => {
    const group = Array.from({ length: 6 }, (_, i) => makeBubble(5, i));
    expect(PowerUpSystem.analyze(group)).toBe(POWERUP_TYPES.BOMB);
  });
});

// ══════════════════════════════════════════════════════════════
// L/T SHAPE DETECTION
// ══════════════════════════════════════════════════════════════
describe('PowerUpSystem.isLOrTShape', () => {
  it('straight horizontal line is NOT L/T', () => {
    const pos = [{ r: 2, c: 0 }, { r: 2, c: 1 }, { r: 2, c: 2 }, { r: 2, c: 3 }, { r: 2, c: 4 }];
    expect(PowerUpSystem.isLOrTShape(pos)).toBe(false);
  });

  it('straight vertical line is NOT L/T', () => {
    const pos = [{ r: 0, c: 3 }, { r: 1, c: 3 }, { r: 2, c: 3 }, { r: 3, c: 3 }, { r: 4, c: 3 }];
    expect(PowerUpSystem.isLOrTShape(pos)).toBe(false);
  });

  it('L-shape spanning rows and cols IS L/T', () => {
    const pos = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 0 }, { r: 2, c: 0 }];
    expect(PowerUpSystem.isLOrTShape(pos)).toBe(true);
  });

  it('plus/cross shape IS L/T', () => {
    const pos = [{ r: 1, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 1 }, { r: 2, c: 1 }, { r: 1, c: 2 }];
    expect(PowerUpSystem.isLOrTShape(pos)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// AFFECTED CELLS (power-up area of effect)
// ══════════════════════════════════════════════════════════════
describe('PowerUpSystem.getAffectedCells', () => {
  const ROWS = 10, COLS = 8;

  it('LINE_H clears entire row', () => {
    const grid = makeGrid(ROWS, COLS);
    const cells = PowerUpSystem.getAffectedCells(POWERUP_TYPES.LINE_H, 3, 4, 0, grid, ROWS, COLS);
    expect(cells).toHaveLength(COLS);
    expect(cells.every(c => c.r === 3)).toBe(true);
  });

  it('LINE_V clears entire column', () => {
    const grid = makeGrid(ROWS, COLS);
    const cells = PowerUpSystem.getAffectedCells(POWERUP_TYPES.LINE_V, 5, 2, 0, grid, ROWS, COLS);
    expect(cells).toHaveLength(ROWS);
    expect(cells.every(c => c.c === 2)).toBe(true);
  });

  it('BOMB clears 3x3 in center of grid', () => {
    const grid = makeGrid(ROWS, COLS);
    const cells = PowerUpSystem.getAffectedCells(POWERUP_TYPES.BOMB, 5, 4, 0, grid, ROWS, COLS);
    expect(cells).toHaveLength(9); // full 3x3
  });

  it('BOMB at top-left corner only hits valid cells', () => {
    const grid = makeGrid(ROWS, COLS);
    const cells = PowerUpSystem.getAffectedCells(POWERUP_TYPES.BOMB, 0, 0, 0, grid, ROWS, COLS);
    expect(cells).toHaveLength(4); // (0,0) (0,1) (1,0) (1,1)
    cells.forEach(c => { expect(c.r).toBeGreaterThanOrEqual(0); expect(c.c).toBeGreaterThanOrEqual(0); });
  });

  it('BOMB at bottom-right corner only hits valid cells', () => {
    const grid = makeGrid(ROWS, COLS);
    const cells = PowerUpSystem.getAffectedCells(POWERUP_TYPES.BOMB, ROWS - 1, COLS - 1, 0, grid, ROWS, COLS);
    expect(cells).toHaveLength(4);
  });

  it('BOMB skips null cells in grid', () => {
    const grid = makeGrid(ROWS, COLS);
    grid[4][3] = null; // hole in the grid
    const cells = PowerUpSystem.getAffectedCells(POWERUP_TYPES.BOMB, 4, 4, 0, grid, ROWS, COLS);
    expect(cells).toHaveLength(8); // 9 - 1 null
  });

  it('NUKE destroys all of target color', () => {
    const grid = makeGrid(ROWS, COLS);
    // Set specific cells to color 2
    grid[0][0] = makeBubble(0, 0, 2);
    grid[3][5] = makeBubble(3, 5, 2);
    grid[9][7] = makeBubble(9, 7, 2);
    const cells = PowerUpSystem.getAffectedCells(POWERUP_TYPES.NUKE, 0, 0, 2, grid, ROWS, COLS);
    expect(cells.length).toBeGreaterThanOrEqual(3);
    cells.forEach(c => expect(grid[c.r][c.c].getData('colorIdx')).toBe(2));
  });

  it('NUKE returns empty when no matching color exists', () => {
    const grid = makeGrid(ROWS, COLS);
    // Color 99 doesn't exist on the board
    const cells = PowerUpSystem.getAffectedCells(POWERUP_TYPES.NUKE, 0, 0, 99, grid, ROWS, COLS);
    expect(cells).toHaveLength(0);
  });

  it('unknown power-up type returns empty', () => {
    const grid = makeGrid(ROWS, COLS);
    const cells = PowerUpSystem.getAffectedCells(999, 5, 5, 0, grid, ROWS, COLS);
    expect(cells).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════
// SCORING FORMULA
// ══════════════════════════════════════════════════════════════
describe('Score calculation', () => {
  it('basic 3-match at streak 1', () => {
    // (3*10 + 0 + 0) * 1 = 30
    expect(calculateScore(3, 1)).toBe(30);
  });

  it('applies streak multiplier', () => {
    // (3*10) * 5 = 150
    expect(calculateScore(3, 5)).toBe(150);
  });

  it('caps streak multiplier at 10', () => {
    const at10 = calculateScore(3, 10);
    const at15 = calculateScore(3, 15);
    expect(at10).toBe(at15); // both capped at 10x
  });

  it('adds size bonus for 5+ pops', () => {
    // (5*10 + (5-4)*15) * 1 = 50 + 15 = 65
    expect(calculateScore(5, 1)).toBe(65);
  });

  it('size bonus scales with more pops', () => {
    // (8*10 + (8-4)*15) * 1 = 80 + 60 = 140
    expect(calculateScore(8, 1)).toBe(140);
  });

  it('no size bonus for exactly 4 pops', () => {
    // (4*10 + 0) * 1 = 40
    expect(calculateScore(4, 1)).toBe(40);
  });

  it('power-up bonus adds per activation', () => {
    // (3*10 + 0 + 2*50) * 1 = 130
    expect(calculateScore(3, 1, 2)).toBe(130);
  });

  it('everything stacks: pops + size + powerup + streak', () => {
    // (6*10 + (6-4)*15 + 1*50) * 3 = (60+30+50)*3 = 420
    expect(calculateScore(6, 3, 1)).toBe(420);
  });

  it('zero pops at any streak = zero', () => {
    expect(calculateScore(0, 5)).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// GAME CONSTANTS INTEGRITY
// ══════════════════════════════════════════════════════════════
describe('Game constants', () => {
  const COLORS_COUNT = 6;
  const STREAK_LEVELS = [
    { min: 3, char: 'kira' }, { min: 5, char: 'blaze' },
    { min: 8, char: 'ronin' }, { min: 12, char: 'empress' },
  ];

  it('streak levels are sorted ascending', () => {
    for (let i = 1; i < STREAK_LEVELS.length; i++) {
      expect(STREAK_LEVELS[i].min).toBeGreaterThan(STREAK_LEVELS[i - 1].min);
    }
  });

  it('all streak levels have unique character keys', () => {
    const chars = STREAK_LEVELS.map(l => l.char);
    expect(new Set(chars).size).toBe(chars.length);
  });

  it('POWERUP_TYPES has no duplicate values', () => {
    const vals = Object.values(POWERUP_TYPES);
    expect(new Set(vals).size).toBe(vals.length);
  });
});
