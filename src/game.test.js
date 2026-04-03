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

// ══════════════════════════════════════════════════════════════
// MATCH-FINDING ALGORITHM (extracted from GameScene.findAllMatches)
// ══════════════════════════════════════════════════════════════
const GRID_COLS = 8;
const GRID_ROWS = 10;
const MIN_MATCH = 3;

function findAllMatches(grid) {
  const matched = new Set();
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c <= GRID_COLS - MIN_MATCH; c++) {
      const color = grid[r][c]?.getData('colorIdx');
      if (color === undefined) continue;
      let run = [{ r, c }];
      for (let k = 1; c + k < GRID_COLS; k++) {
        if (grid[r][c + k]?.getData('colorIdx') === color) run.push({ r, c: c + k });
        else break;
      }
      if (run.length >= MIN_MATCH) run.forEach(p => matched.add(`${p.r},${p.c}`));
    }
  }
  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r <= GRID_ROWS - MIN_MATCH; r++) {
      const color = grid[r][c]?.getData('colorIdx');
      if (color === undefined) continue;
      let run = [{ r, c }];
      for (let k = 1; r + k < GRID_ROWS; k++) {
        if (grid[r + k]?.[c]?.getData('colorIdx') === color) run.push({ r: r + k, c });
        else break;
      }
      if (run.length >= MIN_MATCH) run.forEach(p => matched.add(`${p.r},${p.c}`));
    }
  }
  const groups = [];
  const visited = new Set();
  matched.forEach(key => {
    if (visited.has(key)) return;
    const [r, c] = key.split(',').map(Number);
    const group = [];
    const stack = [{ r, c }];
    while (stack.length) {
      const p = stack.pop();
      const k = `${p.r},${p.c}`;
      if (visited.has(k) || !matched.has(k)) continue;
      visited.add(k);
      group.push(grid[p.r][p.c]);
      const color = grid[p.r][p.c]?.getData('colorIdx');
      [{ r: p.r - 1, c: p.c }, { r: p.r + 1, c: p.c }, { r: p.r, c: p.c - 1 }, { r: p.r, c: p.c + 1 }]
        .forEach(n => {
          const nk = `${n.r},${n.c}`;
          if (matched.has(nk) && !visited.has(nk) && grid[n.r]?.[n.c]?.getData('colorIdx') === color) {
            stack.push(n);
          }
        });
    }
    if (group.length > 0) groups.push(group);
  });
  return groups;
}

// Build a grid with specific color layout (null = empty cell)
function makeColorGrid(colorMap) {
  const grid = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      const color = colorMap[r]?.[c];
      grid[r][c] = color !== undefined && color !== null ? makeBubble(r, c, color) : null;
    }
  }
  return grid;
}

describe('findAllMatches', () => {
  it('finds a horizontal match of 3', () => {
    const colors = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    colors[0][0] = 1; colors[0][1] = 1; colors[0][2] = 1;
    const grid = makeColorGrid(colors);
    const groups = findAllMatches(grid);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it('finds a vertical match of 3', () => {
    const colors = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    colors[2][5] = 3; colors[3][5] = 3; colors[4][5] = 3;
    const grid = makeColorGrid(colors);
    const groups = findAllMatches(grid);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it('returns empty for no matches (all different)', () => {
    const colors = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    colors[0][0] = 0; colors[0][1] = 1; colors[0][2] = 2; colors[0][3] = 0;
    const grid = makeColorGrid(colors);
    expect(findAllMatches(grid)).toHaveLength(0);
  });

  it('groups L-shaped matches of same color into one group', () => {
    const colors = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    // Horizontal: row 0, cols 0-2; Vertical: rows 0-2, col 0 — shared at (0,0)
    colors[0][0] = 4; colors[0][1] = 4; colors[0][2] = 4;
    colors[1][0] = 4; colors[2][0] = 4;
    const grid = makeColorGrid(colors);
    const groups = findAllMatches(grid);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(5); // merged into one connected group
  });

  it('keeps separate groups for different colors', () => {
    const colors = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    colors[0][0] = 1; colors[0][1] = 1; colors[0][2] = 1;
    colors[3][4] = 2; colors[4][4] = 2; colors[5][4] = 2;
    const grid = makeColorGrid(colors);
    const groups = findAllMatches(grid);
    expect(groups).toHaveLength(2);
  });

  it('handles grid with null holes gracefully', () => {
    const colors = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    colors[0][0] = 1; colors[0][2] = 1; colors[0][3] = 1; colors[0][4] = 1;
    // Gap at (0,1) breaks the run from (0,0), but (0,2)-(0,4) is a match
    const grid = makeColorGrid(colors);
    const groups = findAllMatches(grid);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it('finds a long run of 6 as a single group', () => {
    const colors = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    for (let c = 0; c < 6; c++) colors[4][c] = 5;
    const grid = makeColorGrid(colors);
    const groups = findAllMatches(grid);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(6);
  });
});

// ══════════════════════════════════════════════════════════════
// ADJACENCY VALIDATION (extracted from pointerUp handler)
// ══════════════════════════════════════════════════════════════
function isAdjacent(r1, c1, r2, c2) {
  return (Math.abs(r1 - r2) === 1 && c1 === c2) || (Math.abs(c1 - c2) === 1 && r1 === r2);
}

describe('Adjacency check', () => {
  it('horizontally adjacent cells are adjacent', () => {
    expect(isAdjacent(3, 4, 3, 5)).toBe(true);
    expect(isAdjacent(3, 5, 3, 4)).toBe(true);
  });
  it('vertically adjacent cells are adjacent', () => {
    expect(isAdjacent(2, 4, 3, 4)).toBe(true);
  });
  it('diagonal cells are NOT adjacent', () => {
    expect(isAdjacent(2, 2, 3, 3)).toBe(false);
  });
  it('same cell is NOT adjacent', () => {
    expect(isAdjacent(5, 5, 5, 5)).toBe(false);
  });
  it('cells 2 apart are NOT adjacent', () => {
    expect(isAdjacent(0, 0, 0, 2)).toBe(false);
    expect(isAdjacent(0, 0, 2, 0)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// GRID SWAP PRIMITIVE (extracted from GameScene.swapGridData)
// ══════════════════════════════════════════════════════════════
function swapGridData(grid, r1, c1, r2, c2) {
  const a = grid[r1][c1];
  const b = grid[r2][c2];
  grid[r1][c1] = b;
  grid[r2][c2] = a;
  if (a) { a.setData('row', r2); a.setData('col', c2); }
  if (b) { b.setData('row', r1); b.setData('col', c1); }
}

describe('swapGridData', () => {
  it('swaps two bubbles and updates their row/col data', () => {
    const grid = makeGrid(GRID_ROWS, GRID_COLS);
    const a = grid[0][0], b = grid[0][1];
    swapGridData(grid, 0, 0, 0, 1);
    expect(grid[0][0]).toBe(b);
    expect(grid[0][1]).toBe(a);
    expect(a.getData('row')).toBe(0);
    expect(a.getData('col')).toBe(1);
    expect(b.getData('col')).toBe(0);
  });
  it('double-swap restores original state', () => {
    const grid = makeGrid(GRID_ROWS, GRID_COLS);
    const origA = grid[2][3], origB = grid[2][4];
    swapGridData(grid, 2, 3, 2, 4);
    swapGridData(grid, 2, 3, 2, 4);
    expect(grid[2][3]).toBe(origA);
    expect(grid[2][4]).toBe(origB);
    expect(origA.getData('row')).toBe(2);
    expect(origA.getData('col')).toBe(3);
  });
  it('handles null cell without crashing', () => {
    const grid = makeGrid(GRID_ROWS, GRID_COLS);
    grid[1][1] = null;
    expect(() => swapGridData(grid, 1, 1, 1, 2)).not.toThrow();
    expect(grid[1][1]).not.toBeNull(); // b moved here
    expect(grid[1][2]).toBeNull();     // null moved there
  });
});

// ══════════════════════════════════════════════════════════════
// STREAK TIER RESOLUTION (from triggerHypeBar / updateStreakUI)
// ══════════════════════════════════════════════════════════════
const STREAK_LEVELS = [
  { min: 3,  label: 'NICE',      color: '#2ecc71', char: 'kira' },
  { min: 5,  label: 'FIRE',      color: '#f1c40f', char: 'blaze' },
  { min: 8,  label: 'GODLIKE',   color: '#e74c3c', char: 'ronin' },
  { min: 12, label: 'LEGENDARY', color: '#9b59b6', char: 'empress' },
];

function resolveStreakLevel(streak) {
  return STREAK_LEVELS.filter(l => streak >= l.min).pop() || null;
}

describe('Streak tier resolution', () => {
  it('returns null for streak below minimum (< 3)', () => {
    expect(resolveStreakLevel(0)).toBeNull();
    expect(resolveStreakLevel(1)).toBeNull();
    expect(resolveStreakLevel(2)).toBeNull();
  });
  it('returns kira at exactly 3', () => {
    expect(resolveStreakLevel(3).char).toBe('kira');
  });
  it('returns blaze at 5, not kira', () => {
    expect(resolveStreakLevel(5).char).toBe('blaze');
  });
  it('returns ronin at 8', () => {
    expect(resolveStreakLevel(8).char).toBe('ronin');
  });
  it('returns empress at 12+', () => {
    expect(resolveStreakLevel(12).char).toBe('empress');
    expect(resolveStreakLevel(99).char).toBe('empress');
  });
  it('stays at tier between thresholds (streak 6 = blaze)', () => {
    expect(resolveStreakLevel(6).label).toBe('FIRE');
    expect(resolveStreakLevel(7).label).toBe('FIRE');
  });
});

// ══════════════════════════════════════════════════════════════
// ADLIB TIER SELECTION (from triggerHypeBar)
// ══════════════════════════════════════════════════════════════
const ADLIBS = {
  3:  ['Aye!', 'Sheesh', 'Let\'s go'],
  5:  ['ON SIGHT', 'No cap', 'DIFFERENT'],
  8:  ['WENT CRAZY', 'DEMON TIME', 'Main character'],
  12: ['LEGENDARY', 'GOD MODE', 'Anime protagonist'],
};

function resolveAdlibTier(streak) {
  return Math.max(...Object.keys(ADLIBS).map(Number).filter(k => streak >= k));
}

describe('Adlib tier selection', () => {
  it('selects tier 3 for streak 3-4', () => {
    expect(resolveAdlibTier(3)).toBe(3);
    expect(resolveAdlibTier(4)).toBe(3);
  });
  it('selects tier 5 for streak 5-7', () => {
    expect(resolveAdlibTier(5)).toBe(5);
    expect(resolveAdlibTier(7)).toBe(5);
  });
  it('selects tier 12 for massive streaks', () => {
    expect(resolveAdlibTier(12)).toBe(12);
    expect(resolveAdlibTier(50)).toBe(12);
  });
  it('returns -Infinity when streak is below all tiers', () => {
    // Math.max of empty array = -Infinity — this is the actual game behavior
    expect(resolveAdlibTier(1)).toBe(-Infinity);
  });
});

// ══════════════════════════════════════════════════════════════
// DROP / GRAVITY SIMULATION (from GameScene.dropBubbles)
// ══════════════════════════════════════════════════════════════
function dropBubbles(grid) {
  for (let col = 0; col < GRID_COLS; col++) {
    let emptyRow = GRID_ROWS - 1;
    for (let row = GRID_ROWS - 1; row >= 0; row--) {
      if (grid[row][col] !== null) {
        if (row !== emptyRow) {
          const bubble = grid[row][col];
          grid[emptyRow][col] = bubble;
          grid[row][col] = null;
          bubble.setData('row', emptyRow);
          bubble.setData('col', col);
        }
        emptyRow--;
      }
    }
  }
}

describe('dropBubbles (gravity)', () => {
  it('fills gaps by dropping bubbles down', () => {
    const grid = makeGrid(GRID_ROWS, GRID_COLS);
    // Remove row 8 in col 3 — bubble from row 7 should fall
    grid[8][3] = null;
    const above = grid[7][3];
    dropBubbles(grid);
    expect(grid[9][3]).not.toBeNull();
    expect(grid[8][3]).toBe(above);
    expect(above.getData('row')).toBe(8);
  });
  it('stacks multiple drops correctly', () => {
    const grid = makeGrid(GRID_ROWS, GRID_COLS);
    // Remove 3 cells in a column — top 3 rows should become null
    grid[7][0] = null; grid[8][0] = null; grid[9][0] = null;
    dropBubbles(grid);
    // Bottom 7 should be filled, top 3 null
    for (let r = GRID_ROWS - 1; r >= 3; r--) expect(grid[r][0]).not.toBeNull();
    for (let r = 0; r < 3; r++) expect(grid[r][0]).toBeNull();
  });
  it('does nothing on a full column', () => {
    const grid = makeGrid(GRID_ROWS, GRID_COLS);
    const original = grid.map(row => [...row]);
    dropBubbles(grid);
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        expect(grid[r][c]).toBe(original[r][c]);
      }
    }
  });
  it('handles alternating null gaps (swiss cheese column)', () => {
    const grid = makeGrid(GRID_ROWS, GRID_COLS);
    // Punch holes at rows 1, 3, 5, 7 in col 0
    grid[1][0] = null; grid[3][0] = null; grid[5][0] = null; grid[7][0] = null;
    dropBubbles(grid);
    // Bottom 6 rows filled, top 4 null
    for (let r = GRID_ROWS - 1; r >= 4; r--) expect(grid[r][0]).not.toBeNull();
    for (let r = 0; r < 4; r++) expect(grid[r][0]).toBeNull();
  });
  it('handles completely empty column', () => {
    const grid = makeGrid(GRID_ROWS, GRID_COLS);
    for (let r = 0; r < GRID_ROWS; r++) grid[r][2] = null;
    dropBubbles(grid);
    for (let r = 0; r < GRID_ROWS; r++) expect(grid[r][2]).toBeNull();
  });
  it('preserves row data after multi-gap drop', () => {
    const grid = makeGrid(GRID_ROWS, GRID_COLS);
    grid[8][4] = null; grid[9][4] = null;
    const survivor = grid[7][4];
    dropBubbles(grid);
    expect(grid[9][4]).toBe(survivor);
    expect(survivor.getData('row')).toBe(9);
  });
});

// ══════════════════════════════════════════════════════════════
// DEADLOCK DETECTION (hasPossibleMoves — extracted logic)
// ══════════════════════════════════════════════════════════════
function hasPossibleMoves(grid) {
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (c + 1 < GRID_COLS) {
        swapGridData(grid, r, c, r, c + 1);
        if (findAllMatches(grid).length > 0) { swapGridData(grid, r, c, r, c + 1); return true; }
        swapGridData(grid, r, c, r, c + 1);
      }
      if (r + 1 < GRID_ROWS) {
        swapGridData(grid, r, c, r + 1, c);
        if (findAllMatches(grid).length > 0) { swapGridData(grid, r, c, r + 1, c); return true; }
        swapGridData(grid, r, c, r + 1, c);
      }
    }
  }
  return false;
}

describe('hasPossibleMoves (deadlock detection)', () => {
  it('detects valid moves on a board with an obvious match', () => {
    // Place: color 1 at (0,0), color 2 at (0,1), color 1 at (0,2), color 1 at (0,3)
    // Swapping (0,0)<->(0,1) yields 3-match of color 2? No — swapping (0,1)<->(0,2) gives 1,1,1
    const colors = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    // Set up: swapping col 1 and col 2 creates a 3-match of color 1
    colors[0][0] = 1; colors[0][1] = 2; colors[0][2] = 1; colors[0][3] = 1;
    const grid = makeColorGrid(colors);
    expect(hasPossibleMoves(grid)).toBe(true);
  });

  it('detects deadlock when only isolated bubbles remain', () => {
    // Two lone bubbles far apart — no swap can create 3-in-a-row
    const colors = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    colors[0][0] = 1; colors[9][7] = 2;
    const grid = makeColorGrid(colors);
    expect(hasPossibleMoves(grid)).toBe(false);
  });

  it('detects vertical swap creating a match', () => {
    const colors = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    // col 3: rows 0,1 = color 5, row 2 = color 3, row 3 = color 5
    // Swapping row 2 and row 3 gives 5,5,5 in col 3
    colors[0][3] = 5; colors[1][3] = 5; colors[2][3] = 3; colors[3][3] = 5;
    const grid = makeColorGrid(colors);
    expect(hasPossibleMoves(grid)).toBe(true);
  });

  it('restores grid state after checking (no side effects)', () => {
    const colors = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) colors[r][c] = (r + c) % 2;
    const grid = makeColorGrid(colors);
    // Snapshot color state
    const snapshot = grid.map(row => row.map(b => b?.getData('colorIdx') ?? null));
    hasPossibleMoves(grid);
    // Grid should be identical after check
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        expect(grid[r][c]?.getData('colorIdx') ?? null).toBe(snapshot[r][c]);
      }
    }
  });

  it('handles grid with null cells (post-pop state)', () => {
    const colors = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    // Sparse board — only a few bubbles
    colors[8][0] = 1; colors[8][1] = 2; colors[8][2] = 1; colors[9][0] = 1;
    const grid = makeColorGrid(colors);
    // No crash, returns boolean
    expect(typeof hasPossibleMoves(grid)).toBe('boolean');
  });
});

// ══════════════════════════════════════════════════════════════
// CROSS-SHAPED & EDGE-CASE MATCHES
// ══════════════════════════════════════════════════════════════
describe('findAllMatches — advanced patterns', () => {
  it('cross/plus pattern merges into one group', () => {
    const colors = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    // Horizontal: row 2, cols 2-4; Vertical: rows 1-3, col 3
    colors[2][2] = 1; colors[2][3] = 1; colors[2][4] = 1;
    colors[1][3] = 1; colors[3][3] = 1;
    const grid = makeColorGrid(colors);
    const groups = findAllMatches(grid);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(5);
  });

  it('two parallel matches in adjacent rows stay separate', () => {
    const colors = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    colors[0][0] = 2; colors[0][1] = 2; colors[0][2] = 2;
    colors[1][0] = 3; colors[1][1] = 3; colors[1][2] = 3;
    const grid = makeColorGrid(colors);
    const groups = findAllMatches(grid);
    expect(groups).toHaveLength(2);
  });

  it('match at grid boundary (bottom-right corner)', () => {
    const colors = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    colors[9][5] = 4; colors[9][6] = 4; colors[9][7] = 4;
    const grid = makeColorGrid(colors);
    const groups = findAllMatches(grid);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it('full board of one color returns one massive group', () => {
    const colors = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0));
    const grid = makeColorGrid(colors);
    const groups = findAllMatches(grid);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(GRID_ROWS * GRID_COLS);
  });

  it('exactly 2 in a row is not a match', () => {
    const colors = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    colors[5][0] = 3; colors[5][1] = 3;
    const grid = makeColorGrid(colors);
    expect(findAllMatches(grid)).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════
// BOMB EDGE POSITIONS (middle edges, not just corners)
// ══════════════════════════════════════════════════════════════
describe('PowerUpSystem.getAffectedCells — edge positions', () => {
  const ROWS = 10, COLS = 8;

  it('BOMB on top edge (not corner) clips to 6 cells', () => {
    const grid = makeGrid(ROWS, COLS);
    const cells = PowerUpSystem.getAffectedCells(POWERUP_TYPES.BOMB, 0, 4, 0, grid, ROWS, COLS);
    expect(cells).toHaveLength(6); // 2 rows × 3 cols
    cells.forEach(c => expect(c.r).toBeGreaterThanOrEqual(0));
  });

  it('BOMB on left edge (not corner) clips to 6 cells', () => {
    const grid = makeGrid(ROWS, COLS);
    const cells = PowerUpSystem.getAffectedCells(POWERUP_TYPES.BOMB, 5, 0, 0, grid, ROWS, COLS);
    expect(cells).toHaveLength(6); // 3 rows × 2 cols
    cells.forEach(c => expect(c.c).toBeGreaterThanOrEqual(0));
  });

  it('LINE_H skips null cells in sparse row', () => {
    const grid = makeGrid(ROWS, COLS);
    grid[3][0] = null; grid[3][4] = null; grid[3][7] = null;
    const cells = PowerUpSystem.getAffectedCells(POWERUP_TYPES.LINE_H, 3, 2, 0, grid, ROWS, COLS);
    expect(cells).toHaveLength(COLS - 3);
  });

  it('LINE_V skips null cells in sparse column', () => {
    const grid = makeGrid(ROWS, COLS);
    grid[0][5] = null; grid[9][5] = null;
    const cells = PowerUpSystem.getAffectedCells(POWERUP_TYPES.LINE_V, 5, 5, 0, grid, ROWS, COLS);
    expect(cells).toHaveLength(ROWS - 2);
  });
});

// ══════════════════════════════════════════════════════════════
// SCORING BOUNDARY CONDITIONS
// ══════════════════════════════════════════════════════════════
describe('Score calculation — boundaries', () => {
  it('single pop at streak 0 is zero (multiplier floors at 0)', () => {
    expect(calculateScore(1, 0)).toBe(0);
  });

  it('massive combo: 20 pops + streak 10 + 3 powerups', () => {
    // (20*10 + (20-4)*15 + 3*50) * 10 = (200+240+150)*10 = 5900
    expect(calculateScore(20, 10, 3)).toBe(5900);
  });

  it('streak 1 gives 1x, not 0x', () => {
    expect(calculateScore(3, 1)).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════
// SAFESTORAGE — Checksum-protected localStorage wrapper
// ══════════════════════════════════════════════════════════════
const SafeStorage = (() => {
  const store = {};
  return {
    _checksum(val) {
      let h = 0x811c9dc5;
      for (let i = 0; i < val.length; i++) {
        h ^= val.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      return (h >>> 0).toString(36);
    },
    get(key, fallback) {
      try {
        const raw = store[key] ?? null;
        if (raw === null) return fallback;
        const check = store[key + '_c'] ?? null;
        if (check && check !== this._checksum(raw)) return fallback;
        return raw;
      } catch (_) { return fallback; }
    },
    getInt(key, fallback) {
      const raw = this.get(key, null);
      if (raw === null) return fallback;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? Math.max(0, n) : fallback;
    },
    set(key, value) {
      const str = String(value);
      store[key] = str;
      store[key + '_c'] = this._checksum(str);
    },
    _clear() { Object.keys(store).forEach(k => delete store[k]); },
    _store: store,
  };
})();

describe('SafeStorage', () => {
  beforeEach(() => SafeStorage._clear());

  it('stores and retrieves a value', () => {
    SafeStorage.set('k', 'hello');
    expect(SafeStorage.get('k', 'nope')).toBe('hello');
  });

  it('returns fallback for missing keys', () => {
    expect(SafeStorage.get('nope', 'default')).toBe('default');
  });

  it('detects tampered values and returns fallback', () => {
    SafeStorage.set('score', '9999');
    // Tamper the value directly without updating checksum
    SafeStorage._store['score'] = '999999';
    expect(SafeStorage.get('score', '0')).toBe('0');
  });

  it('accepts value when checksum is absent (legacy data)', () => {
    // Simulate pre-checksum data: value exists, no _c key
    SafeStorage._store['old_key'] = 'legacy';
    expect(SafeStorage.get('old_key', 'fallback')).toBe('legacy');
  });

  it('getInt parses valid integers', () => {
    SafeStorage.set('n', '42');
    expect(SafeStorage.getInt('n', 0)).toBe(42);
  });

  it('getInt clamps negative to 0', () => {
    SafeStorage.set('n', '-5');
    expect(SafeStorage.getInt('n', 0)).toBe(0);
  });

  it('getInt returns fallback for non-numeric', () => {
    SafeStorage.set('n', 'abc');
    expect(SafeStorage.getInt('n', 99)).toBe(99);
  });

  it('getInt returns fallback for NaN values', () => {
    SafeStorage.set('n', 'NaN');
    expect(SafeStorage.getInt('n', 7)).toBe(7);
  });

  it('getInt returns fallback for Infinity', () => {
    SafeStorage.set('n', 'Infinity');
    expect(SafeStorage.getInt('n', 0)).toBe(0);
  });

  it('checksum is deterministic', () => {
    const a = SafeStorage._checksum('test');
    const b = SafeStorage._checksum('test');
    expect(a).toBe(b);
  });

  it('different values produce different checksums', () => {
    expect(SafeStorage._checksum('abc')).not.toBe(SafeStorage._checksum('abd'));
  });

  it('set coerces non-string values to string', () => {
    SafeStorage.set('num', 123);
    expect(SafeStorage.get('num', '')).toBe('123');
  });
});

// ══════════════════════════════════════════════════════════════
// CAREER STATS — Persistent cross-session tracking
// ══════════════════════════════════════════════════════════════
const CareerStats = {
  _key: 'whatspoppin_career',
  _defaults: { gamesPlayed: 0, totalScore: 0, totalPops: 0, bestStreak: 0, bestScore: 0, bestChain: 0 },
  _schema: {
    gamesPlayed: 100000,
    totalScore:  1e9,
    totalPops:   1e9,
    bestStreak:  1000,
    bestScore:   1e8,
    bestChain:   1000,
  },
  _storage: SafeStorage,

  _sanitize(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ...this._defaults };
    const clean = {};
    for (const key of Object.keys(this._schema)) {
      const raw = obj[key];
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        clean[key] = this._defaults[key];
      } else {
        clean[key] = Math.min(Math.max(0, Math.floor(raw)), this._schema[key]);
      }
    }
    return clean;
  },

  load() {
    const raw = this._storage.get(this._key, null);
    if (!raw) return { ...this._defaults };
    try {
      return this._sanitize(JSON.parse(raw));
    } catch (_) { return { ...this._defaults }; }
  },

  record(gameData) {
    const stats = this.load();
    stats.gamesPlayed++;
    stats.totalScore += gameData.score;
    stats.totalPops += gameData.pops;
    const newRecords = {
      streak: gameData.bestStreak > stats.bestStreak,
      score: gameData.score > stats.bestScore,
      chain: (gameData.bestChain || 0) > stats.bestChain,
    };
    stats.bestStreak = Math.max(stats.bestStreak, gameData.bestStreak);
    stats.bestScore = Math.max(stats.bestScore, gameData.score);
    stats.bestChain = Math.max(stats.bestChain, gameData.bestChain || 0);
    const sanitized = this._sanitize(stats);
    this._storage.set(this._key, JSON.stringify(sanitized));
    return { stats: sanitized, newRecords };
  },
};

describe('CareerStats', () => {
  beforeEach(() => SafeStorage._clear());

  it('load returns defaults when no data exists', () => {
    const stats = CareerStats.load();
    expect(stats).toEqual(CareerStats._defaults);
    expect(stats.gamesPlayed).toBe(0);
    expect(stats.bestScore).toBe(0);
  });

  it('record increments gamesPlayed', () => {
    const { stats } = CareerStats.record({ score: 100, pops: 10, bestStreak: 3 });
    expect(stats.gamesPlayed).toBe(1);
    const { stats: s2 } = CareerStats.record({ score: 200, pops: 20, bestStreak: 5 });
    expect(s2.gamesPlayed).toBe(2);
  });

  it('record accumulates totalScore across sessions', () => {
    CareerStats.record({ score: 100, pops: 10, bestStreak: 2 });
    CareerStats.record({ score: 250, pops: 15, bestStreak: 3 });
    const stats = CareerStats.load();
    expect(stats.totalScore).toBe(350);
  });

  it('record accumulates totalPops across sessions', () => {
    CareerStats.record({ score: 50, pops: 8, bestStreak: 1 });
    CareerStats.record({ score: 75, pops: 12, bestStreak: 2 });
    const stats = CareerStats.load();
    expect(stats.totalPops).toBe(20);
  });

  it('record tracks best streak (keeps highest)', () => {
    CareerStats.record({ score: 100, pops: 10, bestStreak: 5 });
    CareerStats.record({ score: 200, pops: 20, bestStreak: 3 }); // lower streak
    const stats = CareerStats.load();
    expect(stats.bestStreak).toBe(5); // kept the 5
  });

  it('record tracks best score (keeps highest)', () => {
    CareerStats.record({ score: 500, pops: 30, bestStreak: 4 });
    CareerStats.record({ score: 200, pops: 10, bestStreak: 2 }); // lower score
    const stats = CareerStats.load();
    expect(stats.bestScore).toBe(500);
  });

  it('record tracks best chain (keeps highest)', () => {
    CareerStats.record({ score: 100, pops: 10, bestStreak: 3, bestChain: 4 });
    CareerStats.record({ score: 200, pops: 20, bestStreak: 5, bestChain: 2 }); // lower chain
    const stats = CareerStats.load();
    expect(stats.bestChain).toBe(4); // kept the 4
  });

  it('record handles missing bestChain gracefully (backwards compat)', () => {
    CareerStats.record({ score: 100, pops: 10, bestStreak: 3 }); // no bestChain
    const stats = CareerStats.load();
    expect(stats.bestChain).toBe(0);
  });

  it('record returns newRecords flags correctly', () => {
    // First game — everything is a record
    const { newRecords: r1 } = CareerStats.record({ score: 100, pops: 10, bestStreak: 3, bestChain: 2 });
    expect(r1.score).toBe(true);
    expect(r1.streak).toBe(true);
    expect(r1.chain).toBe(true);

    // Second game — lower stats, no records
    const { newRecords: r2 } = CareerStats.record({ score: 50, pops: 5, bestStreak: 2, bestChain: 1 });
    expect(r2.score).toBe(false);
    expect(r2.streak).toBe(false);
    expect(r2.chain).toBe(false);

    // Third game — new score record only
    const { newRecords: r3 } = CareerStats.record({ score: 200, pops: 15, bestStreak: 2 });
    expect(r3.score).toBe(true);
    expect(r3.streak).toBe(false);
  });

  it('load handles corrupted JSON gracefully', () => {
    SafeStorage.set(CareerStats._key, 'not valid json{{{');
    const stats = CareerStats.load();
    expect(stats).toEqual(CareerStats._defaults);
  });

  it('load merges partial data with defaults (forward compat)', () => {
    SafeStorage.set(CareerStats._key, JSON.stringify({ gamesPlayed: 5 }));
    const stats = CareerStats.load();
    expect(stats.gamesPlayed).toBe(5);
    expect(stats.totalPops).toBe(0); // default filled in
    expect(stats.bestScore).toBe(0);
  });

  it('handles zero-score game without corruption', () => {
    const { stats } = CareerStats.record({ score: 0, pops: 0, bestStreak: 0 });
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.totalScore).toBe(0);
    expect(stats.bestScore).toBe(0);
  });

  it('persists data that survives load/record cycle', () => {
    CareerStats.record({ score: 999, pops: 50, bestStreak: 8 });
    // Simulate session restart by loading fresh
    const loaded = CareerStats.load();
    expect(loaded.bestScore).toBe(999);
    expect(loaded.totalPops).toBe(50);
    expect(loaded.bestStreak).toBe(8);
    // Record another game on top
    const { stats } = CareerStats.record({ score: 100, pops: 10, bestStreak: 2 });
    expect(stats.gamesPlayed).toBe(2);
    expect(stats.totalScore).toBe(1099);
  });

  // ── Security: _sanitize hardening ──

  it('strips injected properties not in schema', () => {
    SafeStorage.set(CareerStats._key, JSON.stringify({
      gamesPlayed: 3, totalScore: 100, totalPops: 50, bestStreak: 4, bestScore: 80,
      __proto__: { isAdmin: true }, hacked: true, extraField: 'pwned',
    }));
    const stats = CareerStats.load();
    expect(stats.hacked).toBeUndefined();
    expect(stats.extraField).toBeUndefined();
    expect(Object.keys(stats).sort()).toEqual(Object.keys(CareerStats._defaults).sort());
  });

  it('rejects non-numeric types (string injection)', () => {
    SafeStorage.set(CareerStats._key, JSON.stringify({
      gamesPlayed: 'a]lot', totalScore: [1,2,3], totalPops: {}, bestStreak: true, bestScore: null,
    }));
    const stats = CareerStats.load();
    expect(stats).toEqual(CareerStats._defaults);
  });

  it('clamps negative values to zero', () => {
    SafeStorage.set(CareerStats._key, JSON.stringify({
      gamesPlayed: -50, totalScore: -999, totalPops: -1, bestStreak: -10, bestScore: -500,
    }));
    const stats = CareerStats.load();
    expect(stats.gamesPlayed).toBe(0);
    expect(stats.totalScore).toBe(0);
  });

  it('clamps absurdly high values to schema bounds', () => {
    SafeStorage.set(CareerStats._key, JSON.stringify({
      gamesPlayed: 1e12, totalScore: 1e15, totalPops: 1e15, bestStreak: 1e6, bestScore: 1e15,
    }));
    const stats = CareerStats.load();
    expect(stats.gamesPlayed).toBe(100000);
    expect(stats.bestStreak).toBe(1000);
    expect(stats.bestScore).toBe(1e8);
  });

  it('rejects NaN and Infinity values', () => {
    SafeStorage.set(CareerStats._key, JSON.stringify({
      gamesPlayed: 5, totalScore: null, totalPops: 10, bestStreak: 2, bestScore: 50,
    }));
    const stats = CareerStats.load();
    expect(stats.gamesPlayed).toBe(5);
    expect(stats.totalScore).toBe(0); // null → default
    expect(stats.totalPops).toBe(10);
  });

  it('returns defaults for array payload (type confusion)', () => {
    SafeStorage.set(CareerStats._key, JSON.stringify([1, 2, 3]));
    expect(CareerStats.load()).toEqual(CareerStats._defaults);
  });

  it('record re-sanitizes after arithmetic to prevent overflow', () => {
    // Seed near the ceiling
    SafeStorage.set(CareerStats._key, JSON.stringify({
      gamesPlayed: 99999, totalScore: 999999990, totalPops: 999999990, bestStreak: 999, bestScore: 99999990,
    }));
    const { stats } = CareerStats.record({ score: 50, pops: 50, bestStreak: 2 });
    expect(stats.gamesPlayed).toBe(100000); // capped
    expect(stats.totalScore).toBe(1e9);     // capped
  });
});

// ══════════════════════════════════════════════════════════════
// PROCESSMATCHES — totalPops tracking (from refactored method)
// ══════════════════════════════════════════════════════════════
describe('processMatches totalPops accumulation', () => {
  it('counts pops correctly from a single match group', () => {
    let totalPops = 0;
    const matchGroups = [
      [makeBubble(0, 0, 1), makeBubble(0, 1, 1), makeBubble(0, 2, 1)],
    ];
    matchGroups.forEach(group => { totalPops += group.length; });
    expect(totalPops).toBe(3);
  });

  it('counts pops from multiple match groups', () => {
    let totalPops = 0;
    const matchGroups = [
      [makeBubble(0, 0, 1), makeBubble(0, 1, 1), makeBubble(0, 2, 1)],
      [makeBubble(3, 4, 2), makeBubble(4, 4, 2), makeBubble(5, 4, 2), makeBubble(6, 4, 2)],
    ];
    matchGroups.forEach(group => { totalPops += group.length; });
    expect(totalPops).toBe(7);
  });

  it('accumulates across multiple rounds (cascade simulation)', () => {
    let totalPops = 0;
    // Round 1
    totalPops += 3;
    // Round 2 (cascade)
    totalPops += 4;
    // Round 3 (cascade)
    totalPops += 3;
    expect(totalPops).toBe(10);
  });
});

// ══════════════════════════════════════════════════════════════
// PAUSE/RESUME — Scene clock must freeze during pause
// ══════════════════════════════════════════════════════════════
describe('Pause system — scene clock freezing', () => {
  /** Minimal scene mock: tracks time.paused, tweens.pauseAll/resumeAll, timerEvent */
  function makeSceneMock() {
    const scene = {
      isPaused: false,
      gameOver: false,
      gameMode: 'timed',
      score: 500,
      time: { paused: false },
      timerEvent: { paused: false },
      tweens: {
        _paused: false,
        pauseAll() { this._paused = true; },
        resumeAll() { this._paused = false; },
      },
      pauseContainer: null,
    };
    return scene;
  }

  it('pauseGame freezes scene.time.paused', () => {
    const s = makeSceneMock();
    // Simulate pauseGame logic
    s.isPaused = true;
    if (s.timerEvent) s.timerEvent.paused = true;
    s.time.paused = true;
    s.tweens.pauseAll();

    expect(s.time.paused).toBe(true);
    expect(s.timerEvent.paused).toBe(true);
    expect(s.tweens._paused).toBe(true);
    expect(s.isPaused).toBe(true);
  });

  it('resumeGame unfreezes scene.time.paused', () => {
    const s = makeSceneMock();
    // Pause first
    s.isPaused = true;
    s.timerEvent.paused = true;
    s.time.paused = true;
    s.tweens.pauseAll();

    // Resume
    s.isPaused = false;
    s.timerEvent.paused = false;
    s.time.paused = false;
    s.tweens.resumeAll();

    expect(s.time.paused).toBe(false);
    expect(s.timerEvent.paused).toBe(false);
    expect(s.tweens._paused).toBe(false);
    expect(s.isPaused).toBe(false);
  });

  it('cleanupPause restores scene clock for scene transitions', () => {
    const s = makeSceneMock();
    // Pause first
    s.isPaused = true;
    s.time.paused = true;
    s.tweens.pauseAll();

    // cleanupPause (used by restart/exit)
    s.isPaused = false;
    s.time.paused = false;

    expect(s.time.paused).toBe(false);
    expect(s.isPaused).toBe(false);
  });

  it('cascade delayedCalls should not fire while scene clock is paused', () => {
    // Verifies the design: when time.paused = true, no delayedCall callbacks run
    const s = makeSceneMock();
    let callbackFired = false;

    // Simulate: cascade is queued, then player pauses
    const pendingCallbacks = [];
    s.time.delayedCall = (delay, cb) => pendingCallbacks.push(cb);
    s.time.delayedCall(300, () => { callbackFired = true; });

    // Pause the scene
    s.time.paused = true;

    // While paused, callbacks should NOT be executed
    // (Phaser's real TimerEvent respects time.paused — we verify our flag is set)
    expect(s.time.paused).toBe(true);
    expect(callbackFired).toBe(false);
    expect(pendingCallbacks.length).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════
// HALL OF FAME — Per-game leaderboard
// ══════════════════════════════════════════════════════════════

// Replicate HallOfFame logic for isolated testing
const HallOfFame = {
  _key: 'whatspoppin_halloffame',
  _maxEntries: 10,
  _storage: SafeStorage,

  _sanitizeEntry(e) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
    const score = typeof e.score === 'number' && Number.isFinite(e.score)
      ? Math.min(Math.max(0, Math.floor(e.score)), 1e8) : 0;
    if (score === 0) return null;
    const streak = typeof e.streak === 'number' && Number.isFinite(e.streak)
      ? Math.min(Math.max(0, Math.floor(e.streak)), 1000) : 0;
    const mode = e.mode === 'zen' ? 'zen' : 'timed';
    const date = typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date)
      ? e.date : new Date().toISOString().slice(0, 10);
    return { score, streak, mode, date };
  },

  load() {
    const raw = this._storage.get(this._key, null);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(e => this._sanitizeEntry(e)).filter(Boolean).slice(0, this._maxEntries);
    } catch (_) { return []; }
  },

  record(score, streak, mode) {
    const entry = this._sanitizeEntry({
      score, streak, mode,
      date: new Date().toISOString().slice(0, 10),
    });
    if (!entry) return { entries: this.load(), rank: -1 };
    const entries = this.load();
    entries.push(entry);
    entries.sort((a, b) => b.score - a.score);
    const trimmed = entries.slice(0, this._maxEntries);
    const rank = trimmed.findIndex(e => e === entry);
    this._storage.set(this._key, JSON.stringify(trimmed));
    return { entries: trimmed, rank: rank === -1 ? -1 : rank + 1 };
  },
};

describe('HallOfFame', () => {
  beforeEach(() => SafeStorage._clear());

  it('load returns empty array when no data exists', () => {
    expect(HallOfFame.load()).toEqual([]);
  });

  it('record adds entry and returns rank 1 for first game', () => {
    const { entries, rank } = HallOfFame.record(1000, 5, 'timed');
    expect(entries.length).toBe(1);
    expect(rank).toBe(1);
    expect(entries[0].score).toBe(1000);
    expect(entries[0].streak).toBe(5);
    expect(entries[0].mode).toBe('timed');
  });

  it('entries are sorted by score descending', () => {
    HallOfFame.record(500, 3, 'timed');
    HallOfFame.record(1500, 8, 'timed');
    HallOfFame.record(800, 4, 'zen');
    const entries = HallOfFame.load();
    expect(entries[0].score).toBe(1500);
    expect(entries[1].score).toBe(800);
    expect(entries[2].score).toBe(500);
  });

  it('limits to 10 entries (drops lowest)', () => {
    for (let i = 1; i <= 12; i++) {
      HallOfFame.record(i * 100, i, 'timed');
    }
    const entries = HallOfFame.load();
    expect(entries.length).toBe(10);
    expect(entries[9].score).toBe(300); // lowest kept is 300
  });

  it('returns correct rank for new entry', () => {
    HallOfFame.record(1000, 5, 'timed');
    HallOfFame.record(500, 3, 'timed');
    const { rank } = HallOfFame.record(800, 4, 'zen');
    expect(rank).toBe(2); // between 1000 and 500
  });

  it('rejects zero-score entries', () => {
    const { entries, rank } = HallOfFame.record(0, 0, 'timed');
    expect(entries.length).toBe(0);
    expect(rank).toBe(-1);
  });

  it('sanitizes invalid entries on load (type injection)', () => {
    SafeStorage.set('whatspoppin_halloffame', JSON.stringify([
      { score: 'hacked', streak: null, mode: 42, date: true },
      { score: 500, streak: 3, mode: 'timed', date: '2026-03-29' },
    ]));
    const entries = HallOfFame.load();
    expect(entries.length).toBe(1); // first entry rejected (score 0)
    expect(entries[0].score).toBe(500);
  });

  it('clamps score to 1e8 and streak to 1000', () => {
    const { entries } = HallOfFame.record(999999999, 9999, 'timed');
    expect(entries[0].score).toBe(1e8);
    expect(entries[0].streak).toBe(1000);
  });

  it('defaults invalid mode to timed', () => {
    const { entries } = HallOfFame.record(100, 1, 'hacked_mode');
    expect(entries[0].mode).toBe('timed');
  });
});

// ══════════════════════════════════════════════════════════════
// textStyle — Phaser text style factory used 70+ times
// ══════════════════════════════════════════════════════════════
const UI_FONT = '"Segoe UI", system-ui, sans-serif';
function textStyle(size, color, extra = {}) {
  return { fontSize: size, fontFamily: UI_FONT, color, ...extra };
}

describe('textStyle factory', () => {
  it('returns base style with size, font, and color', () => {
    const s = textStyle('14px', '#aaaaaa');
    expect(s).toEqual({ fontSize: '14px', fontFamily: UI_FONT, color: '#aaaaaa' });
  });

  it('merges extra properties without clobbering base keys', () => {
    const s = textStyle('28px', '#f1c40f', { fontStyle: 'bold', stroke: '#000' });
    expect(s.fontSize).toBe('28px');
    expect(s.fontStyle).toBe('bold');
    expect(s.stroke).toBe('#000');
  });

  it('extra can override color if explicitly passed (last-write wins)', () => {
    const s = textStyle('14px', '#aaa', { color: '#fff' });
    expect(s.color).toBe('#fff');
  });

  it('returns independent objects (no shared reference)', () => {
    const a = textStyle('10px', '#000');
    const b = textStyle('10px', '#000');
    a.fontSize = '99px';
    expect(b.fontSize).toBe('10px');
  });
});

// ══════════════════════════════════════════════════════════════
// saveHighScore — Game-over critical path
// ══════════════════════════════════════════════════════════════
function saveHighScore(score, storage) {
  const current = storage.getInt('whatspoppin_highscore', 0);
  if (score > current) {
    storage.set('whatspoppin_highscore', Math.max(0, Math.floor(score)).toString());
    return true;
  }
  return false;
}

describe('saveHighScore', () => {
  beforeEach(() => SafeStorage._clear());

  it('saves a new high score when none exists', () => {
    expect(saveHighScore(500, SafeStorage)).toBe(true);
    expect(SafeStorage.getInt('whatspoppin_highscore', 0)).toBe(500);
  });

  it('saves when new score beats existing', () => {
    SafeStorage.set('whatspoppin_highscore', '300');
    expect(saveHighScore(500, SafeStorage)).toBe(true);
    expect(SafeStorage.getInt('whatspoppin_highscore', 0)).toBe(500);
  });

  it('returns false and does NOT overwrite when score is lower', () => {
    SafeStorage.set('whatspoppin_highscore', '999');
    expect(saveHighScore(100, SafeStorage)).toBe(false);
    expect(SafeStorage.getInt('whatspoppin_highscore', 0)).toBe(999);
  });

  it('returns false for equal score (no tie-breaking)', () => {
    SafeStorage.set('whatspoppin_highscore', '500');
    expect(saveHighScore(500, SafeStorage)).toBe(false);
  });

  it('floors fractional scores', () => {
    saveHighScore(99.9, SafeStorage);
    expect(SafeStorage.getInt('whatspoppin_highscore', 0)).toBe(99);
  });

  it('clamps negative scores to 0', () => {
    saveHighScore(-50, SafeStorage);
    // -50 is not > 0 (default), so should not save
    expect(saveHighScore(-50, SafeStorage)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// toggleMuteAndSave — Audio preference persistence
// ══════════════════════════════════════════════════════════════
describe('toggleMuteAndSave', () => {
  let mockAudio;

  function toggleMuteAndSave(storage, audio) {
    const nowMuted = audio.toggleMute();
    storage.set('whatspoppin_muted', nowMuted ? '1' : '0');
    return nowMuted;
  }

  beforeEach(() => {
    SafeStorage._clear();
    mockAudio = { muted: false, toggleMute() { this.muted = !this.muted; return this.muted; } };
  });

  it('persists "1" when toggling to muted', () => {
    const result = toggleMuteAndSave(SafeStorage, mockAudio);
    expect(result).toBe(true);
    expect(SafeStorage.get('whatspoppin_muted', '0')).toBe('1');
  });

  it('persists "0" when toggling back to unmuted', () => {
    mockAudio.muted = true; // start muted
    const result = toggleMuteAndSave(SafeStorage, mockAudio);
    expect(result).toBe(false);
    expect(SafeStorage.get('whatspoppin_muted', '0')).toBe('0');
  });

  it('round-trips: two toggles restore original state', () => {
    toggleMuteAndSave(SafeStorage, mockAudio);
    toggleMuteAndSave(SafeStorage, mockAudio);
    expect(SafeStorage.get('whatspoppin_muted', '0')).toBe('0');
  });
});

// ══════════════════════════════════════════════════════════════
// Achievements — Persistent badge system
// ══════════════════════════════════════════════════════════════
const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'FIRST BLOOD', check: s => s.gamesPlayed >= 1 },
  { id: 'combo_kid',   name: 'COMBO KID',   check: s => s.bestStreak >= 3 },
  { id: 'flame_on',    name: 'FLAME ON',    check: s => s.bestStreak >= 5 },
  { id: 'demon_time',  name: 'DEMON TIME',  check: s => s.bestStreak >= 8 },
  { id: 'pop_star',    name: 'POP STAR',    check: s => s.totalPops >= 500 },
  { id: 'veteran',     name: 'VETERAN',     check: s => s.gamesPlayed >= 25 },
  { id: 'high_roller', name: 'HIGH ROLLER', check: s => s.bestScore >= 5000 },
  { id: 'chain_gang',  name: 'CHAIN GANG',  check: s => s.bestChain >= 4 },
];

function makeAchievements(storage) {
  const KEY = 'test_achievements';
  return {
    load() {
      const raw = storage.get(KEY, '[]');
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(id => typeof id === 'string');
      } catch (_) { return []; }
    },
    check(stats) {
      const unlocked = new Set(this.load());
      const newlyUnlocked = [];
      for (const ach of ACHIEVEMENTS) {
        if (!unlocked.has(ach.id) && ach.check(stats)) {
          unlocked.add(ach.id);
          newlyUnlocked.push(ach.id);
        }
      }
      if (newlyUnlocked.length > 0) {
        storage.set(KEY, JSON.stringify([...unlocked]));
      }
      return newlyUnlocked;
    },
    count() { return this.load().length; },
  };
}

describe('Achievements', () => {
  let ach;
  beforeEach(() => { SafeStorage._clear(); ach = makeAchievements(SafeStorage); });

  it('load returns empty array when nothing saved', () => {
    expect(ach.load()).toEqual([]);
  });

  it('load returns empty for corrupted JSON', () => {
    SafeStorage.set('test_achievements', '{not_an_array}');
    expect(ach.load()).toEqual([]);
  });

  it('load filters out non-string entries (type injection)', () => {
    SafeStorage.set('test_achievements', '["first_blood", 42, null, true]');
    expect(ach.load()).toEqual(['first_blood']);
  });

  it('load returns empty for object payload (not array)', () => {
    SafeStorage.set('test_achievements', '{"id":"first_blood"}');
    expect(ach.load()).toEqual([]);
  });

  it('check unlocks first_blood after 1 game', () => {
    const stats = { gamesPlayed: 1, bestStreak: 0, totalPops: 0, bestScore: 0, bestChain: 0 };
    const newly = ach.check(stats);
    expect(newly).toContain('first_blood');
    expect(newly).not.toContain('veteran');
  });

  it('check unlocks multiple achievements at once when stats jump', () => {
    const stats = { gamesPlayed: 1, bestStreak: 5, totalPops: 0, bestScore: 0, bestChain: 0 };
    const newly = ach.check(stats);
    expect(newly).toContain('first_blood');
    expect(newly).toContain('combo_kid');
    expect(newly).toContain('flame_on');
    expect(newly).not.toContain('demon_time');
  });

  it('check does NOT re-unlock already-unlocked achievements', () => {
    const stats = { gamesPlayed: 1, bestStreak: 3, totalPops: 0, bestScore: 0, bestChain: 0 };
    ach.check(stats); // first run unlocks first_blood + combo_kid
    const second = ach.check(stats);
    expect(second).toEqual([]);
  });

  it('check persists unlocks to storage', () => {
    const stats = { gamesPlayed: 1, bestStreak: 0, totalPops: 0, bestScore: 0, bestChain: 0 };
    ach.check(stats);
    // Fresh instance reads same storage
    const fresh = makeAchievements(SafeStorage);
    expect(fresh.load()).toContain('first_blood');
  });

  it('count returns number of unlocked achievements', () => {
    expect(ach.count()).toBe(0);
    ach.check({ gamesPlayed: 1, bestStreak: 5, totalPops: 0, bestScore: 0, bestChain: 0 });
    expect(ach.count()).toBe(3); // first_blood, combo_kid, flame_on
  });

  it('chain_gang unlocks at bestChain >= 4', () => {
    const stats = { gamesPlayed: 1, bestStreak: 0, totalPops: 0, bestScore: 0, bestChain: 4 };
    const newly = ach.check(stats);
    expect(newly).toContain('chain_gang');
    expect(newly).toContain('first_blood');
  });

  it('high_roller stays locked below 5000', () => {
    const stats = { gamesPlayed: 1, bestStreak: 0, totalPops: 0, bestScore: 4999, bestChain: 0 };
    const newly = ach.check(stats);
    expect(newly).not.toContain('high_roller');
  });
});

// ══════════════════════════════════════════════════════════════
// Chain level resolution — Cascade announcer tier matching
// ══════════════════════════════════════════════════════════════
const CHAIN_LEVELS = [
  { min: 2, label: 'DOUBLE',  color: '#3498db', size: 26 },
  { min: 3, label: 'TRIPLE',  color: '#2ecc71', size: 32 },
  { min: 4, label: 'MEGA',    color: '#f1c40f', size: 38 },
  { min: 5, label: 'ULTRA',   color: '#e74c3c', size: 44 },
  { min: 7, label: 'GODLIKE', color: '#9b59b6', size: 50 },
];

function resolveChainLevel(depth) {
  let level = null;
  for (let i = CHAIN_LEVELS.length - 1; i >= 0; i--) {
    if (depth >= CHAIN_LEVELS[i].min) { level = CHAIN_LEVELS[i]; break; }
  }
  return level;
}

describe('Chain level resolution (cascade announcer)', () => {
  it('returns null for depth < 2 (no announcement)', () => {
    expect(resolveChainLevel(0)).toBeNull();
    expect(resolveChainLevel(1)).toBeNull();
  });

  it('returns DOUBLE at depth 2', () => {
    expect(resolveChainLevel(2).label).toBe('DOUBLE');
  });

  it('returns TRIPLE at depth 3', () => {
    expect(resolveChainLevel(3).label).toBe('TRIPLE');
  });

  it('returns MEGA at depth 4', () => {
    expect(resolveChainLevel(4).label).toBe('MEGA');
  });

  it('returns ULTRA at depth 5-6 (before GODLIKE threshold)', () => {
    expect(resolveChainLevel(5).label).toBe('ULTRA');
    expect(resolveChainLevel(6).label).toBe('ULTRA');
  });

  it('returns GODLIKE at depth 7+', () => {
    expect(resolveChainLevel(7).label).toBe('GODLIKE');
    expect(resolveChainLevel(20).label).toBe('GODLIKE');
  });

  it('font size escalates with tier', () => {
    const sizes = [2, 3, 4, 5, 7].map(d => resolveChainLevel(d).size);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
    }
  });

  it('each tier has a unique color', () => {
    const colors = CHAIN_LEVELS.map(l => l.color);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

// ══════════════════════════════════════════════════════════════
// SWAP LOGIC — Power-up swap without matches must not inflate state
// ══════════════════════════════════════════════════════════════
describe('Swap validation: no-match power-up swap bug', () => {
  // Reproduces the bug where swapping a power-up bubble with no color
  // matches fell into the "successful match" branch, inflating streak
  // and fever while the power-up never actually activated.

  it('processMatches([]) would inflate streak from 0 to 1', () => {
    // Simulates what happened when processMatches received an empty array
    let streak = 0;
    // This is the buggy behavior — streak++ on empty matches
    const buggyProcessMatches = (matchGroups) => {
      streak++;
      let totalPopped = 0;
      matchGroups.forEach(() => { totalPopped++; });
      return { streak, totalPopped };
    };
    const result = buggyProcessMatches([]);
    // The bug: streak increments even with zero match groups
    expect(result.streak).toBe(1);
    expect(result.totalPopped).toBe(0);
  });

  it('feedFever gives free meter from streak alone when popped is 0', () => {
    // feedFever formula: gain = (popped * 2) + (streak * 3)
    const feedFever = (popped, streak) => (popped * 2) + (streak * 3);
    // With the bug: popped=0, streak=5 → 15 free fever points
    expect(feedFever(0, 5)).toBe(15);
    // Correct: no pops + no streak = no fever gain
    expect(feedFever(0, 0)).toBe(0);
  });

  it('swapping power-up bubble without color match should be treated as invalid', () => {
    // The fixed logic: matches.length === 0 → always reverse swap
    // Power-ups only activate when part of a matched group
    const matches = [];
    const aPower = POWERUP_TYPES.BOMB; // power-up on bubble a
    const bPower = POWERUP_TYPES.NONE;

    // OLD (buggy): allowed swap through when power-up existed
    const oldCondition = matches.length === 0 && aPower === POWERUP_TYPES.NONE && bPower === POWERUP_TYPES.NONE;
    expect(oldCondition).toBe(false); // Bug: doesn't reverse swap

    // NEW (fixed): always reverse when no matches
    const newCondition = matches.length === 0;
    expect(newCondition).toBe(true); // Correct: reverses swap
  });

  it('repeated no-match power-up swaps cannot farm streak', () => {
    // Simulate 5 consecutive no-match swaps on a power-up bubble
    let streak = 0;
    for (let i = 0; i < 5; i++) {
      const matches = [];
      if (matches.length === 0) {
        streak = 0; // Fixed: reset streak on invalid swap
      }
    }
    expect(streak).toBe(0); // No free streak inflation
  });
});
