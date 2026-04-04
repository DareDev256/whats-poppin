// What's Poppin — Bubble Pop Game
// Cultural sauce meets addictive gameplay

// =============================================================
// SECURITY — Safe JSON deserialization (prototype pollution guard)
// =============================================================

/**
 * Parse JSON with prototype pollution protection.
 * Strips __proto__, constructor, and prototype keys recursively
 * to prevent property injection from tampered localStorage data.
 * @param {string} raw - JSON string to parse
 * @returns {*} Parsed value with dangerous keys removed
 */
function safeJSONParse(raw) {
  return JSON.parse(raw, (key, value) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
    return value;
  });
}

// =============================================================
// CONSTANTS
// =============================================================
const GRID_COLS = 8;
const GRID_ROWS = 10;
const BUBBLE_SIZE = 44;
const BUBBLE_PAD = 4;
const GRID_OFFSET_X = 40;
const GRID_OFFSET_Y = 140;
const HYPE_BAR_HEIGHT = 120;
const MIN_MATCH = 3;
const GAME_TIME = 90; // seconds

const COLORS = [
  0x9b59b6, // Royal purple
  0xe74c3c, // Fire red
  0x2ecc71, // Neon green
  0xf1c40f, // Gold
  0x3498db, // Electric blue
  0xff6b35, // Orange flame
];

const COLOR_NAMES = ['purple', 'red', 'green', 'gold', 'blue', 'orange'];

const STREAK_LEVELS = [
  { min: 3,  label: 'NICE',         color: '#2ecc71', size: 28, char: 'kira' },
  { min: 5,  label: 'FIRE',          color: '#f1c40f', size: 34, char: 'blaze' },
  { min: 8,  label: 'GODLIKE',      color: '#e74c3c', size: 42, char: 'ronin' },
  { min: 12, label: 'LEGENDARY',    color: '#9b59b6', size: 50, char: 'empress' },
];

const ADLIBS = {
  3:  ['Aye!', 'Sheesh', 'Let\'s go', 'Vibe check', 'Clean', 'Smooth'],
  5:  ['ON SIGHT', 'No cap', 'DIFFERENT', 'Say less', 'Gang gang', 'HEAT CHECK'],
  8:  ['WENT CRAZY', 'DEMON TIME', 'Main character', 'Built different', 'UNREAL'],
  12: ['LEGENDARY', 'GOD MODE', 'Anime protagonist', 'UNMATCHED', 'TRANSCENDENT'],
};

const UI_FONT = '"Segoe UI", system-ui, sans-serif';

// =============================================================
// SHARED UTILITIES — DRY helpers used across all scenes
// =============================================================

/**
 * Find the highest streak tier matching a value.
 * Replaces the repeated `STREAK_LEVELS.filter(l => val >= l.min).pop()` pattern.
 * @param {number} value - Streak count or similar threshold value
 * @returns {object|null} The highest matching tier, or null if below minimum
 */
function getStreakTier(value) {
  let tier = null;
  for (let i = STREAK_LEVELS.length - 1; i >= 0; i--) {
    if (value >= STREAK_LEVELS[i].min) { tier = STREAK_LEVELS[i]; break; }
  }
  return tier;
}

/**
 * Generate a shareable score card text and trigger Web Share API or clipboard fallback.
 * Returns a promise that resolves when sharing completes or text is copied.
 * @param {object} data - { score, bestStreak, bestChain, moves, mode }
 */
async function shareScore(data) {
  const { score, bestStreak, bestChain, moves, mode } = data;
  const tier = getStreakTier(bestStreak);
  const tierLabel = tier ? tier.label : 'ROOKIE';
  const modeLabel = mode === 'zen' ? 'Zen' : 'Timed';
  const avgPerMove = moves > 0 ? Math.round(score / moves) : 0;
  const chainStr = (bestChain || 0) > 0 ? `${bestChain}x chain` : '';

  const lines = [
    `🎮 What's Poppin — ${modeLabel} Mode`,
    ``,
    `🏆 ${score.toLocaleString()} pts`,
    `🔥 ${bestStreak}x streak (${tierLabel})`,
    chainStr ? `⛓️ ${chainStr}` : '',
    `📊 ${avgPerMove} avg/move`,
    ``,
    `Can you beat that? 👀`,
  ].filter(Boolean).join('\n');

  if (navigator.share) {
    try {
      await navigator.share({ title: "What's Poppin Score", text: lines });
      return 'shared';
    } catch { return 'cancelled'; }
  }
  try {
    await navigator.clipboard.writeText(lines);
    return 'copied';
  } catch { return 'failed'; }
}

/**
 * Initialize audio engine and restore the user's mute preference.
 * Centralizes the init → resume → restore-mute sequence used by multiple scenes.
 */
function initAudioWithPrefs() {
  window.audioEngine.init();
  window.audioEngine.resume();
  const wasMuted = SafeStorage.get('whatspoppin_muted', '0') === '1';
  window.audioEngine.setMuted(wasMuted);
}

/**
 * Build a Phaser text style object with UI_FONT as the default family.
 * Merges caller overrides onto sensible defaults so inline style literals
 * don't need to repeat `fontFamily` 72+ times across every scene.
 * @param {string} size - CSS font-size value (e.g. '14px', '28px')
 * @param {string} color - CSS color string (e.g. '#aaaaaa', '#f1c40f')
 * @param {object} [extra] - Additional Phaser text style properties to merge
 * @returns {object} A complete Phaser text style config
 */
function textStyle(size, color, extra = {}) {
  return { fontSize: size, fontFamily: UI_FONT, color, ...extra };
}

/**
 * Save a new high score to SafeStorage if it exceeds the current record.
 * Centralizes the clamp-floor-stringify-compare pattern used on game-over and exit.
 * @param {number} score - Raw score to evaluate
 * @returns {boolean} True if a new record was set
 */
function saveHighScore(score) {
  const current = SafeStorage.getInt('whatspoppin_highscore', 0);
  if (score > current) {
    SafeStorage.set('whatspoppin_highscore', Math.max(0, Math.floor(score)).toString());
    return true;
  }
  return false;
}

/**
 * Toggle mute state and persist the preference to SafeStorage.
 * Replaces the duplicated toggleMute → set pattern across TitleScene and GameScene.
 * @returns {boolean} The new muted state
 */
function toggleMuteAndSave() {
  const nowMuted = window.audioEngine.toggleMute();
  SafeStorage.set('whatspoppin_muted', nowMuted ? '1' : '0');
  return nowMuted;
}

// =============================================================
// CAREER STATS — Cross-session stat tracking with SafeStorage
// =============================================================
const CareerStats = {
  _key: 'whatspoppin_career',
  _defaults: { gamesPlayed: 0, totalScore: 0, totalPops: 0, bestStreak: 0, bestScore: 0, bestChain: 0, totalFevers: 0 },
  // Schema: every allowed field, its max sane value, and nothing else gets through
  _schema: {
    gamesPlayed: 100000,
    totalScore:  1e9,
    totalPops:   1e9,
    bestStreak:  1000,
    bestScore:   1e8,
    bestChain:   1000,
    totalFevers: 100000,
  },
  _storage: SafeStorage,

  /** Sanitize a raw parsed object — only whitelisted keys, clamped non-negative integers */
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
      return this._sanitize(safeJSONParse(raw));
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
    stats.totalFevers += gameData.fevers || 0;
    // Re-sanitize before persisting to enforce bounds after arithmetic
    const sanitized = this._sanitize(stats);
    this._storage.set(this._key, JSON.stringify(sanitized));
    return { stats: sanitized, newRecords };
  },
};

// =============================================================
// HALL OF FAME — Per-game leaderboard with top 10 ranked entries
// =============================================================
const HallOfFame = {
  _key: 'whatspoppin_halloffame',
  _maxEntries: 10,
  _storage: SafeStorage,

  /** Validate and clamp a single entry */
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
      const parsed = safeJSONParse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(e => this._sanitizeEntry(e)).filter(Boolean).slice(0, this._maxEntries);
    } catch (_) { return []; }
  },

  /** Record a game result. Returns { entries, rank } where rank is 1-indexed or -1 if not placed. */
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

// =============================================================
// ACHIEVEMENTS — Persistent badge system driven by CareerStats
// =============================================================
const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'FIRST BLOOD', desc: 'Play your first game', icon: 'play', color: 0x2ecc71, check: s => s.gamesPlayed >= 1 },
  { id: 'combo_kid', name: 'COMBO KID', desc: 'Hit a 3x streak', icon: 'fire', color: 0x2ecc71, check: s => s.bestStreak >= 3 },
  { id: 'flame_on', name: 'FLAME ON', desc: 'Hit a 5x streak', icon: 'fire', color: 0xf1c40f, check: s => s.bestStreak >= 5 },
  { id: 'demon_time', name: 'DEMON TIME', desc: 'Hit an 8x streak', icon: 'sword', color: 0xe74c3c, check: s => s.bestStreak >= 8 },
  { id: 'transcendent', name: 'TRANSCENDENT', desc: 'Hit a 12x streak', icon: 'crown', color: 0x9b59b6, check: s => s.bestStreak >= 12 },
  { id: 'pop_star', name: 'POP STAR', desc: 'Pop 500 bubbles total', icon: 'star', color: 0x3498db, check: s => s.totalPops >= 500 },
  { id: 'veteran', name: 'VETERAN', desc: 'Play 25 games', icon: 'badge', color: 0xff6b35, check: s => s.gamesPlayed >= 25 },
  { id: 'high_roller', name: 'HIGH ROLLER', desc: 'Score 5,000+ in one game', icon: 'crown', color: 0xf1c40f, check: s => s.bestScore >= 5000 },
  { id: 'chain_gang', name: 'CHAIN GANG', desc: 'Trigger a 4x cascade chain', icon: 'fire', color: 0x00e5ff, check: s => s.bestChain >= 4 },
  { id: 'fever_pitch', name: 'FEVER PITCH', desc: 'Activate Fever Mode', icon: 'fire', color: 0xff2222, check: s => s.totalFevers >= 1 },
];

const Achievements = {
  _key: 'whatspoppin_achievements',
  _storage: SafeStorage,

  /** Load set of unlocked achievement IDs */
  load() {
    const raw = this._storage.get(this._key, '[]');
    try {
      const parsed = safeJSONParse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(id => typeof id === 'string');
    } catch (_) { return []; }
  },

  /** Check stats and return any newly unlocked achievement IDs */
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
      this._storage.set(this._key, JSON.stringify([...unlocked]));
    }
    return newlyUnlocked;
  },

  count() { return this.load().length; },
};

/** Show an achievement toast notification in a scene */
function showAchievementToast(scene, achId) {
  const ach = ACHIEVEMENTS.find(a => a.id === achId);
  if (!ach) return;
  const { width } = scene.scale;
  const toastY = 50;

  const container = scene.add.container(width / 2, toastY - 60).setDepth(200);
  const bg = scene.add.graphics();
  const tw = 260, th = 52;
  bg.fillStyle(0x12121f, 0.95);
  bg.fillRoundedRect(-tw / 2, -th / 2, tw, th, 10);
  bg.lineStyle(1.5, ach.color, 0.7);
  bg.strokeRoundedRect(-tw / 2, -th / 2, tw, th, 10);
  container.add(bg);

  const iconFn = Icons[ach.icon] || Icons.badge;
  const icon = iconFn(scene, -tw / 2 + 24, 0, 18, ach.color);
  container.add(icon);

  const label = scene.add.text(-tw / 2 + 44, -12, 'UNLOCKED', {
    fontSize: '9px', fontFamily: UI_FONT, fontStyle: 'bold', color: '#888888',
  });
  container.add(label);
  const nameText = scene.add.text(-tw / 2 + 44, 2, ach.name, {
    fontSize: '16px', fontFamily: UI_FONT, fontStyle: 'bold',
    color: '#' + ach.color.toString(16).padStart(6, '0'),
  });
  container.add(nameText);

  // Slide in, hold, slide out
  scene.tweens.add({
    targets: container, y: toastY, duration: 400, ease: 'Back.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: container, y: toastY - 80, alpha: 0,
        duration: 500, ease: 'Quad.easeIn', delay: 2200,
        onComplete: () => container.destroy(true),
      });
    },
  });
}

// =============================================================
// SHARED UI UTILITIES
// =============================================================

/** Draw the dark grid background used by multiple scenes */
function drawDarkGridBg(scene) {
  const { width, height } = scene.scale;
  const bg = scene.add.graphics();
  bg.fillStyle(0x0a0a1a, 1);
  bg.fillRect(0, 0, width, height);
  bg.lineStyle(1, 0x1a1a2e, 0.3);
  for (let x = 0; x < width; x += 30) bg.lineBetween(x, 0, x, height);
  for (let y = 0; y < height; y += 30) bg.lineBetween(0, y, width, y);
  return bg;
}

/**
 * Draw a UI card panel — eliminates 15+ duplicated fillRoundedRect/strokeRoundedRect blocks.
 * @param {Phaser.GameObjects.Graphics} gfx - Graphics object to draw on
 * @param {object} opts - { x, y, w, h, radius?, fillAlpha?, borderColor?, borderAlpha? }
 */
function drawCard(gfx, opts) {
  const {
    x, y, w, h,
    radius = 10,
    fillColor = 0x12121f,
    fillAlpha = 0.9,
    borderColor = 0x3a3a5e,
    borderAlpha = 0.3,
    borderWidth = 1,
  } = opts;
  gfx.fillStyle(fillColor, fillAlpha);
  gfx.fillRoundedRect(x, y, w, h, radius);
  gfx.lineStyle(borderWidth, borderColor, borderAlpha);
  gfx.strokeRoundedRect(x, y, w, h, radius);
}

/**
 * Draw a standard scene header — used by TipsScene, StatsScene, ScanScene, TutorialScene.
 * @param {Phaser.Scene} scene
 * @param {string} text
 * @param {object} opts - { color?, y? }
 */
function drawSceneHeader(scene, text, opts = {}) {
  const { width } = scene.scale;
  const { color = '#ffffff', y = 30 } = opts;
  return scene.add.text(width / 2, y, text,
    textStyle('28px', color, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 }),
  ).setOrigin(0.5);
}

/**
 * Unified button factory — replaces 3 duplicated button methods.
 * @param {Phaser.Scene} scene
 * @param {object} opts - { x, y, width, height, text, subtext, color, iconFn, callback, container, radius }
 */
function createButton(scene, opts) {
  const {
    x, y, width: w, height: h, text, subtext,
    color = '#ffffff', iconFn, callback,
    container, radius = 10,
  } = opts;
  const borderColor = color.startsWith('#')
    ? Phaser.Display.Color.HexStringToColor(color).color
    : 0x3a3a5e;
  const defaultBorder = borderColor === 0x3a3a5e;

  const bg = scene.add.graphics();
  const drawBg = (fill, border, borderAlpha) => {
    bg.clear();
    bg.fillStyle(fill, 1);
    bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
    bg.lineStyle(defaultBorder ? 2 : 1.5, border, borderAlpha);
    bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  };
  drawBg(0x1a1a2e, defaultBorder ? 0x3a3a5e : borderColor, defaultBorder ? 0.8 : 0.4);
  if (container) container.add(bg);

  if (iconFn) {
    const icon = iconFn(scene, x - w / 2 + (subtext ? 30 : 25), y - (subtext ? 4 : 0));
    if (container && icon) container.add(icon);
  }

  const textOffset = iconFn ? (subtext ? 12 : 8) : 0;
  const label = scene.add.text(x + textOffset, y - (subtext ? 8 : 0), text,
    textStyle(subtext ? '20px' : '16px', defaultBorder ? '#ffffff' : color, { fontStyle: 'bold' }),
  ).setOrigin(0.5);
  if (container) container.add(label);

  if (subtext) {
    const sub = scene.add.text(x + textOffset, y + 14, subtext,
      textStyle('11px', '#555555'),
    ).setOrigin(0.5);
    if (container) container.add(sub);
  }

  const hitZone = scene.add.rectangle(x, y, w, h).setInteractive()
    .setAlpha(0.001);
  if (container) hitZone.setDepth(101);
  if (container) container.add(hitZone);

  hitZone.on('pointerover', () => {
    drawBg(0x2a2a4e, defaultBorder ? 0xf1c40f : borderColor, 0.8);
  });
  hitZone.on('pointerout', () => {
    drawBg(0x1a1a2e, defaultBorder ? 0x3a3a5e : borderColor, defaultBorder ? 0.8 : 0.4);
  });
  hitZone.on('pointerdown', callback);
}

const TIPS = [
  'Swipe a bubble toward a neighbor to swap — or tap two adjacent bubbles',
  'Match 3 or more same-colored bubbles in a row or column',
  'Chain reactions keep your streak alive — plan for cascades',
  'Match 4 in a row to create a LINE CLEAR power-up',
  'Match 5+ in a row to create a BOMB — clears a 3x3 area',
  'L-shaped or T-shaped matches create a COLOR NUKE — wipes all of one color',
  'Streaks multiply your score — keep the chain going for big points',
  'Hit 3x streak to meet Kira, 5x for Blaze, 8x for Ronin, 12x for Empress',
  'Look at the bottom of the board first — matches there create more cascades',
  'In Timed mode, speed matters more than perfection — keep moving',
  'Power-up bubbles activate when matched — save them for the right moment',
  'No valid moves? The board auto-shuffles — no penalty',
  'Fill the Fever meter with matches — 2X score for 8 seconds when it peaks',
];

// =============================================================
// BOOT SCENE
// =============================================================
class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  create() {
    COLORS.forEach((color, i) => {
      const gfx = this.add.graphics();
      gfx.fillStyle(color, 0.3);
      gfx.fillCircle(BUBBLE_SIZE / 2, BUBBLE_SIZE / 2, BUBBLE_SIZE / 2);
      gfx.fillStyle(color, 1);
      gfx.fillCircle(BUBBLE_SIZE / 2, BUBBLE_SIZE / 2, BUBBLE_SIZE / 2 - 3);
      gfx.fillStyle(0xffffff, 0.3);
      gfx.fillCircle(BUBBLE_SIZE / 2 - 6, BUBBLE_SIZE / 2 - 6, 6);
      gfx.generateTexture(`bubble_${i}`, BUBBLE_SIZE, BUBBLE_SIZE);
      gfx.destroy();
    });

    const pGfx = this.add.graphics();
    pGfx.fillStyle(0xffffff, 1);
    pGfx.fillCircle(4, 4, 4);
    pGfx.generateTexture('particle', 8, 8);
    pGfx.destroy();

    const sGfx = this.add.graphics();
    sGfx.fillStyle(0xf1c40f, 1);
    sGfx.fillCircle(6, 6, 6);
    sGfx.fillStyle(0xffffff, 0.7);
    sGfx.fillCircle(4, 4, 3);
    sGfx.generateTexture('star', 12, 12);
    sGfx.destroy();

    this.scene.start('TitleScene');
  }
}

// =============================================================
// TITLE SCENE
// =============================================================
class TitleScene extends Phaser.Scene {
  constructor() { super({ key: 'TitleScene' }); }

  create() {
    const { width, height } = this.scale;

    // Background
    drawDarkGridBg(this);

    // Floating bubbles in background
    for (let i = 0; i < 20; i++) {
      const bx = Phaser.Math.Between(20, width - 20);
      const by = Phaser.Math.Between(50, height - 50);
      const colorIdx = Phaser.Math.Between(0, COLORS.length - 1);
      const bubble = this.add.image(bx, by, `bubble_${colorIdx}`);
      bubble.setAlpha(0.15);
      bubble.setScale(Phaser.Math.FloatBetween(0.5, 1.2));
      this.tweens.add({
        targets: bubble,
        y: by + Phaser.Math.Between(-30, 30),
        x: bx + Phaser.Math.Between(-20, 20),
        duration: Phaser.Math.Between(3000, 6000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Title
    const title = this.add.text(width / 2, height * 0.18, 'WHAT\'S',
      textStyle('40px', '#f1c40f', { fontStyle: 'bold', stroke: '#000000', strokeThickness: 5 }),
    ).setOrigin(0.5);

    const subtitle = this.add.text(width / 2, height * 0.27, 'POPPIN',
      textStyle('64px', '#e74c3c', { fontStyle: 'bold', stroke: '#000000', strokeThickness: 7 }),
    ).setOrigin(0.5);

    // Pulsing title
    this.tweens.add({
      targets: subtitle,
      scale: 1.05,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Tagline
    this.add.text(width / 2, height * 0.36, 'match  /  combo  /  dominate',
      textStyle('14px', '#666666', { letterSpacing: 2 }),
    ).setOrigin(0.5);

    // Mode buttons
    const btnY = height * 0.47;

    const btnWidth = width - 60;
    const btnHeight = 56;

    // Timed mode button
    createButton(this, { x: width / 2, y: btnY, width: btnWidth, height: btnHeight, radius: 12,
      text: 'TIMED MODE', subtext: '90 seconds — chase the high score',
      iconFn: (s, bx, by) => Icons.timer(s, bx, by, 18, 0xffffff),
      callback: () => this.scene.start('GameScene', { mode: 'timed' }),
    });

    // Zen mode button
    createButton(this, { x: width / 2, y: btnY + 80, width: btnWidth, height: btnHeight, radius: 12,
      text: 'ZEN MODE', subtext: 'No timer — pure vibes',
      iconFn: (s, bx, by) => Icons.zen(s, bx, by, 18, 0xffffff),
      callback: () => this.scene.start('GameScene', { mode: 'zen' }),
    });

    // How to Play button
    createButton(this, { x: width / 2, y: btnY + 160, width: btnWidth, height: btnHeight, radius: 12,
      text: 'HOW TO PLAY', subtext: 'Tips, controls, power-ups',
      iconFn: (s, bx, by) => Icons.help(s, bx, by, 18, 0xffffff),
      callback: () => this.scene.start('TipsScene'),
    });

    // Career Stats button
    const career = CareerStats.load();
    if (career.gamesPlayed > 0) {
      createButton(this, { x: width / 2, y: btnY + 240, width: btnWidth, height: btnHeight, radius: 12,
        text: 'CAREER STATS', subtext: `${career.gamesPlayed} games — ${career.totalPops.toLocaleString()} pops`,
        iconFn: (s, bx, by) => Icons.crown(s, bx, by, 18, 0xffffff),
        callback: () => this.scene.start('StatsScene'),
      });
    }

    // Achievements button
    const achCount = Achievements.count();
    const achTotal = ACHIEVEMENTS.length;
    createButton(this, { x: width / 2, y: btnY + 320, width: btnWidth, height: btnHeight, radius: 12,
      text: 'ACHIEVEMENTS', subtext: `${achCount} / ${achTotal} unlocked`,
      iconFn: (s, bx, by) => Icons.badge(s, bx, by, 18, achCount > 0 ? 0xf1c40f : 0x555555),
      callback: () => this.scene.start('AchievementsScene'),
    });

    // Hall of Fame button
    const hofEntries = HallOfFame.load();
    if (hofEntries.length > 0) {
      createButton(this, { x: width / 2, y: btnY + 400, width: btnWidth, height: btnHeight, radius: 12,
        text: 'HALL OF FAME', subtext: `Top score: ${hofEntries[0].score.toLocaleString()} — ${hofEntries.length} entries`,
        iconFn: (s, bx, by) => Icons.star(s, bx, by, 18, 0xf1c40f),
        callback: () => this.scene.start('HallOfFameScene'),
      });
    }

    // First-time tutorial check
    if (!SafeStorage.get('whatspoppin_played', null)) {
      const tutY = (hofEntries.length > 0 ? btnY + 480 : btnY + 400);
      createButton(this, { x: width / 2, y: tutY, width: btnWidth, height: btnHeight, radius: 12,
        text: 'TUTORIAL', subtext: 'Learn the basics step by step',
        callback: () => this.scene.start('TutorialScene'),
      });
    }

    // High score display
    const highScore = SafeStorage.getInt('whatspoppin_highscore', 0);
    if (highScore > 0) {
      Icons.star(this, width / 2 - 100, height * 0.85, 14, 0xf1c40f);
      this.add.text(width / 2, height * 0.85, `HIGH SCORE: ${highScore.toLocaleString()}`,
        textStyle('18px', '#f1c40f', { fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }),
      ).setOrigin(0.5);
    }

    // Sound toggle (top-right corner)
    this._buildSoundToggle(width);

    // Credits
    this.add.text(width / 2, height * 0.93, 'by DareDev256',
      textStyle('12px', '#444444'),
    ).setOrigin(0.5);

    // Init audio on first interaction
    this.input.once('pointerdown', () => initAudioWithPrefs());
  }

  _buildSoundToggle(width) {
    const btnX = width - 28;
    const btnY = 28;
    const btnSize = 36;
    const isMuted = SafeStorage.get('whatspoppin_muted', '0') === '1';

    this.soundBtnBg = this.add.graphics();
    this._drawSoundBtnBg(btnX, btnY, btnSize, false);

    this.soundIcon = isMuted
      ? Icons.speakerMuted(this, btnX, btnY, 22, 0x888888)
      : Icons.speaker(this, btnX, btnY, 22, 0xffffff);

    this.soundLabel = this.add.text(btnX, btnY + 24, isMuted ? 'OFF' : 'ON', {
      fontSize: '9px', fontFamily: UI_FONT, fontStyle: 'bold',
      color: isMuted ? '#666666' : '#2ecc71',
    }).setOrigin(0.5);

    const hit = this.add.rectangle(btnX, btnY, btnSize, btnSize + 12)
      .setInteractive().setAlpha(0.001);

    hit.on('pointerover', () => this._drawSoundBtnBg(btnX, btnY, btnSize, true));
    hit.on('pointerout', () => this._drawSoundBtnBg(btnX, btnY, btnSize, false));
    hit.on('pointerdown', () => {
      initAudioWithPrefs();
      const nowMuted = toggleMuteAndSave();

      // Redraw icon
      this.soundIcon.destroy();
      this.soundIcon = nowMuted
        ? Icons.speakerMuted(this, btnX, btnY, 22, 0x888888)
        : Icons.speaker(this, btnX, btnY, 22, 0xffffff);
      this.soundLabel.setText(nowMuted ? 'OFF' : 'ON');
      this.soundLabel.setColor(nowMuted ? '#666666' : '#2ecc71');
    });
  }

  _drawSoundBtnBg(x, y, size, hover) {
    this.soundBtnBg.clear();
    drawCard(this.soundBtnBg, { x: x - size / 2, y: y - size / 2, w: size, h: size,
      radius: 8, fillColor: hover ? 0x2a2a4e : 0x1a1a2e, fillAlpha: 0.8,
      borderColor: hover ? 0xf1c40f : 0x3a3a5e, borderAlpha: 0.6 });
  }

}

// =============================================================
// GAME OVER SCENE
// =============================================================
class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: 'GameOverScene' }); }

  create(data) {
    const { width, height } = this.scale;
    const { score, bestStreak, bestChain, moves, isNewHigh, mode, hofRank } = data;
    this._mode = mode || 'timed';

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 0.95);
    bg.fillRect(0, 0, width, height);

    // Game Over text — mode-aware header
    const headerText = this._mode === 'zen' ? 'GAME OVER' : 'TIME\'S UP';
    const goText = this.add.text(width / 2, height * 0.12, headerText, {
      fontSize: '42px',
      fontFamily: UI_FONT,
      fontStyle: 'bold',
      color: '#e74c3c',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setScale(0);

    this.tweens.add({
      targets: goText,
      scale: 1,
      duration: 500,
      ease: 'Back.easeOut',
    });

    // Score card
    const cardY = height * 0.30;
    const cardH = 200;
    drawCard(bg, { x: 20, y: cardY, w: width - 40, h: cardH, radius: 16,
      fillAlpha: 1, borderColor: 0x2a2a4a, borderAlpha: 0.8, borderWidth: 2 });

    // Score
    this.add.text(width / 2, cardY + 30, 'FINAL SCORE', textStyle('14px', '#888888')).setOrigin(0.5);

    const scoreText = this.add.text(width / 2, cardY + 65, '0',
      textStyle('48px', '#f1c40f', { fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 }),
    ).setOrigin(0.5);

    // Animate score counting up
    let displayScore = 0;
    this.tweens.addCounter({
      from: 0, to: score, duration: 1500, delay: 500,
      ease: 'Quad.easeOut',
      onUpdate: (tween) => {
        displayScore = Math.floor(tween.getValue());
        scoreText.setText(displayScore.toLocaleString());
      },
    });

    // New high score badge
    if (isNewHigh) {
      Icons.star(this, width / 2 - 95, cardY + 100, 12, 0xf1c40f);
      Icons.star(this, width / 2 + 95, cardY + 100, 12, 0xf1c40f);
      const badge = this.add.text(width / 2, cardY + 100, 'NEW HIGH SCORE',
        textStyle('18px', '#f1c40f', { fontStyle: 'bold' }),
      ).setOrigin(0.5).setAlpha(0);

      this.tweens.add({
        targets: badge, alpha: 1, duration: 300, delay: 1800,
      });
      this.tweens.add({
        targets: badge, scale: 1.05, duration: 800, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: 2000,
      });
    }

    // Hall of Fame rank badge
    if (hofRank > 0 && hofRank <= 10 && !isNewHigh) {
      const rankText = hofRank <= 3 ? ['👑 #1', '⚔️ #2', '🔥 #3'][hofRank - 1] : `#${hofRank}`;
      const rankBadge = this.add.text(width / 2, cardY + 100, `HALL OF FAME ${rankText}`,
        textStyle('15px', hofRank <= 3 ? '#f1c40f' : '#2ecc71', { fontStyle: 'bold' }),
      ).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: rankBadge, alpha: 1, duration: 400, delay: 1800 });
    }

    // Stats
    const statsY = cardY + 140;
    const statCell = (xFrac, label, val, color = '#aaaaaa') =>
      this.add.text(width * xFrac, statsY, `${label}\n${val}`,
        textStyle('13px', color, { align: 'center' }),
      ).setOrigin(0.5);

    statCell(0.2, 'MOVES', moves);
    statCell(0.4, 'STREAK', `${bestStreak}x`);
    statCell(0.6, 'CHAIN', (bestChain || 0) > 0 ? bestChain + 'x' : '—',
      (bestChain || 0) >= 4 ? '#00e5ff' : '#aaaaaa');
    const avgPerMove = moves > 0 ? Math.round(score / moves) : 0;
    statCell(0.8, 'AVG/MOVE', avgPerMove);

    // Streak tier achieved
    const tierLevel = getStreakTier(bestStreak);
    if (tierLevel && window.characters) {
      const charKey = tierLevel.char;
      const char = window.characters[charKey];
      if (char) {
        const charGfx = this.add.graphics();
        char.draw(charGfx, width / 2, height * 0.62, 1.2);

        this.add.text(width / 2, height * 0.73, `${char.name} — ${char.title}`, {
          fontSize: '16px', fontFamily: UI_FONT,
          fontStyle: 'italic', color: tierLevel.color,
        }).setOrigin(0.5);
      }
    }

    // Buttons
    const btnY1 = height * 0.77;
    const btnW = width - 80;
    const btnGap = 44;
    createButton(this, { x: width / 2, y: btnY1, width: btnW, height: 36,
      text: 'PLAY AGAIN', color: '#2ecc71',
      iconFn: (s, bx, by) => Icons.play(s, bx, by, 14, 0x2ecc71),
      callback: () => this.scene.start('GameScene', { mode: this._mode }),
    });
    createButton(this, { x: width / 2, y: btnY1 + btnGap, width: btnW, height: 36,
      text: 'SHARE SCORE', color: '#3498db',
      iconFn: (s, bx, by) => Icons.share(s, bx, by, 14, 0x3498db),
      callback: () => {
        shareScore({ score, bestStreak, bestChain, moves, mode: this._mode }).then((result) => {
          if (result === 'copied' || result === 'shared') {
            const msg = result === 'copied' ? 'COPIED TO CLIPBOARD ✓' : 'SHARED ✓';
            const toast = this.add.text(width / 2, btnY1 + btnGap - 28, msg,
              textStyle('12px', '#3498db', { fontStyle: 'bold' }),
            ).setOrigin(0.5).setAlpha(0);
            this.tweens.add({ targets: toast, alpha: 1, duration: 200 });
            this.tweens.add({ targets: toast, alpha: 0, y: toast.y - 20,
              duration: 600, delay: 1600, onComplete: () => toast.destroy() });
          }
        });
      },
    });
    createButton(this, { x: width / 2, y: btnY1 + btnGap * 2, width: btnW, height: 36,
      text: 'HALL OF FAME', color: '#f1c40f',
      iconFn: (s, bx, by) => Icons.crown(s, bx, by, 14, 0xf1c40f),
      callback: () => this.scene.start('HallOfFameScene', { highlightRank: hofRank, returnTo: 'TitleScene' }),
    });
    createButton(this, { x: width / 2, y: btnY1 + btnGap * 3, width: btnW, height: 36,
      text: 'MENU', color: '#aaaaaa',
      iconFn: (s, bx, by) => Icons.back(s, bx, by, 14, 0xaaaaaa),
      callback: () => this.scene.start('TitleScene'),
    });

    // Confetti on new high
    if (isNewHigh) {
      this.time.addEvent({
        delay: 100, repeat: 30,
        callback: () => {
          const p = this.add.image(
            Phaser.Math.Between(0, width),
            -10, 'star'
          );
          p.setTint(COLORS[Phaser.Math.Between(0, COLORS.length - 1)]);
          p.setScale(Phaser.Math.FloatBetween(0.3, 0.8));
          this.tweens.add({
            targets: p,
            y: height + 20,
            x: p.x + Phaser.Math.Between(-60, 60),
            rotation: Phaser.Math.FloatBetween(-3, 3),
            duration: Phaser.Math.Between(1500, 3000),
            onComplete: () => p.destroy(),
          });
        }
      });
    }
  }

}

// =============================================================
// HALL OF FAME SCENE — Top 10 ranked leaderboard
// =============================================================
class HallOfFameScene extends Phaser.Scene {
  constructor() { super({ key: 'HallOfFameScene' }); }

  create(data) {
    const { width, height } = this.scale;
    const highlightRank = data?.highlightRank ?? -1;

    drawDarkGridBg(this);
    drawSceneHeader(this, 'HALL OF FAME', { color: '#f1c40f' });

    const entries = HallOfFame.load();
    const bg = this.add.graphics();

    if (entries.length === 0) {
      this.add.text(width / 2, height * 0.45, 'No games recorded yet.\nPlay a round to claim the throne!', {
        fontSize: '16px', fontFamily: UI_FONT, color: '#666666', align: 'center', lineSpacing: 8,
      }).setOrigin(0.5);
    } else {
      const MEDAL_COLORS = [0xf1c40f, 0xbdc3c7, 0xcd7f32]; // gold, silver, bronze
      const MEDAL_LABELS = ['👑', '⚔️', '🔥'];
      const startY = 65;
      const rowH = 48;
      const padX = 16;

      entries.forEach((entry, i) => {
        const y = startY + i * rowH;
        const isHighlight = (i + 1) === highlightRank;
        const isTop3 = i < 3;

        // Row background
        drawCard(bg, {
          x: padX, y, w: width - padX * 2, h: rowH - 4, radius: 8,
          fillColor: isHighlight ? 0x1a2a1a : 0x12121f,
          fillAlpha: isHighlight ? 1 : 0.85,
          borderColor: isHighlight ? 0x2ecc71 : (isTop3 ? MEDAL_COLORS[i] : 0x2a2a4a),
          borderAlpha: isHighlight ? 0.9 : (isTop3 ? 0.6 : 0.2),
          borderWidth: isHighlight ? 2 : 1,
        });

        // Rank number
        const rankColor = isTop3 ? Phaser.Display.Color.IntegerToColor(MEDAL_COLORS[i]).rgba : '#888888';
        this.add.text(padX + 18, y + rowH / 2 - 2, isTop3 ? MEDAL_LABELS[i] : `#${i + 1}`, {
          fontSize: isTop3 ? '18px' : '14px', fontFamily: UI_FONT,
          fontStyle: 'bold', color: typeof rankColor === 'string' ? rankColor : '#f1c40f',
        }).setOrigin(0.5);

        // Score
        this.add.text(padX + 52, y + 8, entry.score.toLocaleString(), {
          fontSize: isTop3 ? '20px' : '16px', fontFamily: UI_FONT,
          fontStyle: 'bold', color: isHighlight ? '#2ecc71' : (isTop3 ? '#ffffff' : '#cccccc'),
        });

        // Details line: streak + mode + date
        const tierLabel = getStreakTier(entry.streak);
        const detail = `${entry.streak}x streak${tierLabel ? ' · ' + tierLabel.label : ''}  ·  ${entry.mode}  ·  ${entry.date}`;
        this.add.text(padX + 52, y + 28, detail, {
          fontSize: '10px', fontFamily: UI_FONT, color: '#777777',
        });

        // Highlight pulse for new entry
        if (isHighlight) {
          const glow = this.add.graphics();
          drawCard(glow, {
            x: padX, y, w: width - padX * 2, h: rowH - 4, radius: 8,
            fillColor: 0x2ecc71, fillAlpha: 0.08, borderColor: 0x2ecc71, borderAlpha: 0, borderWidth: 0,
          });
          this.tweens.add({
            targets: glow, alpha: 0, duration: 1200, yoyo: true, repeat: 2, ease: 'Sine.easeInOut',
          });
        }
      });
    }

    // Back button
    createButton(this, {
      x: width / 2, y: height - 40, width: 180, height: 42,
      text: 'BACK', color: '#aaaaaa',
      iconFn: (s, bx, by) => Icons.back(s, bx, by, 14, 0xaaaaaa),
      callback: () => this.scene.start(data?.returnTo || 'TitleScene'),
    });
  }
}

// =============================================================
// TUTORIAL SCENE — Interactive walkthrough
// =============================================================
class TutorialScene extends Phaser.Scene {
  constructor() { super({ key: 'TutorialScene' }); }

  create() {
    const { width, height } = this.scale;
    this.stepIndex = 0;

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 1);
    bg.fillRect(0, 0, width, height);

    const steps = [
      {
        title: 'SWAP BUBBLES',
        desc: 'Swipe a bubble in any direction to swap it with its neighbor.\n\nOr tap one bubble, then tap an adjacent one.',
        draw: (scene) => {
          // Draw two bubbles with an arrow between them
          const cx = width / 2;
          const cy = height * 0.45;
          const b1 = scene.add.image(cx - 35, cy, 'bubble_0').setScale(1.2);
          const b2 = scene.add.image(cx + 35, cy, 'bubble_3').setScale(1.2);
          // Animated arrow
          const arrow = scene.add.graphics();
          arrow.lineStyle(3, 0xffffff, 0.8);
          arrow.lineBetween(cx - 10, cy, cx + 10, cy);
          arrow.fillStyle(0xffffff, 0.8);
          arrow.fillTriangle(cx + 10, cy - 5, cx + 10, cy + 5, cx + 18, cy);
          scene.tweens.add({
            targets: [b1, b2, arrow], alpha: 0.5,
            duration: 800, yoyo: true, repeat: -1,
          });
          return [b1, b2, arrow];
        }
      },
      {
        title: 'MATCH 3+',
        desc: 'Line up 3 or more bubbles of the same color in a row or column to pop them.',
        draw: (scene) => {
          const cx = width / 2;
          const cy = height * 0.45;
          const bubbles = [];
          for (let i = 0; i < 3; i++) {
            const b = scene.add.image(cx - 50 + i * 50, cy, 'bubble_1').setScale(1.1);
            bubbles.push(b);
          }
          // Highlight glow
          const glow = scene.add.graphics();
          glow.lineStyle(2, 0xffffff, 0.6);
          glow.strokeRoundedRect(cx - 80, cy - 28, 160, 56, 8);
          scene.tweens.add({
            targets: glow, alpha: 0.2, duration: 600, yoyo: true, repeat: -1,
          });
          bubbles.push(glow);
          return bubbles;
        }
      },
      {
        title: 'POWER-UPS',
        desc: 'Match 4 = Line Clear\nMatch 5+ = Bomb\nL or T shape = Color Nuke\n\nPower-up bubbles glow in the grid. Match them to activate.',
        draw: (scene) => {
          const cx = width / 2;
          const cy = height * 0.42;
          const items = [];
          // Draw 4 in a row
          for (let i = 0; i < 4; i++) {
            items.push(scene.add.image(cx - 72 + i * 48, cy, 'bubble_4').setScale(0.9));
          }
          // Arrow pointing to power-up result
          const arrow = scene.add.graphics();
          arrow.lineStyle(2, 0xffffff, 0.5);
          arrow.lineBetween(cx + 60, cy, cx + 80, cy);
          arrow.fillStyle(0xffffff, 0.5);
          arrow.fillTriangle(cx + 80, cy - 4, cx + 80, cy + 4, cx + 86, cy);
          items.push(arrow);
          // Result bubble with overlay
          const result = scene.add.image(cx + 105, cy, 'bubble_4').setScale(1.1);
          items.push(result);
          scene.tweens.add({
            targets: result, scale: 1.3, duration: 800, yoyo: true, repeat: -1,
          });
          return items;
        }
      },
      {
        title: 'STREAKS',
        desc: 'Keep matching without missing to build a streak.\n\nHigher streaks = bigger multiplier = more points.\n\nCharacters appear at 3x, 5x, 8x, and 12x streaks.',
        draw: (scene) => {
          const cx = width / 2;
          const cy = height * 0.44;
          const items = [];
          const labels = ['3x NICE', '5x FIRE', '8x GODLIKE', '12x LEGENDARY'];
          const colors = ['#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6'];
          labels.forEach((label, i) => {
            const t = scene.add.text(cx, cy - 30 + i * 28, label, {
              fontSize: '16px', fontFamily: UI_FONT,
              fontStyle: 'bold', color: colors[i],
              stroke: '#000000', strokeThickness: 2,
            }).setOrigin(0.5);
            items.push(t);
          });
          return items;
        }
      },
      {
        title: 'YOU\'RE READY',
        desc: 'Start with Zen Mode to practice, or jump into Timed Mode for the challenge.\n\nChase high scores. Unlock characters. Go crazy.',
        draw: () => []
      }
    ];

    // Step container
    this.stepContainer = this.add.container(0, 0);
    this.stepObjects = [];

    // Progress dots
    this.dots = [];
    const dotY = height * 0.08;
    steps.forEach((_, i) => {
      const dot = this.add.graphics();
      dot.fillStyle(i === 0 ? 0xf1c40f : 0x333333, 1);
      dot.fillCircle(width / 2 - (steps.length - 1) * 10 + i * 20, dotY, 4);
      this.dots.push(dot);
    });

    const renderStep = (idx) => {
      // Clear previous
      this.stepObjects.forEach(obj => { if (obj && obj.destroy) obj.destroy(); });
      this.stepObjects = [];

      const step = steps[idx];

      const title = this.add.text(width / 2, height * 0.15, step.title, {
        fontSize: '28px', fontFamily: UI_FONT,
        fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5);
      this.stepObjects.push(title);

      const desc = this.add.text(width / 2, height * 0.62, step.desc, {
        fontSize: '14px', fontFamily: UI_FONT,
        color: '#bbbbbb', align: 'center', lineSpacing: 6,
        wordWrap: { width: width - 60 },
      }).setOrigin(0.5, 0);
      this.stepObjects.push(desc);

      const drawn = step.draw(this);
      this.stepObjects.push(...drawn);

      // Update dots
      this.dots.forEach((dot, i) => {
        dot.clear();
        dot.fillStyle(i === idx ? 0xf1c40f : 0x333333, 1);
        dot.fillCircle(width / 2 - (steps.length - 1) * 10 + i * 20, dotY, i === idx ? 5 : 4);
      });
    };

    renderStep(0);

    // Navigation
    const navY = height - 45;

    // Next / Skip buttons
    const nextBg = this.add.graphics();
    const nextW = 140;
    const drawNextBtn = (isLast) => {
      nextBg.clear();
      drawCard(nextBg, { x: width / 2 - nextW / 2, y: navY - 20, w: nextW, h: 40,
        fillColor: 0x1a1a2e, fillAlpha: 1, borderColor: 0xf1c40f,
        borderAlpha: 0.5, borderWidth: 2 });
      this.nextLabel.setText(isLast ? 'LET\'S GO' : 'NEXT');
    };

    this.nextLabel = this.add.text(width / 2, navY, 'NEXT', {
      fontSize: '16px', fontFamily: UI_FONT,
      fontStyle: 'bold', color: '#f1c40f',
    }).setOrigin(0.5);

    drawNextBtn(false);

    const nextHit = this.add.rectangle(width / 2, navY, nextW, 40).setInteractive().setAlpha(0.001);
    nextHit.on('pointerdown', () => {
      this.stepIndex++;
      if (this.stepIndex >= steps.length) {
        SafeStorage.set('whatspoppin_played', '1');
        this.scene.start('TitleScene');
        return;
      }
      renderStep(this.stepIndex);
      drawNextBtn(this.stepIndex === steps.length - 1);
    });

    // Skip
    const skip = this.add.text(width - 20, 25, 'SKIP', {
      fontSize: '13px', fontFamily: UI_FONT,
      color: '#555555',
    }).setOrigin(1, 0).setInteractive();
    skip.on('pointerdown', () => {
      SafeStorage.set('whatspoppin_played', '1');
      this.scene.start('TitleScene');
    });
  }
}

// =============================================================
// TIPS SCENE — How to Play
// =============================================================
class TipsScene extends Phaser.Scene {
  constructor() { super({ key: 'TipsScene' }); }

  create() {
    const { width, height } = this.scale;

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 1);
    bg.fillRect(0, 0, width, height);

    // Title
    drawSceneHeader(this, 'HOW TO PLAY');

    const sections = [
      {
        title: 'CONTROLS',
        color: '#3498db',
        items: [
          'Swipe a bubble to swap with its neighbor',
          'Or tap two adjacent bubbles to swap them',
          'Match 3+ same-color bubbles to pop them',
        ]
      },
      {
        title: 'POWER-UPS',
        color: '#f1c40f',
        items: [
          'Match 4 → LINE CLEAR (entire row/column)',
          'Match 5+ → BOMB (3x3 explosion)',
          'L or T shape → COLOR NUKE (all of one color)',
          'Match a power-up bubble to activate it',
        ]
      },
      {
        title: 'STREAKS',
        color: '#e74c3c',
        items: [
          'Chain matches without missing to build streaks',
          'Higher streaks = bigger score multiplier',
          '3x Kira / 5x Blaze / 8x Ronin / 12x Empress',
        ]
      },
      {
        title: 'STRATEGY',
        color: '#2ecc71',
        items: [
          'Focus on the bottom — more cascade potential',
          'Save power-ups for chain moments',
          'In Timed mode, speed > perfection',
        ]
      },
    ];

    let yPos = 70;
    sections.forEach(section => {
      // Section card
      const cardH = 16 + section.items.length * 22 + 10;
      drawCard(bg, { x: 15, y: yPos, w: width - 30, h: cardH,
        borderColor: Phaser.Display.Color.HexStringToColor(section.color).color });

      this.add.text(25, yPos + 8, section.title, {
        fontSize: '13px', fontFamily: UI_FONT,
        fontStyle: 'bold', color: section.color,
      });

      section.items.forEach((item, i) => {
        this.add.text(25, yPos + 28 + i * 22, `•  ${item}`, {
          fontSize: '12px', fontFamily: UI_FONT,
          color: '#bbbbbb',
          wordWrap: { width: width - 60 },
        });
      });

      yPos += cardH + 8;
    });

    // Back button — uses unified createButton instead of hand-rolled graphics
    createButton(this, { x: width / 2, y: height - 40, width: 180, height: 42,
      text: 'BACK', color: '#aaaaaa',
      iconFn: (s, bx, by) => Icons.back(s, bx, by, 14, 0xaaaaaa),
      callback: () => this.scene.start('TitleScene'),
    });
  }
}

// =============================================================
// STATS SCENE — Career stats dashboard
// =============================================================
class StatsScene extends Phaser.Scene {
  constructor() { super({ key: 'StatsScene' }); }

  create() {
    const { width, height } = this.scale;
    const stats = CareerStats.load();
    const bg = this.add.graphics();
    drawDarkGridBg(this);

    // Title
    drawSceneHeader(this, 'CAREER STATS', { color: '#f1c40f' });

    // Stat cards
    const cardX = 15;
    const cardW = width - 30;

    // — Main stats grid (2×2) —
    const gridY = 60;
    const cellW = (cardW - 8) / 2;
    const cellH = 72;

    const statCells = [
      { label: 'GAMES PLAYED', value: stats.gamesPlayed.toLocaleString(), color: '#3498db' },
      { label: 'TOTAL POPS', value: stats.totalPops.toLocaleString(), color: '#e74c3c' },
      { label: 'BEST SCORE', value: stats.bestScore.toLocaleString(), color: '#f1c40f' },
      { label: 'BEST STREAK', value: `${stats.bestStreak}x`, color: '#9b59b6' },
      { label: 'BEST CHAIN', value: stats.bestChain > 0 ? `${stats.bestChain}x` : '—', color: '#00e5ff' },
      { label: 'AVG SCORE', value: (stats.gamesPlayed > 0 ? Math.round(stats.totalScore / stats.gamesPlayed) : 0).toLocaleString(), color: '#ff6b35' },
      { label: 'FEVERS', value: (stats.totalFevers || 0).toLocaleString(), color: '#ff2222' },
      { label: 'AVG POPS', value: (stats.gamesPlayed > 0 ? Math.round(stats.totalPops / stats.gamesPlayed) : 0).toLocaleString(), color: '#2ecc71' },
    ];

    statCells.forEach((cell, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = cardX + col * (cellW + 8);
      const cy = gridY + row * (cellH + 8);

      drawCard(bg, { x: cx, y: cy, w: cellW, h: cellH,
        borderColor: Phaser.Display.Color.HexStringToColor(cell.color).color });

      this.add.text(cx + cellW / 2, cy + 18, cell.label,
        textStyle('10px', '#666666', { fontStyle: 'bold', align: 'center' }),
      ).setOrigin(0.5);

      this.add.text(cx + cellW / 2, cy + 48, cell.value,
        textStyle('28px', cell.color, { fontStyle: 'bold' }),
      ).setOrigin(0.5);
    });

    // — Lifetime totals bar —
    const numRows = Math.ceil(statCells.length / 2);
    const barY = gridY + numRows * (cellH + 8) + 8;
    drawCard(bg, { x: cardX, y: barY, w: cardW, h: 52, borderColor: 0x2ecc71 });

    this.add.text(width / 2, barY + 14, 'LIFETIME SCORE',
      textStyle('10px', '#666666', { fontStyle: 'bold' }),
    ).setOrigin(0.5);

    this.add.text(width / 2, barY + 36, stats.totalScore.toLocaleString(),
      textStyle('22px', '#2ecc71', { fontStyle: 'bold' }),
    ).setOrigin(0.5);

    // — Averages section —
    const avgY = barY + 68;
    drawCard(bg, { x: cardX, y: avgY, w: cardW, h: 58 });

    this.add.text(width / 2, avgY + 12, 'AVERAGES',
      textStyle('10px', '#555555', { fontStyle: 'bold' }),
    ).setOrigin(0.5);

    const avgScore = stats.gamesPlayed > 0 ? Math.round(stats.totalScore / stats.gamesPlayed) : 0;
    const avgPops = stats.gamesPlayed > 0 ? Math.round(stats.totalPops / stats.gamesPlayed) : 0;

    this.add.text(width * 0.3, avgY + 38, `${avgScore.toLocaleString()}\nper game`,
      textStyle('14px', '#aaaaaa', { align: 'center' }),
    ).setOrigin(0.5);

    this.add.text(width * 0.7, avgY + 38, `${avgPops.toLocaleString()}\npops/game`,
      textStyle('14px', '#aaaaaa', { align: 'center' }),
    ).setOrigin(0.5);

    // — Streak tier unlocked —
    const tierY = avgY + 75;
    const tierLevel = getStreakTier(stats.bestStreak);
    if (tierLevel && window.characters) {
      const char = window.characters[tierLevel.char];
      if (char) {
        drawCard(bg, { x: cardX, y: tierY, w: cardW, h: 80,
          borderColor: Phaser.Display.Color.HexStringToColor(tierLevel.color).color });

        this.add.text(cardX + 12, tierY + 10, 'HIGHEST TIER',
          textStyle('10px', '#555555', { fontStyle: 'bold' }));

        this.add.text(cardX + 12, tierY + 30, `${tierLevel.label}`,
          textStyle('22px', tierLevel.color, { fontStyle: 'bold' }));

        this.add.text(cardX + 12, tierY + 58, `${char.name} — ${char.title}`,
          textStyle('12px', tierLevel.color, { fontStyle: 'italic' }));

        const charGfx = this.add.graphics();
        char.draw(charGfx, width - 55, tierY + 40, 0.7);
      }
    }

    // Scan button
    const scanY = height - 82;
    createButton(this, { x: width / 2, y: scanY, width: 180, height: 38,
      text: 'PERFORMANCE SCAN', color: '#00e5ff',
      iconFn: (s, bx, by) => Icons.scan(s, bx, by, 14, 0x00e5ff),
      callback: () => this.scene.start('ScanScene'),
    });

    // Back button
    const backY = height - 40;
    createButton(this, { x: width / 2, y: backY, width: 180, height: 42,
      text: 'BACK', color: '#aaaaaa',
      iconFn: (s, bx, by) => Icons.back(s, bx, by, 14, 0xaaaaaa),
      callback: () => this.scene.start('TitleScene'),
    });
  }
}

// =============================================================
// SCAN SCENE — Performance evaluation with progressive challenges
// =============================================================
class ScanScene extends Phaser.Scene {
  constructor() { super({ key: 'ScanScene' }); }

  create() {
    const { width, height } = this.scale;
    const stats = CareerStats.load();
    const gfx = this.add.graphics();
    drawDarkGridBg(this);

    // ── Derived metrics ──
    const gp = Math.max(stats.gamesPlayed, 1);
    const avgScore = Math.round(stats.totalScore / gp);
    const avgPops = Math.round(stats.totalPops / gp);
    const efficiency = avgPops > 0 ? +(avgScore / avgPops).toFixed(1) : 0;
    const nextTier = STREAK_LEVELS.find(l => stats.bestStreak < l.min) || null;
    const currentTier = getStreakTier(stats.bestStreak);

    // Skill bracket (based on avg score)
    const brackets = [
      { min: 0,    label: 'ROOKIE',    color: '#666666', accent: 0x666666 },
      { min: 500,  label: 'PLAYER',    color: '#3498db', accent: 0x3498db },
      { min: 1500, label: 'BALLER',    color: '#2ecc71', accent: 0x2ecc71 },
      { min: 3000, label: 'ELITE',     color: '#f1c40f', accent: 0xf1c40f },
      { min: 5000, label: 'GOATED',    color: '#e74c3c', accent: 0xe74c3c },
      { min: 8000, label: 'MYTHIC',    color: '#9b59b6', accent: 0x9b59b6 },
    ];
    const bracket = brackets.filter(b => avgScore >= b.min).pop();
    const nextBracket = brackets.find(b => avgScore < b.min) || null;

    // ── Header ──
    const scanColor = 0x00e5ff;
    drawSceneHeader(this, 'PERFORMANCE SCAN', { color: '#00e5ff', y: 28 });

    // ── Skill bracket display ──
    const bracketY = 56;
    drawCard(gfx, { x: 15, y: bracketY, w: width - 30, h: 70, radius: 12,
      fillColor: 0x0d0d1f, fillAlpha: 0.95, borderColor: bracket.accent,
      borderAlpha: 0.5, borderWidth: 1.5 });

    this.add.text(width / 2, bracketY + 14, 'SKILL BRACKET', {
      fontSize: '9px', fontFamily: UI_FONT, fontStyle: 'bold', color: '#444444',
    }).setOrigin(0.5);

    const bracketLabel = this.add.text(width / 2, bracketY + 42, bracket.label, {
      fontSize: '30px', fontFamily: UI_FONT,
      fontStyle: 'bold', color: bracket.color,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: bracketLabel, alpha: 1, duration: 600, delay: 200, ease: 'Power2' });
    this.tweens.add({
      targets: bracketLabel, scale: 1.03, duration: 1200,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 800,
    });

    // ── Stat bars ──
    const barStartY = bracketY + 82;
    const barW = width - 50;
    const barH = 14;
    const barGap = 42;
    const barX = 25;

    const metrics = [
      { label: 'AVG SCORE', value: avgScore, max: 10000, color: 0xf1c40f, hex: '#f1c40f' },
      { label: 'EFFICIENCY', value: efficiency, max: 20, color: 0x2ecc71, hex: '#2ecc71', suffix: 'pts/pop' },
      { label: 'STREAK PEAK', value: stats.bestStreak, max: 15, color: 0xe74c3c, hex: '#e74c3c', suffix: 'x' },
    ];

    metrics.forEach((m, i) => {
      const my = barStartY + i * barGap;
      this.add.text(barX, my, m.label, {
        fontSize: '9px', fontFamily: UI_FONT, fontStyle: 'bold', color: '#555555',
      });
      const displayVal = m.suffix ? `${m.value}${m.suffix}` : m.value.toLocaleString();
      this.add.text(barX + barW, my, displayVal, {
        fontSize: '10px', fontFamily: UI_FONT, fontStyle: 'bold', color: m.hex,
      }).setOrigin(1, 0);

      // Bar track
      const trackY = my + 16;
      gfx.fillStyle(0x1a1a2e, 1);
      gfx.fillRoundedRect(barX, trackY, barW, barH, 4);

      // Animated fill
      const fill = Math.min(m.value / m.max, 1);
      const fillGfx = this.add.graphics();
      fillGfx.fillStyle(m.color, 0.85);
      fillGfx.fillRoundedRect(barX, trackY, 0, barH, 4);

      this.tweens.addCounter({
        from: 0, to: fill * barW, duration: 800, delay: 300 + i * 150,
        ease: 'Power2',
        onUpdate: (tw) => {
          fillGfx.clear();
          fillGfx.fillStyle(m.color, 0.85);
          fillGfx.fillRoundedRect(barX, trackY, Math.floor(tw.getValue()), barH, 4);
        },
      });
    });

    // ── Progressive challenges ──
    const challY = barStartY + metrics.length * barGap + 10;
    this.add.text(width / 2, challY, 'NEXT CHALLENGES', {
      fontSize: '11px', fontFamily: UI_FONT, fontStyle: 'bold', color: '#00e5ff',
    }).setOrigin(0.5);

    const challenges = [];
    if (nextBracket) {
      challenges.push({ text: `Avg ${nextBracket.min.toLocaleString()} pts → ${nextBracket.label}`, color: nextBracket.color });
    }
    if (nextTier) {
      challenges.push({ text: `${nextTier.min}x streak → unlock ${nextTier.label}`, color: nextTier.color });
    }
    const effTarget = Math.ceil(efficiency + 2);
    challenges.push({ text: `${effTarget}+ pts per pop → sharper combos`, color: '#2ecc71' });
    if (stats.gamesPlayed < 10) {
      challenges.push({ text: `Play ${10 - stats.gamesPlayed} more → unlock deeper analysis`, color: '#3498db' });
    } else {
      const scoreTarget = Math.ceil(avgScore * 1.25);
      challenges.push({ text: `Beat ${scoreTarget.toLocaleString()} avg → prove consistency`, color: '#f1c40f' });
    }

    challenges.slice(0, 3).forEach((ch, i) => {
      const cy = challY + 20 + i * 30;
      const dot = this.add.graphics();
      dot.fillStyle(Phaser.Display.Color.HexStringToColor(ch.color).color, 0.8);
      dot.fillCircle(barX + 4, cy + 7, 3);

      const txt = this.add.text(barX + 16, cy, ch.text, {
        fontSize: '12px', fontFamily: UI_FONT, color: '#cccccc',
        wordWrap: { width: barW - 16 },
      }).setAlpha(0);

      this.tweens.add({ targets: txt, alpha: 1, duration: 400, delay: 800 + i * 200 });
    });

    // ── Games played footnote ──
    const footY = height - 68;
    this.add.text(width / 2, footY, `Based on ${stats.gamesPlayed} game${stats.gamesPlayed !== 1 ? 's' : ''}`, {
      fontSize: '10px', fontFamily: UI_FONT, color: '#333333',
    }).setOrigin(0.5);

    // ── Back button ──
    createButton(this, { x: width / 2, y: height - 36, width: 180, height: 38,
      text: 'BACK', color: '#aaaaaa',
      iconFn: (s, bx, by) => Icons.back(s, bx, by, 14, 0xaaaaaa),
      callback: () => this.scene.start('StatsScene'),
    });
  }
}

// =============================================================
// ACHIEVEMENTS SCENE — Badge wall with unlock status
// =============================================================
class AchievementsScene extends Phaser.Scene {
  constructor() { super({ key: 'AchievementsScene' }); }

  create() {
    const { width, height } = this.scale;
    drawDarkGridBg(this);

    drawSceneHeader(this, 'ACHIEVEMENTS', { color: '#f1c40f' });

    const unlocked = new Set(Achievements.load());
    const count = unlocked.size;
    const total = ACHIEVEMENTS.length;

    // Progress summary
    this.add.text(width / 2, 62, `${count} / ${total} UNLOCKED`, {
      fontSize: '13px', fontFamily: UI_FONT, color: '#888888',
    }).setOrigin(0.5);

    // Progress bar
    const barX = 30, barY = 80, barW = width - 60, barH = 4;
    const barGfx = this.add.graphics();
    barGfx.fillStyle(0x1a1a2e, 1);
    barGfx.fillRoundedRect(barX, barY, barW, barH, 2);
    if (count > 0) {
      barGfx.fillStyle(0xf1c40f, 0.9);
      barGfx.fillRoundedRect(barX, barY, barW * (count / total), barH, 2);
    }

    // Badge cards — 2 columns
    const cardW = (width - 50) / 2;
    const cardH = 68;
    const startY = 100;
    const gfx = this.add.graphics();

    ACHIEVEMENTS.forEach((ach, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = 20 + col * (cardW + 10);
      const cy = startY + row * (cardH + 8);
      const isUnlocked = unlocked.has(ach.id);

      // Card background
      const borderColor = isUnlocked ? ach.color : 0x1a1a2e;
      drawCard(gfx, { x: cx, y: cy, w: cardW, h: cardH, radius: 8,
        fillColor: isUnlocked ? 0x151528 : 0x0e0e1a, fillAlpha: 1,
        borderColor, borderAlpha: isUnlocked ? 0.6 : 0.2, borderWidth: isUnlocked ? 1.5 : 1 });

      // Icon or lock
      if (isUnlocked) {
        const iconFn = Icons[ach.icon] || Icons.badge;
        iconFn(this, cx + 22, cy + cardH / 2, 18, ach.color);
      } else {
        Icons.lock(this, cx + 22, cy + cardH / 2, 18, 0x333333);
      }

      // Name
      const nameColor = isUnlocked
        ? '#' + ach.color.toString(16).padStart(6, '0')
        : '#444444';
      this.add.text(cx + 42, cy + 16, ach.name, {
        fontSize: '12px', fontFamily: UI_FONT, fontStyle: 'bold', color: nameColor,
      });

      // Description
      this.add.text(cx + 42, cy + 34, ach.desc, {
        fontSize: '10px', fontFamily: UI_FONT, color: isUnlocked ? '#777777' : '#333333',
        wordWrap: { width: cardW - 52 },
      });

      // Glow pulse on unlocked badges
      if (isUnlocked) {
        const glowGfx = this.add.graphics();
        glowGfx.fillStyle(ach.color, 0.08);
        glowGfx.fillRoundedRect(cx, cy, cardW, cardH, 8);
        this.tweens.add({
          targets: glowGfx, alpha: 0, duration: 1800,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      }
    });

    // Back button
    createButton(this, { x: width / 2, y: height - 36, width: width - 60, height: 38,
      text: 'BACK', color: '#aaaaaa',
      iconFn: (s, bx, by) => Icons.back(s, bx, by, 14, 0xaaaaaa),
      callback: () => this.scene.start('TitleScene'),
    });
  }
}

// =============================================================
// GAME SCENE — Core gameplay
// =============================================================
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data) {
    this.gameMode = data?.mode || 'timed';
    this.grid = [];
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.isProcessing = false;
    this.selected = null;
    this.moveCount = 0;
    this.totalPops = 0;
    this.timeLeft = GAME_TIME;
    this.gameOver = false;
    this.isPaused = false;
    this.powerUpOverlay = null;
    this.pauseContainer = null;
    this.cascadeDepth = 0;
    this.bestChain = 0;
    // Fever Mode state
    this.feverMeter = 0;        // 0–100
    this.feverActive = false;
    this.feverTimeLeft = 0;     // seconds remaining
    this.feverDuration = 8;     // total fever seconds
    this.feverCount = 0;        // fevers activated this game
  }

  create() {
    const { width, height } = this.scale;

    // Audio
    this.audioStarted = false;
    this.input.on('pointerdown', () => {
      if (!this.audioStarted) {
        initAudioWithPrefs();
        window.audioEngine.startBgBeat();
        this.audioStarted = true;
      }
    }, this);

    // Background
    drawDarkGridBg(this);

    // ---- HYPE BAR ----
    this.hypeBar = this.add.container(0, 0);

    const hypeBackground = this.add.graphics();
    drawCard(hypeBackground, { x: 10, y: 8, w: width - 20, h: HYPE_BAR_HEIGHT - 16,
      radius: 12, borderColor: 0x2a2a4a, borderAlpha: 0.6, borderWidth: 2 });
    this.hypeBar.add(hypeBackground);

    this.streakText = this.add.text(width / 2, 35, '', {
      fontSize: '28px', fontFamily: UI_FONT,
      fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0);
    this.hypeBar.add(this.streakText);

    this.adlibText = this.add.text(width / 2, 75, '', {
      fontSize: '20px', fontFamily: UI_FONT,
      fontStyle: 'italic', color: '#aaaaaa',
    }).setOrigin(0.5).setAlpha(0);
    this.hypeBar.add(this.adlibText);

    // Character name display
    this.charNameText = this.add.text(20, 95, '', {
      fontSize: '12px', fontFamily: UI_FONT,
      color: '#666666', fontStyle: 'italic',
    }).setAlpha(0);
    this.hypeBar.add(this.charNameText);

    this.characterGfx = this.add.graphics();
    this.characterGfx.setAlpha(0);
    this.hypeBar.add(this.characterGfx);

    // ---- TIMER (timed mode) ----
    if (this.gameMode === 'timed') {
      this.timerBg = this.add.graphics();
      this.timerBg.fillStyle(0x2ecc71, 1);
      this.timerBg.fillRect(0, HYPE_BAR_HEIGHT, width, 4);

      this.timerText = this.add.text(width / 2, HYPE_BAR_HEIGHT + 12, `${GAME_TIME}s`, {
        fontSize: '16px', fontFamily: UI_FONT,
        fontStyle: 'bold', color: '#2ecc71', stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 0);

      // Timer event
      this.timerEvent = this.time.addEvent({
        delay: 1000, repeat: GAME_TIME - 1,
        callback: () => {
          this.timeLeft--;
          this.updateTimer();
          if (this.timeLeft <= 0) this.endGame();
        }
      });
    }

    // ---- SCORE / UI ----
    // Score bar background
    const scoreBg = this.add.graphics();
    scoreBg.fillStyle(0x0d0d1a, 0.9);
    scoreBg.fillRect(0, height - 65, width, 65);
    scoreBg.lineStyle(1, 0x1a1a2e, 0.5);
    scoreBg.lineBetween(0, height - 65, width, height - 65);

    this.scoreText = this.add.text(20, height - 55, 'SCORE: 0', {
      fontSize: '20px', fontFamily: UI_FONT,
      fontStyle: 'bold', color: '#f1c40f', stroke: '#000000', strokeThickness: 3,
    });

    this.streakCounter = this.add.text(width - 20, height - 55, '', {
      fontSize: '16px', fontFamily: UI_FONT,
      color: '#888888',
    }).setOrigin(1, 0);

    this.bestStreakText = this.add.text(width - 20, height - 33, '', {
      fontSize: '12px', fontFamily: UI_FONT,
      color: '#555555',
    }).setOrigin(1, 0);

    // Mode indicator
    if (this.gameMode === 'zen') {
      this.add.text(width / 2, HYPE_BAR_HEIGHT + 12, 'ZEN MODE', {
        fontSize: '12px', fontFamily: UI_FONT,
        color: '#3498db',
      }).setOrigin(0.5, 0);
    }

    // ---- POWER-UP OVERLAY (drawn each frame for pulsing effects) ----
    this.powerUpOverlay = this.add.graphics();
    this.powerUpOverlay.setDepth(3);

    // ---- BUILD GRID ----
    this.bubbleContainer = this.add.container(0, 0);
    this.buildGrid();

    // ---- INPUT ----
    this.swipeStart = null;
    this.swipeBubble = null;
    this.input.on('gameobjectdown', this.onPointerDown, this);
    this.input.on('pointerup', this.onPointerUp, this);

    // Ambient particles
    this.spawnAmbientParticles();

    // ---- STREAK PROGRESS BAR ----
    this.buildStreakProgressBar();

    // ---- FEVER METER ----
    this.buildFeverMeter();

    // ---- PAUSE BUTTON (top-left corner) ----
    const pauseBtnSize = 36;
    const pauseBtnX = width - 30;
    const pauseBtnY = HYPE_BAR_HEIGHT + 18;

    this.pauseBtnBg = this.add.graphics();
    drawCard(this.pauseBtnBg, { x: pauseBtnX - pauseBtnSize / 2, y: pauseBtnY - pauseBtnSize / 2,
      w: pauseBtnSize, h: pauseBtnSize, radius: 8,
      fillColor: 0x1a1a2e, fillAlpha: 0.8, borderAlpha: 0.6 });
    this.pauseBtnBg.setDepth(40);

    // Pause icon (two bars)
    this.pauseIconGfx = Icons.pause(this, pauseBtnX, pauseBtnY, 20, 0xaaaaaa);
    this.pauseIconGfx.setDepth(41);

    const pauseHit = this.add.rectangle(pauseBtnX, pauseBtnY, pauseBtnSize, pauseBtnSize).setInteractive().setAlpha(0.001).setDepth(42);
    pauseHit.on('pointerdown', () => this.togglePause());

    // ---- TIPS DISPLAY (shows rotating tips at bottom) ----
    this.tipIndex = Phaser.Math.Between(0, TIPS.length - 1);
    this.tipText = this.add.text(width / 2, height - 12, TIPS[this.tipIndex], {
      fontSize: '10px', fontFamily: UI_FONT,
      color: '#444444', fontStyle: 'italic', align: 'center',
      wordWrap: { width: width - 40 },
    }).setOrigin(0.5, 1).setDepth(1);

    // Rotate tips every 8 seconds
    this.time.addEvent({
      delay: 8000, loop: true,
      callback: () => {
        if (this.isPaused || this.gameOver) return;
        this.tipIndex = (this.tipIndex + 1) % TIPS.length;
        this.tweens.add({
          targets: this.tipText, alpha: 0, duration: 300,
          onComplete: () => {
            this.tipText.setText(TIPS[this.tipIndex]);
            this.tweens.add({ targets: this.tipText, alpha: 1, duration: 300 });
          }
        });
      }
    });

    // "GO!" flash
    const goText = this.add.text(width / 2, height / 2, 'GO!', {
      fontSize: '64px', fontFamily: UI_FONT,
      fontStyle: 'bold', color: '#f1c40f', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets: goText, scale: 2, alpha: 0,
      duration: 800, ease: 'Quad.easeOut', delay: 300,
      onComplete: () => goText.destroy(),
    });
  }

  // -----------------------------------------------------------
  // STREAK PROGRESS BAR — visual tier tracking
  // -----------------------------------------------------------
  buildStreakProgressBar() {
    const { width } = this.scale;
    const barY = HYPE_BAR_HEIGHT - 2;
    const barX = 20;
    const barW = width - 40;
    const barH = 5;
    const maxStreak = 12;

    this._spBar = { x: barX, y: barY, w: barW, h: barH, max: maxStreak };

    // Track background
    const trackGfx = this.add.graphics();
    trackGfx.fillStyle(0x1a1a2e, 0.8);
    trackGfx.fillRoundedRect(barX, barY, barW, barH, 2);
    trackGfx.lineStyle(1, 0x2a2a4a, 0.5);
    trackGfx.strokeRoundedRect(barX, barY, barW, barH, 2);

    // Fill bar (drawn dynamically)
    this.streakBarFill = this.add.graphics();

    // Tier markers — small notches at 3, 5, 8, 12
    const markerGfx = this.add.graphics();
    const tierPositions = [3, 5, 8, 12];
    const tierColors = [0x2ecc71, 0xf1c40f, 0xe74c3c, 0x9b59b6];

    tierPositions.forEach((tier, i) => {
      const mx = barX + (tier / maxStreak) * barW;
      markerGfx.fillStyle(tierColors[i], 0.6);
      markerGfx.fillRect(mx - 1, barY - 2, 2, barH + 4);
    });

    // Tier labels (tiny, positioned below markers)
    const tierLabels = ['3x', '5x', '8x', '12x'];
    tierPositions.forEach((tier, i) => {
      const mx = barX + (tier / maxStreak) * barW;
      this.add.text(mx, barY + barH + 3, tierLabels[i], {
        fontSize: '7px', fontFamily: UI_FONT,
        color: '#444444',
      }).setOrigin(0.5, 0);
    });

    // Glow effect (hidden by default)
    this.streakBarGlow = this.add.graphics();
    this.streakBarGlow.setAlpha(0);

    this.updateStreakProgress(0, false);
  }

  updateStreakProgress(streak, animate = true) {
    const { x, y, w, h, max } = this._spBar;
    const progress = Math.min(streak / max, 1);

    // Determine fill color from tier
    let fillColor = 0x3a3a5e; // default dim
    if (streak >= 12) fillColor = 0x9b59b6;
    else if (streak >= 8) fillColor = 0xe74c3c;
    else if (streak >= 5) fillColor = 0xf1c40f;
    else if (streak >= 3) fillColor = 0x2ecc71;
    else if (streak >= 1) fillColor = 0x555555;

    const fillW = Math.max(progress * w, 0);

    this.streakBarFill.clear();
    if (fillW > 0) {
      this.streakBarFill.fillStyle(fillColor, 0.9);
      this.streakBarFill.fillRoundedRect(x, y, fillW, h, 2);
    }

    // Glow pulse on tier thresholds
    const tierHits = [3, 5, 8, 12];
    if (animate && tierHits.includes(streak)) {
      this.streakBarGlow.clear();
      const glowColor = fillColor;
      this.streakBarGlow.fillStyle(glowColor, 0.4);
      this.streakBarGlow.fillRoundedRect(x - 2, y - 2, fillW + 4, h + 4, 3);
      this.streakBarGlow.setAlpha(1);
      this.tweens.add({
        targets: this.streakBarGlow,
        alpha: 0,
        duration: 600,
        ease: 'Quad.easeOut',
      });

      // Camera shake — escalating intensity by tier
      if (streak >= 12) {
        this.cameras.main.shake(400, 0.012);
      } else if (streak >= 8) {
        this.cameras.main.shake(300, 0.008);
      } else if (streak >= 5) {
        this.cameras.main.shake(200, 0.005);
      }
    }
  }

  // -----------------------------------------------------------
  // FEVER MODE — Build-up meter + 2x score multiplier burst
  // -----------------------------------------------------------
  buildFeverMeter() {
    const { height } = this.scale;
    const barX = 6;
    const barY = GRID_OFFSET_Y;
    const barW = 8;
    const barH = height - GRID_OFFSET_Y - 75;

    this._fBar = { x: barX, y: barY, w: barW, h: barH };

    // Track background
    const track = this.add.graphics();
    track.fillStyle(0x1a1a2e, 0.6);
    track.fillRoundedRect(barX, barY, barW, barH, 4);
    track.lineStyle(1, 0x2a2a4a, 0.4);
    track.strokeRoundedRect(barX, barY, barW, barH, 4);

    // Fill (drawn dynamically, bottom-up)
    this.feverBarFill = this.add.graphics();

    // Glow overlay
    this.feverBarGlow = this.add.graphics().setAlpha(0);

    // Label
    this.feverLabel = this.add.text(barX + barW / 2, barY - 8, 'F', {
      fontSize: '8px', fontFamily: UI_FONT,
      fontStyle: 'bold', color: '#555555',
    }).setOrigin(0.5);

    // Fever active border (full-screen glow, hidden by default)
    this.feverBorderGfx = this.add.graphics().setAlpha(0).setDepth(45);

    // Fever countdown text (hidden by default)
    this.feverCountdown = this.add.text(20, GRID_OFFSET_Y - 18, '', {
      fontSize: '11px', fontFamily: UI_FONT,
      fontStyle: 'bold', color: '#ff4444',
    }).setAlpha(0);

    this.updateFeverMeter(false);
  }

  updateFeverMeter(animate = true) {
    const { x, y, w, h } = this._fBar;
    const pct = Math.min(this.feverMeter / 100, 1);
    const fillH = pct * h;

    // Color ramps from cool to hot
    let fillColor = 0x3a3a5e;
    if (this.feverActive) fillColor = 0xff2222;
    else if (pct >= 0.8) fillColor = 0xff4444;
    else if (pct >= 0.5) fillColor = 0xff8800;
    else if (pct >= 0.25) fillColor = 0xf1c40f;

    this.feverBarFill.clear();
    if (fillH > 0) {
      this.feverBarFill.fillStyle(fillColor, 0.9);
      this.feverBarFill.fillRoundedRect(x, y + h - fillH, w, fillH, 3);
    }

    // Label color
    this.feverLabel.setColor(this.feverActive ? '#ff2222' : pct >= 0.5 ? '#ff8800' : '#555555');

    // Glow pulse when near full
    if (animate && pct >= 0.85 && !this.feverActive) {
      this.feverBarGlow.clear();
      this.feverBarGlow.fillStyle(0xff4444, 0.4);
      this.feverBarGlow.fillRoundedRect(x - 2, y + h - fillH - 2, w + 4, fillH + 4, 4);
      this.feverBarGlow.setAlpha(1);
      this.tweens.add({ targets: this.feverBarGlow, alpha: 0, duration: 500, ease: 'Quad.easeOut' });
    }
  }

  /**
   * Feed the fever meter after a match. Bigger matches = more fuel.
   * @param {number} popped - Bubbles popped
   * @param {number} streak - Current streak
   */
  feedFever(popped, streak) {
    if (this.feverActive) return; // meter frozen during fever
    const gain = (popped * 2) + (streak * 3);
    this.feverMeter = Math.min(this.feverMeter + gain, 100);
    this.updateFeverMeter(true);
    if (this.feverMeter >= 100) this.activateFever();
  }

  activateFever() {
    this.feverActive = true;
    this.feverTimeLeft = this.feverDuration;
    this.feverCount++;
    const { width, height } = this.scale;

    // Audio cue — distinct fever siren
    window.audioEngine.playFeverActivate();

    // "FEVER!" announcement
    const feverText = this.add.text(width / 2, height * 0.35, 'FEVER!', {
      fontSize: '52px', fontFamily: UI_FONT,
      fontStyle: 'bold', color: '#ff2222', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(50).setScale(0);

    this.tweens.add({
      targets: feverText, scale: 1.3, duration: 400, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: feverText, alpha: 0, scale: 2, duration: 600, ease: 'Quad.easeOut',
          onComplete: () => feverText.destroy(),
        });
      },
    });

    const sub = this.add.text(width / 2, height * 0.42, '2X SCORE', {
      fontSize: '22px', fontFamily: UI_FONT,
      fontStyle: 'bold', color: '#ff8800',
    }).setOrigin(0.5).setDepth(50).setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 300, delay: 200 });
    this.tweens.add({ targets: sub, alpha: 0, duration: 400, delay: 1200, onComplete: () => sub.destroy() });

    // Camera flash
    this.screenFlash(0xff2222);

    // Border glow — persistent during fever
    this._drawFeverBorder();
    this.feverBorderGfx.setAlpha(1);

    // Countdown display
    this.feverCountdown.setAlpha(1);
    this.feverCountdown.setText(`FEVER ${this.feverTimeLeft}s`);

    // Tick down every second
    this.feverTickEvent = this.time.addEvent({
      delay: 1000, repeat: this.feverDuration - 1,
      callback: () => {
        this.feverTimeLeft--;
        if (this.feverTimeLeft > 0) {
          this.feverCountdown.setText(`FEVER ${this.feverTimeLeft}s`);
          this._drawFeverBorder(); // refresh glow intensity
        } else {
          this.deactivateFever();
        }
      },
    });

    this.updateFeverMeter(false);
  }

  _drawFeverBorder() {
    const { width, height } = this.scale;
    const intensity = Math.max(0.3, this.feverTimeLeft / this.feverDuration);
    this.feverBorderGfx.clear();
    this.feverBorderGfx.lineStyle(3, 0xff2222, intensity * 0.8);
    this.feverBorderGfx.strokeRoundedRect(2, 2, width - 4, height - 4, 10);
    this.feverBorderGfx.lineStyle(1, 0xff8800, intensity * 0.4);
    this.feverBorderGfx.strokeRoundedRect(5, 5, width - 10, height - 10, 8);
  }

  deactivateFever() {
    this.feverActive = false;
    this.feverMeter = 0;
    this.feverTimeLeft = 0;

    if (this.feverTickEvent) {
      this.feverTickEvent.remove(false);
      this.feverTickEvent = null;
    }

    // Fade out border + countdown
    this.tweens.add({ targets: this.feverBorderGfx, alpha: 0, duration: 500 });
    this.tweens.add({ targets: this.feverCountdown, alpha: 0, duration: 300 });

    this.updateFeverMeter(false);
  }

  // -----------------------------------------------------------
  // PAUSE SYSTEM
  // -----------------------------------------------------------
  togglePause() {
    if (this.gameOver) return;
    if (this.isPaused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  pauseGame() {
    this.isPaused = true;

    // Pause timer
    if (this.timerEvent) this.timerEvent.paused = true;

    // Pause scene clock — freezes ALL delayedCall/addEvent timers
    // (cascade cycle, tip rotation, ambient particles)
    this.time.paused = true;

    // Pause all tweens
    this.tweens.pauseAll();

    const { width, height } = this.scale;

    // Build pause overlay
    this.pauseContainer = this.add.container(0, 0).setDepth(100);

    // Dim background
    const dimBg = this.add.graphics();
    dimBg.fillStyle(0x000000, 0.75);
    dimBg.fillRect(0, 0, width, height);
    this.pauseContainer.add(dimBg);

    // Pause card
    const cardW = width - 40;
    const cardH = 440;
    const cardX = 20;
    const cardY = (height - cardH) / 2;

    const card = this.add.graphics();
    drawCard(card, { x: cardX, y: cardY, w: cardW, h: cardH, radius: 16,
      fillAlpha: 1, borderAlpha: 0.8, borderWidth: 2 });
    this.pauseContainer.add(card);

    // PAUSED title
    const pauseTitle = this.add.text(width / 2, cardY + 30, 'PAUSED', {
      fontSize: '32px', fontFamily: UI_FONT,
      fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.pauseContainer.add(pauseTitle);

    // Current score
    const scoreLabel = this.add.text(width / 2, cardY + 70, `SCORE: ${this.score.toLocaleString()}`, {
      fontSize: '18px', fontFamily: UI_FONT,
      color: '#f1c40f',
    }).setOrigin(0.5);
    this.pauseContainer.add(scoreLabel);

    // Tip in pause screen
    const tipLabel = this.add.text(width / 2, cardY + 105, 'TIP', {
      fontSize: '11px', fontFamily: UI_FONT,
      fontStyle: 'bold', color: '#555555',
    }).setOrigin(0.5);
    this.pauseContainer.add(tipLabel);

    const pauseTip = TIPS[Phaser.Math.Between(0, TIPS.length - 1)];
    const tipDisplay = this.add.text(width / 2, cardY + 130, pauseTip, {
      fontSize: '14px', fontFamily: UI_FONT,
      color: '#aaaaaa', fontStyle: 'italic', align: 'center',
      wordWrap: { width: cardW - 40 },
    }).setOrigin(0.5, 0);
    this.pauseContainer.add(tipDisplay);

    // Buttons
    const btnW = cardW - 40;
    const btnH = 48;
    const btnX = width / 2;

    // Sound toggle in pause menu
    const isMuted = window.audioEngine.muted;
    const soundBtnColor = isMuted ? '#888888' : '#ffffff';
    const soundBtnText = isMuted ? 'SOUND: OFF' : 'SOUND: ON';
    const soundIconFn = isMuted
      ? (s, bx, by) => { const ic = Icons.speakerMuted(s, bx, by, 14, 0x888888); this.pauseContainer.add(ic); return ic; }
      : (s, bx, by) => { const ic = Icons.speaker(s, bx, by, 14, 0xffffff); this.pauseContainer.add(ic); return ic; };

    createButton(this, { x: btnX, y: cardY + 195, width: btnW, height: 40,
      text: soundBtnText, color: soundBtnColor, container: this.pauseContainer,
      iconFn: soundIconFn,
      callback: () => {
        const nowMuted = toggleMuteAndSave();
        // Rebuild pause menu to reflect new state
        this.cleanupPause();
        this.pauseGame();
      },
    });

    // Resume
    createButton(this, { x: btnX, y: cardY + 250, width: btnW, height: btnH,
      text: 'RESUME', color: '#2ecc71', container: this.pauseContainer,
      iconFn: (s, bx, by) => Icons.play(s, bx, by, 14, 0x2ecc71),
      callback: () => this.resumeGame(),
    });

    // Restart
    createButton(this, { x: btnX, y: cardY + 310, width: btnW, height: btnH,
      text: 'RESTART', color: '#f1c40f', container: this.pauseContainer,
      iconFn: (s, bx, by) => Icons.restart(s, bx, by, 14, 0xf1c40f),
      callback: () => { this.cleanupPause(); window.audioEngine.stopBgBeat(); this.scene.restart({ mode: this.gameMode }); },
    });

    // Exit to menu — save career stats so zen mode progress isn't lost
    createButton(this, { x: btnX, y: cardY + 370, width: btnW, height: btnH,
      text: 'EXIT TO MENU', color: '#e74c3c', container: this.pauseContainer,
      iconFn: (s, bx, by) => Icons.close(s, bx, by, 14, 0xe74c3c),
      callback: () => {
        this.cleanupPause();
        if (!this.gameOver && (this.score > 0 || this.totalPops > 0)) {
          CareerStats.record({ score: this.score, pops: this.totalPops, bestStreak: this.bestStreak, bestChain: this.bestChain, fevers: this.feverCount });
          saveHighScore(this.score);
        }
        window.audioEngine.stopBgBeat();
        this.scene.start('TitleScene');
      },
    });
  }

  resumeGame() {
    this.isPaused = false;
    if (this.timerEvent) this.timerEvent.paused = false;

    // Resume scene clock — unpauses all delayedCall/addEvent timers
    this.time.paused = false;

    this.tweens.resumeAll();
    if (this.pauseContainer) {
      this.pauseContainer.destroy(true);
      this.pauseContainer = null;
    }
  }

  cleanupPause() {
    this.isPaused = false;

    // Restore scene clock so restart/exit transitions aren't frozen
    this.time.paused = false;

    if (this.pauseContainer) {
      this.pauseContainer.destroy(true);
      this.pauseContainer = null;
    }
  }

  update(time) {
    // Render power-up overlays (pulsing animations)
    if (this.powerUpOverlay) {
      this.powerUpOverlay.clear();
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const bubble = this.grid[r]?.[c];
          if (bubble && bubble.getData('powerUp')) {
            const pType = bubble.getData('powerUp');
            if (pType !== POWERUP_TYPES.NONE) {
              PowerUpRenderer.draw(
                this.powerUpOverlay, pType,
                bubble.x, bubble.y, BUBBLE_SIZE, time
              );
            }
          }
        }
      }
    }
  }

  // -----------------------------------------------------------
  // TIMER
  // -----------------------------------------------------------
  updateTimer() {
    const { width } = this.scale;
    const pct = this.timeLeft / GAME_TIME;

    // Color transition: green → yellow → red
    let color;
    if (pct > 0.5) color = '#2ecc71';
    else if (pct > 0.25) color = '#f1c40f';
    else color = '#e74c3c';

    this.timerText.setText(`${this.timeLeft}s`);
    this.timerText.setColor(color);

    // Timer bar
    this.timerBg.clear();
    const barColor = pct > 0.5 ? 0x2ecc71 : pct > 0.25 ? 0xf1c40f : 0xe74c3c;
    this.timerBg.fillStyle(barColor, 1);
    this.timerBg.fillRect(0, HYPE_BAR_HEIGHT, width * pct, 4);

    // Urgency shake when low
    if (this.timeLeft <= 10 && this.timeLeft > 0) {
      this.cameras.main.shake(50, 0.001);
    }
  }

  endGame() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.isProcessing = true;

    // Cancel fever if active
    if (this.feverActive) this.deactivateFever();

    // Cancel timer to prevent further ticks after game ends
    if (this.timerEvent) {
      this.timerEvent.remove(false);
      this.timerEvent = null;
    }

    window.audioEngine.stopBgBeat();

    // Play final sound
    window.audioEngine.playStreakHit(12);

    const isNewHigh = saveHighScore(this.score);

    // Record career stats
    const { stats: career, newRecords } = CareerStats.record({
      score: this.score,
      pops: this.totalPops,
      bestStreak: this.bestStreak,
      bestChain: this.bestChain,
      fevers: this.feverCount,
    });

    // Record in Hall of Fame
    const { rank: hofRank } = HallOfFame.record(this.score, this.bestStreak, this.gameMode);

    // Check achievements and show toasts for new unlocks
    const newAchievements = Achievements.check(career);
    newAchievements.forEach((achId, i) => {
      this.time.delayedCall(500 + i * 800, () => showAchievementToast(this, achId));
    });

    // Transition
    this.time.delayedCall(1000, () => {
      this.scene.start('GameOverScene', {
        score: this.score,
        bestStreak: this.bestStreak,
        bestChain: this.bestChain,
        moves: this.moveCount,
        isNewHigh,
        career,
        newRecords,
        mode: this.gameMode,
        hofRank,
      });
    });
  }

  // -----------------------------------------------------------
  // GRID
  // -----------------------------------------------------------
  buildGrid() {
    this.grid = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      this.grid[row] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        this.spawnBubble(row, col, true);
      }
    }
    this.resolveInitialMatches();
  }

  spawnBubble(row, col, animate = false) {
    const colorIdx = Phaser.Math.Between(0, COLORS.length - 1);
    const pos = this.gridToWorld(row, col);

    const bubble = this.add.image(pos.x, animate ? -50 : pos.y, `bubble_${colorIdx}`);
    bubble.setInteractive();
    bubble.setData('row', row);
    bubble.setData('col', col);
    bubble.setData('colorIdx', colorIdx);
    bubble.setData('powerUp', POWERUP_TYPES.NONE);
    bubble.setScale(0.95);

    this.bubbleContainer.add(bubble);
    this.grid[row][col] = bubble;

    if (animate) {
      bubble.setAlpha(0);
      this.tweens.add({
        targets: bubble, y: pos.y, alpha: 1,
        duration: 300 + row * 40, ease: 'Bounce.easeOut',
        delay: col * 30 + row * 20,
      });
    }

    return bubble;
  }

  gridToWorld(row, col) {
    return {
      x: GRID_OFFSET_X + col * (BUBBLE_SIZE + BUBBLE_PAD) + BUBBLE_SIZE / 2,
      y: GRID_OFFSET_Y + row * (BUBBLE_SIZE + BUBBLE_PAD) + BUBBLE_SIZE / 2,
    };
  }

  resolveInitialMatches() {
    let safety = 0;
    let matches = this.findAllMatches();
    while (matches.length > 0 && safety < 200) {
      matches.forEach(group => {
        const b = group[group.length - 1];
        const newColor = this.getColorWithoutMatch(b.getData('row'), b.getData('col'));
        b.setData('colorIdx', newColor);
        b.setTexture(`bubble_${newColor}`);
      });
      safety++;
      matches = this.findAllMatches();
    }
  }

  getColorWithoutMatch(row, col) {
    const avoid = new Set();
    if (col >= 2) {
      const c1 = this.grid[row][col - 1]?.getData('colorIdx');
      const c2 = this.grid[row][col - 2]?.getData('colorIdx');
      if (c1 !== undefined && c1 === c2) avoid.add(c1);
    }
    if (row >= 2) {
      const c1 = this.grid[row - 1]?.[col]?.getData('colorIdx');
      const c2 = this.grid[row - 2]?.[col]?.getData('colorIdx');
      if (c1 !== undefined && c1 === c2) avoid.add(c1);
    }
    const available = [];
    for (let i = 0; i < COLORS.length; i++) {
      if (!avoid.has(i)) available.push(i);
    }
    return available[Phaser.Math.Between(0, available.length - 1)];
  }

  // -----------------------------------------------------------
  // INPUT — Tap + Swipe
  // -----------------------------------------------------------
  onPointerDown(pointer, bubble) {
    if (this.isProcessing || this.gameOver || this.isPaused) return;
    this.swipeStart = { x: pointer.x, y: pointer.y };
    this.swipeBubble = bubble;
    window.audioEngine.playSelect();
    this.highlightBubble(bubble, true);
  }

  onPointerUp(pointer) {
    if (this.isProcessing || !this.swipeBubble || this.gameOver || this.isPaused) return;

    const dx = pointer.x - this.swipeStart.x;
    const dy = pointer.y - this.swipeStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const SWIPE_THRESHOLD = 20;

    if (dist > SWIPE_THRESHOLD) {
      // SWIPE
      this.highlightBubble(this.swipeBubble, false);
      if (this.selected) {
        this.highlightBubble(this.selected, false);
        this.selected = null;
      }

      const row = this.swipeBubble.getData('row');
      const col = this.swipeBubble.getData('col');
      let targetRow = row, targetCol = col;
      if (Math.abs(dx) > Math.abs(dy)) {
        targetCol += dx > 0 ? 1 : -1;
      } else {
        targetRow += dy > 0 ? 1 : -1;
      }

      if (targetRow >= 0 && targetRow < GRID_ROWS && targetCol >= 0 && targetCol < GRID_COLS) {
        const targetBubble = this.grid[targetRow][targetCol];
        if (targetBubble) {
          this.isProcessing = true;
          this.swapBubbles(this.swipeBubble, targetBubble);
        }
      }
      this.swipeBubble = null;
      this.swipeStart = null;
    } else {
      // TAP
      this.highlightBubble(this.swipeBubble, false);

      if (!this.selected) {
        this.selected = this.swipeBubble;
        this.highlightBubble(this.swipeBubble, true);
      } else if (this.selected === this.swipeBubble) {
        this.highlightBubble(this.selected, false);
        this.selected = null;
      } else {
        const r1 = this.selected.getData('row'), c1 = this.selected.getData('col');
        const r2 = this.swipeBubble.getData('row'), c2 = this.swipeBubble.getData('col');
        const isAdjacent = (Math.abs(r1 - r2) === 1 && c1 === c2) || (Math.abs(c1 - c2) === 1 && r1 === r2);

        if (isAdjacent) {
          this.highlightBubble(this.selected, false);
          this.isProcessing = true;
          this.swapBubbles(this.selected, this.swipeBubble);
        } else {
          this.highlightBubble(this.selected, false);
          this.selected = this.swipeBubble;
          this.highlightBubble(this.swipeBubble, true);
        }
      }
      this.swipeBubble = null;
      this.swipeStart = null;
    }
  }

  highlightBubble(bubble, on) {
    if (!bubble || !bubble.active) return;
    this.tweens.add({
      targets: bubble, scale: on ? 1.15 : 0.95,
      duration: 150, ease: 'Back.easeOut',
    });
  }

  // -----------------------------------------------------------
  // SWAP + MATCH
  // -----------------------------------------------------------
  swapBubbles(a, b) {
    const r1 = a.getData('row'), c1 = a.getData('col');
    const r2 = b.getData('row'), c2 = b.getData('col');
    const pos1 = this.gridToWorld(r1, c1);
    const pos2 = this.gridToWorld(r2, c2);

    this.grid[r1][c1] = b;
    this.grid[r2][c2] = a;
    a.setData('row', r2); a.setData('col', c2);
    b.setData('row', r1); b.setData('col', c1);

    // Swap trail effect
    this.spawnSwapTrail(a, pos1, pos2);
    this.spawnSwapTrail(b, pos2, pos1);

    this.tweens.add({ targets: a, x: pos2.x, y: pos2.y, duration: 180, ease: 'Quad.easeInOut' });
    this.tweens.add({
      targets: b, x: pos1.x, y: pos1.y, duration: 180, ease: 'Quad.easeInOut',
      onComplete: () => {
        const matches = this.findAllMatches();

        if (matches.length === 0) {
          // No color matches — reverse the swap regardless of power-ups.
          // Power-ups only activate when part of a matched group, not on
          // standalone swaps. Without this guard the else branch would call
          // processMatches([]), inflating streak/fever for free and starting
          // an empty cascade cycle while the power-up never actually fires.
          this.grid[r1][c1] = a; this.grid[r2][c2] = b;
          a.setData('row', r1); a.setData('col', c1);
          b.setData('row', r2); b.setData('col', c2);
          this.tweens.add({ targets: a, x: pos1.x, y: pos1.y, duration: 180, ease: 'Quad.easeInOut' });
          this.tweens.add({
            targets: b, x: pos2.x, y: pos2.y, duration: 180, ease: 'Quad.easeInOut',
            onComplete: () => {
              this.streak = 0;
              this.updateStreakUI();
              this.updateStreakProgress(0);
              this.isProcessing = false;
            }
          });
          window.audioEngine.playInvalid();
          this.cameras.main.shake(100, 0.003);
        } else {
          this.moveCount++;
          this.cascadeDepth = 0;
          this.processMatches(matches);
        }
      }
    });

    this.selected = null;
  }

  spawnSwapTrail(bubble, from, to) {
    const trail = this.add.image(from.x, from.y, `bubble_${bubble.getData('colorIdx')}`);
    trail.setAlpha(0.4);
    trail.setScale(0.6);
    trail.setDepth(1);
    this.tweens.add({
      targets: trail, x: to.x, y: to.y, alpha: 0, scale: 0.2,
      duration: 200, ease: 'Quad.easeOut',
      onComplete: () => trail.destroy(),
    });
  }

  findAllMatches() {
    const matched = new Set();

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c <= GRID_COLS - MIN_MATCH; c++) {
        const color = this.grid[r][c]?.getData('colorIdx');
        if (color === undefined) continue;
        let run = [{ r, c }];
        for (let k = 1; c + k < GRID_COLS; k++) {
          if (this.grid[r][c + k]?.getData('colorIdx') === color) run.push({ r, c: c + k });
          else break;
        }
        if (run.length >= MIN_MATCH) run.forEach(p => matched.add(`${p.r},${p.c}`));
      }
    }

    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = 0; r <= GRID_ROWS - MIN_MATCH; r++) {
        const color = this.grid[r][c]?.getData('colorIdx');
        if (color === undefined) continue;
        let run = [{ r, c }];
        for (let k = 1; r + k < GRID_ROWS; k++) {
          if (this.grid[r + k]?.[c]?.getData('colorIdx') === color) run.push({ r: r + k, c });
          else break;
        }
        if (run.length >= MIN_MATCH) run.forEach(p => matched.add(`${p.r},${p.c}`));
      }
    }

    // Group connected matches
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
        group.push(this.grid[p.r][p.c]);
        const color = this.grid[p.r][p.c]?.getData('colorIdx');
        [{ r: p.r - 1, c: p.c }, { r: p.r + 1, c: p.c }, { r: p.r, c: p.c - 1 }, { r: p.r, c: p.c + 1 }]
          .forEach(n => {
            const nk = `${n.r},${n.c}`;
            if (matched.has(nk) && !visited.has(nk) && this.grid[n.r]?.[n.c]?.getData('colorIdx') === color) {
              stack.push(n);
            }
          });
      }
      if (group.length > 0) groups.push(group);
    });

    return groups;
  }

  // -----------------------------------------------------------
  // MATCH PROCESSING — Power-ups, pop, score, drop, refill
  // -----------------------------------------------------------
  processMatches(matchGroups) {
    if (this.gameOver) return;
    this.streak++;
    if (this.streak > this.bestStreak) this.bestStreak = this.streak;
    this.updateStreakProgress(this.streak);

    let totalPopped = 0;
    let popIdx = 0;
    const powerUpsToActivate = [];
    const powerUpsToCreate = [];

    matchGroups.forEach(group => {
      // Check for power-up creation from this match
      const powerUpType = PowerUpSystem.analyze(group, this.grid);

      // Check if any matched bubble IS a power-up (activate it)
      group.forEach(bubble => {
        const existingPower = bubble.getData('powerUp');
        if (existingPower && existingPower !== POWERUP_TYPES.NONE) {
          powerUpsToActivate.push({
            type: existingPower,
            row: bubble.getData('row'),
            col: bubble.getData('col'),
            colorIdx: bubble.getData('colorIdx'),
          });
        }
      });

      // Create new power-up at the center of the match
      if (powerUpType !== POWERUP_TYPES.NONE) {
        const centerBubble = group[Math.floor(group.length / 2)];
        powerUpsToCreate.push({
          type: powerUpType,
          row: centerBubble.getData('row'),
          col: centerBubble.getData('col'),
          colorIdx: centerBubble.getData('colorIdx'),
        });
      }

      totalPopped += group.length;
      group.forEach(bubble => {
        // Skip if this bubble will become a power-up
        const isNewPowerUp = powerUpsToCreate.find(
          p => p.row === bubble.getData('row') && p.col === bubble.getData('col')
        );
        if (!isNewPowerUp) {
          window.audioEngine.playPop(this.streak, popIdx);
          this.popBubble(bubble);
          popIdx++;
        }
      });
    });

    // Activate existing power-ups that were matched
    powerUpsToActivate.forEach(pu => {
      const cells = PowerUpSystem.getAffectedCells(
        pu.type, pu.row, pu.col, pu.colorIdx,
        this.grid, GRID_ROWS, GRID_COLS
      );
      cells.forEach(cell => {
        const b = this.grid[cell.r]?.[cell.c];
        if (b && b.active) {
          this.popBubble(b);
          totalPopped++;
        }
      });

      // Power-up activation effect
      this.spawnPowerUpEffect(pu.type, pu.row, pu.col);
    });

    // Transform center bubbles into power-ups
    powerUpsToCreate.forEach(pu => {
      const bubble = this.grid[pu.row]?.[pu.col];
      if (bubble && bubble.active) {
        bubble.setData('powerUp', pu.type);
        // Flash effect
        this.tweens.add({
          targets: bubble, scale: 1.3, duration: 150,
          yoyo: true, ease: 'Back.easeOut',
        });
        // Show power-up name
        const pos = this.gridToWorld(pu.row, pu.col);
        const label = this.add.text(pos.x, pos.y - 30, POWERUP_NAMES[pu.type], {
          fontSize: '14px', fontFamily: UI_FONT,
          fontStyle: 'bold', color: '#ffd700', stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(25);
        this.tweens.add({
          targets: label, y: pos.y - 60, alpha: 0,
          duration: 800, ease: 'Quad.easeOut',
          onComplete: () => label.destroy(),
        });
      }
    });

    // Accumulate session pops for career stats
    this.totalPops += totalPopped;

    // Score + feedback + cascade
    const points = this.calculateMatchScore(totalPopped, powerUpsToActivate.length);
    const anchor = matchGroups[0]?.[0] ?? null;
    this.applyMatchFeedback(points, this.streak, anchor);
    this.feedFever(totalPopped, this.streak);
    this.startCascadeCycle();
  }

  // -----------------------------------------------------------
  // SCORING — Pure calculation, no side effects
  // -----------------------------------------------------------
  calculateMatchScore(totalPopped, powerUpsActivated) {
    const baseScore = totalPopped * 10;
    const streakMultiplier = Math.min(this.streak, 10);
    const sizeBonus = totalPopped > 4 ? (totalPopped - 4) * 15 : 0;
    const powerUpBonus = powerUpsActivated * 50;
    const feverBonus = this.feverActive ? 2 : 1;
    const points = (baseScore + sizeBonus + powerUpBonus) * streakMultiplier * feverBonus;
    this.score += points;
    this.scoreText.setText(`SCORE: ${this.score.toLocaleString()}`);
    return points;
  }

  // -----------------------------------------------------------
  // MATCH FEEDBACK — Sound, shake, flash, popup, hype bar
  // -----------------------------------------------------------
  applyMatchFeedback(points, streak, anchorBubble) {
    if (anchorBubble) {
      const label = this.feverActive ? `+${points} 🔥` : `+${points}`;
      this.showScorePopup(anchorBubble.x, anchorBubble.y, label, streak);
    }

    window.audioEngine.playStreakHit(streak);
    const shakeIntensity = Math.min(0.003 + streak * 0.002, 0.02);
    this.cameras.main.shake(120 + streak * 20, shakeIntensity);

    if (streak >= 8) {
      this.screenFlash(streak >= 12 ? 0x9b59b6 : 0xe74c3c);
    }

    this.updateStreakUI();
    this.triggerHypeBar();
  }

  // -----------------------------------------------------------
  // CASCADE CYCLE — Drop → refill → re-check (recursive)
  // -----------------------------------------------------------
  startCascadeCycle() {
    this.time.delayedCall(300, () => {
      if (this.gameOver) return;
      this.dropBubbles();
      this.time.delayedCall(350, () => {
        if (this.gameOver) return;
        this.refillGrid();
        this.time.delayedCall(400, () => {
          if (this.gameOver) return;
          const newMatches = this.findAllMatches();
          if (newMatches.length > 0) {
            this.cascadeDepth++;
            if (this.cascadeDepth > this.bestChain) this.bestChain = this.cascadeDepth;
            if (this.cascadeDepth >= 2) this.showChainAnnouncement(this.cascadeDepth);
            this.processMatches(newMatches);
          } else {
            if (!this.hasPossibleMoves()) this.reshuffleGrid();
            this.isProcessing = false;
          }
        });
      });
    });
  }

  spawnPowerUpEffect(type, row, col) {
    const pos = this.gridToWorld(row, col);
    const { width } = this.scale;

    if (type === POWERUP_TYPES.LINE_H || type === POWERUP_TYPES.LINE_V) {
      // Line flash
      const line = this.add.graphics();
      line.setDepth(15);
      if (type === POWERUP_TYPES.LINE_H) {
        line.fillStyle(0xffffff, 0.6);
        line.fillRect(0, pos.y - 3, width, 6);
      } else {
        line.fillStyle(0xffffff, 0.6);
        line.fillRect(pos.x - 3, GRID_OFFSET_Y, 6, GRID_ROWS * (BUBBLE_SIZE + BUBBLE_PAD));
      }
      this.tweens.add({
        targets: line, alpha: 0, duration: 400,
        onComplete: () => line.destroy(),
      });
    } else if (type === POWERUP_TYPES.BOMB) {
      // Shockwave ring
      const ring = this.add.graphics();
      ring.setDepth(15);
      ring.lineStyle(4, 0xff4444, 1);
      ring.strokeCircle(pos.x, pos.y, 10);
      this.tweens.add({
        targets: ring, scale: 4, alpha: 0, duration: 400,
        onComplete: () => ring.destroy(),
      });
      this.cameras.main.shake(200, 0.015);
    } else if (type === POWERUP_TYPES.NUKE) {
      // Full screen color flash
      this.screenFlash(0xffd700);
      this.cameras.main.shake(300, 0.02);
    }
  }

  /**
   * Show an escalating chain reaction announcement at screen center.
   * Triggered when cascade depth ≥ 2 (gravity-driven automatic matches).
   * @param {number} depth — Cascade depth (2 = double, 3 = triple, etc.)
   */
  showChainAnnouncement(depth) {
    const { width, height } = this.scale;
    const CHAIN_LEVELS = [
      { min: 2, label: 'DOUBLE',  color: '#3498db', size: 26 },
      { min: 3, label: 'TRIPLE',  color: '#2ecc71', size: 32 },
      { min: 4, label: 'MEGA',    color: '#f1c40f', size: 38 },
      { min: 5, label: 'ULTRA',   color: '#e74c3c', size: 44 },
      { min: 7, label: 'GODLIKE', color: '#9b59b6', size: 50 },
    ];
    let level = null;
    for (let i = CHAIN_LEVELS.length - 1; i >= 0; i--) {
      if (depth >= CHAIN_LEVELS[i].min) { level = CHAIN_LEVELS[i]; break; }
    }
    if (!level) return;

    const label = this.add.text(width / 2, height * 0.38, `${level.label} CHAIN!`, {
      fontSize: `${level.size}px`, fontFamily: UI_FONT,
      fontStyle: 'bold', color: level.color,
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(30).setAlpha(0).setScale(0.3);

    // Subtext showing chain depth
    const sub = this.add.text(width / 2, height * 0.38 + level.size * 0.7, `${depth}x cascade`, {
      fontSize: '13px', fontFamily: UI_FONT,
      color: level.color, fontStyle: 'italic',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(30).setAlpha(0);

    // Entrance: spring scale-up
    this.tweens.add({
      targets: label, alpha: 1, scale: 1.1,
      duration: 250, ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: sub, alpha: 0.8, duration: 200, delay: 100,
    });

    // Exit: float up and fade
    this.tweens.add({
      targets: [label, sub], y: '-=50', alpha: 0,
      duration: 600, ease: 'Quad.easeIn', delay: 700,
      onComplete: () => { label.destroy(); sub.destroy(); },
    });

    // Screen flash for high chains
    if (depth >= 4) {
      this.screenFlash(Phaser.Display.Color.HexStringToColor(level.color).color);
    }
    // Extra particles burst for mega chains
    if (depth >= 3) {
      const clr = Phaser.Display.Color.HexStringToColor(level.color).color;
      for (let i = 0; i < depth * 3; i++) {
        const p = this.add.image(width / 2, height * 0.38, 'star');
        p.setTint(clr).setScale(0.4).setDepth(29).setAlpha(0.9);
        const angle = (Math.PI * 2 / (depth * 3)) * i;
        const dist = 60 + depth * 15;
        this.tweens.add({
          targets: p,
          x: width / 2 + Math.cos(angle) * dist,
          y: height * 0.38 + Math.sin(angle) * dist,
          alpha: 0, scale: 0, duration: 500, delay: 100,
          ease: 'Quad.easeOut',
          onComplete: () => p.destroy(),
        });
      }
    }
  }

  screenFlash(color) {
    const { width, height } = this.scale;
    const flash = this.add.graphics();
    flash.setDepth(50);
    flash.fillStyle(color, 0.3);
    flash.fillRect(0, 0, width, height);
    this.tweens.add({
      targets: flash, alpha: 0, duration: 300,
      onComplete: () => flash.destroy(),
    });
  }

  popBubble(bubble) {
    if (!bubble || !bubble.active) return;
    const row = bubble.getData('row');
    const col = bubble.getData('col');
    const colorIdx = bubble.getData('colorIdx');

    this.spawnPopParticles(bubble.x, bubble.y, COLORS[colorIdx]);

    this.tweens.add({
      targets: bubble, scale: 1.4, alpha: 0, duration: 200,
      ease: 'Back.easeIn',
      onComplete: () => bubble.destroy(),
    });

    if (this.grid[row] && this.grid[row][col] === bubble) {
      this.grid[row][col] = null;
    }
  }

  spawnPopParticles(x, y, color) {
    const count = 6 + this.streak * 2;
    for (let i = 0; i < Math.min(count, 24); i++) {
      const p = this.add.image(x, y, this.streak >= 8 ? 'star' : 'particle');
      p.setTint(color);
      p.setScale(Phaser.Math.FloatBetween(0.3, 0.8));
      p.setDepth(10);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.FloatBetween(60, 150 + this.streak * 15);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0, scale: 0,
        duration: Phaser.Math.Between(300, 600),
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  showScorePopup(x, y, text, streak) {
    const level = getStreakTier(streak);
    const color = level ? level.color : '#ffffff';
    const size = level ? Math.min(level.size, 40) : 22;

    const popup = this.add.text(x, y, text, {
      fontSize: `${size}px`, fontFamily: UI_FONT,
      fontStyle: 'bold', color, stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(20);

    this.tweens.add({
      targets: popup, y: y - 60, alpha: 0, scale: 1.3,
      duration: 800, ease: 'Quad.easeOut',
      onComplete: () => popup.destroy(),
    });
  }

  dropBubbles() {
    for (let col = 0; col < GRID_COLS; col++) {
      let emptyRow = GRID_ROWS - 1;
      for (let row = GRID_ROWS - 1; row >= 0; row--) {
        if (this.grid[row][col] !== null) {
          if (row !== emptyRow) {
            const bubble = this.grid[row][col];
            this.grid[emptyRow][col] = bubble;
            this.grid[row][col] = null;
            bubble.setData('row', emptyRow);
            bubble.setData('col', col);
            const pos = this.gridToWorld(emptyRow, col);
            const dropDist = emptyRow - row;
            this.tweens.add({
              targets: bubble, y: pos.y,
              duration: 200 + dropDist * 30, ease: 'Bounce.easeOut',
              onComplete: () => window.audioEngine.playLand(dropDist * 0.02),
            });
          }
          emptyRow--;
        }
      }
    }
  }

  refillGrid() {
    for (let col = 0; col < GRID_COLS; col++) {
      for (let row = GRID_ROWS - 1; row >= 0; row--) {
        if (this.grid[row][col] === null) {
          this.spawnBubble(row, col, true);
        }
      }
    }
  }

  // -----------------------------------------------------------
  // HYPE BAR — Characters + streak reactions
  // -----------------------------------------------------------
  triggerHypeBar() {
    const level = getStreakTier(this.streak);
    if (!level) {
      this.streakText.setAlpha(0);
      this.adlibText.setAlpha(0);
      this.charNameText.setAlpha(0);
      return;
    }

    const { width } = this.scale;

    // Streak label
    this.streakText.setText(`${this.streak}x STREAK — ${level.label}`);
    this.streakText.setFontSize(level.size + 'px');
    this.streakText.setColor(level.color);
    this.streakText.setAlpha(1);
    this.streakText.setScale(0.5);
    this.tweens.add({
      targets: this.streakText, scale: 1, duration: 300, ease: 'Back.easeOut',
    });

    // Ad-lib
    const tier = Math.max(...Object.keys(ADLIBS).map(Number).filter(k => this.streak >= k));
    const lines = ADLIBS[tier] || ADLIBS[3];
    const adlib = lines[Phaser.Math.Between(0, lines.length - 1)];
    this.adlibText.setText(adlib);
    this.adlibText.setColor(level.color);
    this.adlibText.setAlpha(0);
    this.tweens.add({ targets: this.adlibText, alpha: 1, duration: 200, delay: 150 });

    // Character from characters.js
    this.characterGfx.clear();
    this.characterGfx.setAlpha(0);

    if (window.characters && window.characters[level.char]) {
      const char = window.characters[level.char];
      char.draw(this.characterGfx, width - 60, 10, 0.8);
      this.tweens.add({
        targets: this.characterGfx, alpha: 1, duration: 300, ease: 'Back.easeOut',
      });

      // Character name
      this.charNameText.setText(`${char.name}`);
      this.charNameText.setColor(level.color);
      this.charNameText.setAlpha(0);
      this.tweens.add({ targets: this.charNameText, alpha: 1, duration: 200, delay: 200 });
    } else {
      // Fallback placeholder
      const charColor = Phaser.Display.Color.HexStringToColor(level.color).color;
      this.characterGfx.setPosition(width - 80, 20);
      this.characterGfx.fillStyle(charColor, 0.8);
      this.characterGfx.fillCircle(30, 25, 18);
      this.characterGfx.fillRoundedRect(15, 45, 30, 35, 6);
      this.tweens.add({
        targets: this.characterGfx, alpha: 1, duration: 300, ease: 'Back.easeOut',
      });
    }

    // Fade out
    this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets: [this.characterGfx, this.adlibText, this.charNameText],
        alpha: 0, duration: 400,
      });
    });

    if (this.streak >= 5) this.flashHypeBar(level.color);
    if (this.streak >= 8) this.spawnStreakParticles(level.color);
  }

  flashHypeBar(colorStr) {
    const { width } = this.scale;
    const flash = this.add.graphics();
    const color = Phaser.Display.Color.HexStringToColor(colorStr).color;
    flash.lineStyle(3, color, 0.8);
    flash.strokeRoundedRect(10, 8, width - 20, HYPE_BAR_HEIGHT - 16, 12);
    flash.setDepth(5);
    this.hypeBar.add(flash);
    this.tweens.add({
      targets: flash, alpha: 0, duration: 600,
      onComplete: () => flash.destroy(),
    });
  }

  spawnStreakParticles(colorStr) {
    const { width } = this.scale;
    const color = Phaser.Display.Color.HexStringToColor(colorStr).color;
    for (let i = 0; i < 15; i++) {
      const p = this.add.image(
        Phaser.Math.Between(20, width - 20),
        Phaser.Math.Between(10, HYPE_BAR_HEIGHT), 'star'
      );
      p.setTint(color);
      p.setScale(Phaser.Math.FloatBetween(0.2, 0.6));
      p.setDepth(6);
      p.setAlpha(0);
      this.tweens.add({
        targets: p, alpha: 1, y: p.y - 40, scale: 0,
        duration: Phaser.Math.Between(500, 1000), delay: i * 50,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  updateStreakUI() {
    if (this.streak > 1) {
      this.streakCounter.setText(`STREAK: ${this.streak}x`);
      const level = getStreakTier(this.streak);
      this.streakCounter.setColor(level ? level.color : '#888888');
    } else {
      this.streakCounter.setText('');
    }
    if (this.bestStreak > 2) {
      this.bestStreakText.setText(`BEST: ${this.bestStreak}x`);
    }
  }

  // -----------------------------------------------------------
  // POSSIBLE MOVES + RESHUFFLE
  // -----------------------------------------------------------
  hasPossibleMoves() {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (c + 1 < GRID_COLS) {
          this.swapGridData(r, c, r, c + 1);
          if (this.findAllMatches().length > 0) { this.swapGridData(r, c, r, c + 1); return true; }
          this.swapGridData(r, c, r, c + 1);
        }
        if (r + 1 < GRID_ROWS) {
          this.swapGridData(r, c, r + 1, c);
          if (this.findAllMatches().length > 0) { this.swapGridData(r, c, r + 1, c); return true; }
          this.swapGridData(r, c, r + 1, c);
        }
      }
    }
    return false;
  }

  swapGridData(r1, c1, r2, c2) {
    const a = this.grid[r1][c1];
    const b = this.grid[r2][c2];
    this.grid[r1][c1] = b;
    this.grid[r2][c2] = a;
    if (a) { a.setData('row', r2); a.setData('col', c2); }
    if (b) { b.setData('row', r1); b.setData('col', c1); }
  }

  reshuffleGrid() {
    const colors = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.grid[r][c]) colors.push(this.grid[r][c].getData('colorIdx'));
      }
    }

    Phaser.Utils.Array.Shuffle(colors);

    let idx = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.grid[r][c]) {
          const newColor = colors[idx++];
          this.grid[r][c].setData('colorIdx', newColor);
          this.grid[r][c].setTexture(`bubble_${newColor}`);
          this.grid[r][c].setData('powerUp', POWERUP_TYPES.NONE);
        }
      }
    }

    this.resolveInitialMatches();
    window.audioEngine.playShuffle();

    const { width, height } = this.scale;
    const shuffleText = this.add.text(width / 2, height / 2, 'SHUFFLE!', {
      fontSize: '36px', fontFamily: UI_FONT,
      fontStyle: 'bold', color: '#f1c40f', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(30);

    this.tweens.add({
      targets: shuffleText, scale: 1.5, alpha: 0,
      duration: 800, ease: 'Quad.easeOut',
      onComplete: () => shuffleText.destroy(),
    });
  }

  // -----------------------------------------------------------
  // AMBIENT PARTICLES
  // -----------------------------------------------------------
  spawnAmbientParticles() {
    const { width, height } = this.scale;
    this.time.addEvent({
      delay: 2000, loop: true,
      callback: () => {
        const p = this.add.image(Phaser.Math.Between(0, width), height + 10, 'particle');
        p.setTint(COLORS[Phaser.Math.Between(0, COLORS.length - 1)]);
        p.setAlpha(0.15);
        p.setScale(Phaser.Math.FloatBetween(0.3, 0.8));
        p.setDepth(-1);
        this.tweens.add({
          targets: p, y: -10, x: p.x + Phaser.Math.Between(-40, 40),
          duration: Phaser.Math.Between(6000, 10000), ease: 'Sine.easeInOut',
          onComplete: () => p.destroy(),
        });
      }
    });
  }
}

// =============================================================
// GAME CONFIG
// =============================================================
const gameWidth = GRID_COLS * (BUBBLE_SIZE + BUBBLE_PAD) + GRID_OFFSET_X * 2;
const gameHeight = GRID_OFFSET_Y + GRID_ROWS * (BUBBLE_SIZE + BUBBLE_PAD) + 80;

const config = {
  type: Phaser.AUTO,
  width: gameWidth,
  height: gameHeight,
  parent: 'game-container',
  backgroundColor: '#0a0a1a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TitleScene, TutorialScene, TipsScene, StatsScene, ScanScene, AchievementsScene, GameScene, GameOverScene, HallOfFameScene],
};

const game = new Phaser.Game(config);
