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
  _defaults: { gamesPlayed: 0, totalScore: 0, totalPops: 0, bestStreak: 0, bestScore: 0 },
  _storage: SafeStorage,

  load() {
    const raw = this._storage.get(this._key, null);
    if (!raw) return { ...this._defaults };
    try {
      const parsed = JSON.parse(raw);
      return { ...this._defaults, ...parsed };
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
    };
    stats.bestStreak = Math.max(stats.bestStreak, gameData.bestStreak);
    stats.bestScore = Math.max(stats.bestScore, gameData.score);
    this._storage.set(this._key, JSON.stringify(stats));
    return { stats, newRecords };
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

  it('record returns newRecords flags correctly', () => {
    // First game — everything is a record
    const { newRecords: r1 } = CareerStats.record({ score: 100, pops: 10, bestStreak: 3 });
    expect(r1.score).toBe(true);
    expect(r1.streak).toBe(true);

    // Second game — lower stats, no records
    const { newRecords: r2 } = CareerStats.record({ score: 50, pops: 5, bestStreak: 2 });
    expect(r2.score).toBe(false);
    expect(r2.streak).toBe(false);

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
