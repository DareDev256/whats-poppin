// What's Poppin — Bubble Pop Game
// Cultural sauce meets addictive gameplay

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
// CAREER STATS — Cross-session stat tracking with SafeStorage
// =============================================================
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
  return scene.add.text(width / 2, y, text, {
    fontSize: '28px', fontFamily: UI_FONT,
    fontStyle: 'bold', color, stroke: '#000000', strokeThickness: 4,
  }).setOrigin(0.5);
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
  const label = scene.add.text(x + textOffset, y - (subtext ? 8 : 0), text, {
    fontSize: subtext ? '20px' : '16px', fontFamily: UI_FONT,
    fontStyle: 'bold', color: defaultBorder ? '#ffffff' : color,
  }).setOrigin(0.5);
  if (container) container.add(label);

  if (subtext) {
    const sub = scene.add.text(x + textOffset, y + 14, subtext, {
      fontSize: '11px', fontFamily: UI_FONT, color: '#555555',
    }).setOrigin(0.5);
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
    const title = this.add.text(width / 2, height * 0.18, 'WHAT\'S', {
      fontSize: '40px',
      fontFamily: UI_FONT,
      fontStyle: 'bold',
      color: '#f1c40f',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    const subtitle = this.add.text(width / 2, height * 0.27, 'POPPIN', {
      fontSize: '64px',
      fontFamily: UI_FONT,
      fontStyle: 'bold',
      color: '#e74c3c',
      stroke: '#000000',
      strokeThickness: 7,
    }).setOrigin(0.5);

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
    this.add.text(width / 2, height * 0.36, 'match  /  combo  /  dominate', {
      fontSize: '14px',
      fontFamily: UI_FONT,
      color: '#666666',
      letterSpacing: 2,
    }).setOrigin(0.5);

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

    // First-time tutorial check
    if (!SafeStorage.get('whatspoppin_played', null)) {
      const tutY = career.gamesPlayed > 0 ? btnY + 320 : btnY + 240;
      createButton(this, { x: width / 2, y: tutY, width: btnWidth, height: btnHeight, radius: 12,
        text: 'TUTORIAL', subtext: 'Learn the basics step by step',
        callback: () => this.scene.start('TutorialScene'),
      });
    }

    // High score display
    const highScore = SafeStorage.getInt('whatspoppin_highscore', 0);
    if (highScore > 0) {
      Icons.star(this, width / 2 - 100, height * 0.85, 14, 0xf1c40f);
      this.add.text(width / 2, height * 0.85, `HIGH SCORE: ${highScore.toLocaleString()}`, {
        fontSize: '18px',
        fontFamily: UI_FONT,
        fontStyle: 'bold',
        color: '#f1c40f',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);
    }

    // Sound toggle (top-right corner)
    this._buildSoundToggle(width);

    // Credits
    this.add.text(width / 2, height * 0.93, 'by DareDev256', {
      fontSize: '12px',
      fontFamily: UI_FONT,
      color: '#444444',
    }).setOrigin(0.5);

    // Init audio on first interaction
    this.input.once('pointerdown', () => {
      window.audioEngine.init();
      window.audioEngine.resume();
      // Restore saved mute preference
      const wasMuted = SafeStorage.get('whatspoppin_muted', '0') === '1';
      window.audioEngine.setMuted(wasMuted);
    });
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
      window.audioEngine.init();
      window.audioEngine.resume();
      const nowMuted = window.audioEngine.toggleMute();
      SafeStorage.set('whatspoppin_muted', nowMuted ? '1' : '0');

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
    const { score, bestStreak, moves, isNewHigh, mode } = data;
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
    this.add.text(width / 2, cardY + 30, 'FINAL SCORE', {
      fontSize: '14px', fontFamily: UI_FONT,
      color: '#888888',
    }).setOrigin(0.5);

    const scoreText = this.add.text(width / 2, cardY + 65, '0', {
      fontSize: '48px', fontFamily: UI_FONT,
      fontStyle: 'bold', color: '#f1c40f', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

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
      const badge = this.add.text(width / 2, cardY + 100, 'NEW HIGH SCORE', {
        fontSize: '18px', fontFamily: UI_FONT,
        fontStyle: 'bold', color: '#f1c40f',
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({
        targets: badge, alpha: 1, duration: 300, delay: 1800,
      });
      this.tweens.add({
        targets: badge, scale: 1.05, duration: 800, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: 2000,
      });
    }

    // Stats
    const statsY = cardY + 140;
    this.add.text(width * 0.25, statsY, `MOVES\n${moves}`, {
      fontSize: '14px', fontFamily: UI_FONT,
      color: '#aaaaaa', align: 'center',
    }).setOrigin(0.5);

    this.add.text(width * 0.5, statsY, `BEST STREAK\n${bestStreak}x`, {
      fontSize: '14px', fontFamily: UI_FONT,
      color: '#aaaaaa', align: 'center',
    }).setOrigin(0.5);

    const avgPerMove = moves > 0 ? Math.round(score / moves) : 0;
    this.add.text(width * 0.75, statsY, `AVG/MOVE\n${avgPerMove}`, {
      fontSize: '14px', fontFamily: UI_FONT,
      color: '#aaaaaa', align: 'center',
    }).setOrigin(0.5);

    // Streak tier achieved
    const tierLevel = STREAK_LEVELS.filter(l => bestStreak >= l.min).pop();
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
    const btnY1 = height * 0.80;
    const btnW = width - 80;
    createButton(this, { x: width / 2, y: btnY1, width: btnW, height: 42,
      text: 'PLAY AGAIN', color: '#2ecc71',
      iconFn: (s, bx, by) => Icons.play(s, bx, by, 14, 0x2ecc71),
      callback: () => this.scene.start('GameScene', { mode: this._mode }),
    });
    createButton(this, { x: width / 2, y: btnY1 + 55, width: btnW, height: 42,
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
    ];

    statCells.forEach((cell, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = cardX + col * (cellW + 8);
      const cy = gridY + row * (cellH + 8);

      drawCard(bg, { x: cx, y: cy, w: cellW, h: cellH,
        borderColor: Phaser.Display.Color.HexStringToColor(cell.color).color });

      this.add.text(cx + cellW / 2, cy + 18, cell.label, {
        fontSize: '10px', fontFamily: UI_FONT,
        fontStyle: 'bold', color: '#666666', align: 'center',
      }).setOrigin(0.5);

      this.add.text(cx + cellW / 2, cy + 48, cell.value, {
        fontSize: '28px', fontFamily: UI_FONT,
        fontStyle: 'bold', color: cell.color,
      }).setOrigin(0.5);
    });

    // — Lifetime totals bar —
    const barY = gridY + 2 * (cellH + 8) + 8;
    drawCard(bg, { x: cardX, y: barY, w: cardW, h: 52, borderColor: 0x2ecc71 });

    this.add.text(width / 2, barY + 14, 'LIFETIME SCORE', {
      fontSize: '10px', fontFamily: UI_FONT,
      fontStyle: 'bold', color: '#666666',
    }).setOrigin(0.5);

    this.add.text(width / 2, barY + 36, stats.totalScore.toLocaleString(), {
      fontSize: '22px', fontFamily: UI_FONT,
      fontStyle: 'bold', color: '#2ecc71',
    }).setOrigin(0.5);

    // — Averages section —
    const avgY = barY + 68;
    drawCard(bg, { x: cardX, y: avgY, w: cardW, h: 58 });

    this.add.text(width / 2, avgY + 12, 'AVERAGES', {
      fontSize: '10px', fontFamily: UI_FONT,
      fontStyle: 'bold', color: '#555555',
    }).setOrigin(0.5);

    const avgScore = stats.gamesPlayed > 0 ? Math.round(stats.totalScore / stats.gamesPlayed) : 0;
    const avgPops = stats.gamesPlayed > 0 ? Math.round(stats.totalPops / stats.gamesPlayed) : 0;

    this.add.text(width * 0.3, avgY + 38, `${avgScore.toLocaleString()}\nper game`, {
      fontSize: '14px', fontFamily: UI_FONT,
      color: '#aaaaaa', align: 'center',
    }).setOrigin(0.5);

    this.add.text(width * 0.7, avgY + 38, `${avgPops.toLocaleString()}\npops/game`, {
      fontSize: '14px', fontFamily: UI_FONT,
      color: '#aaaaaa', align: 'center',
    }).setOrigin(0.5);

    // — Streak tier unlocked —
    const tierY = avgY + 75;
    const tierLevel = STREAK_LEVELS.filter(l => stats.bestStreak >= l.min).pop();
    if (tierLevel && window.characters) {
      const char = window.characters[tierLevel.char];
      if (char) {
        drawCard(bg, { x: cardX, y: tierY, w: cardW, h: 80,
          borderColor: Phaser.Display.Color.HexStringToColor(tierLevel.color).color });

        this.add.text(cardX + 12, tierY + 10, 'HIGHEST TIER', {
          fontSize: '10px', fontFamily: UI_FONT,
          fontStyle: 'bold', color: '#555555',
        });

        this.add.text(cardX + 12, tierY + 30, `${tierLevel.label}`, {
          fontSize: '22px', fontFamily: UI_FONT,
          fontStyle: 'bold', color: tierLevel.color,
        });

        this.add.text(cardX + 12, tierY + 58, `${char.name} — ${char.title}`, {
          fontSize: '12px', fontFamily: UI_FONT,
          fontStyle: 'italic', color: tierLevel.color,
        });

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
    const currentTier = STREAK_LEVELS.filter(l => stats.bestStreak >= l.min).pop() || null;

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
  }

  create() {
    const { width, height } = this.scale;

    // Audio
    this.audioStarted = false;
    this.input.on('pointerdown', () => {
      if (!this.audioStarted) {
        window.audioEngine.init();
        window.audioEngine.resume();
        // Restore mute preference before starting beat
        const wasMuted = SafeStorage.get('whatspoppin_muted', '0') === '1';
        window.audioEngine.setMuted(wasMuted);
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
        const nowMuted = window.audioEngine.toggleMute();
        SafeStorage.set('whatspoppin_muted', nowMuted ? '1' : '0');
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
          CareerStats.record({ score: this.score, pops: this.totalPops, bestStreak: this.bestStreak });
          const highScore = SafeStorage.getInt('whatspoppin_highscore', 0);
          if (this.score > highScore) {
            SafeStorage.set('whatspoppin_highscore', Math.max(0, Math.floor(this.score)).toString());
          }
        }
        window.audioEngine.stopBgBeat();
        this.scene.start('TitleScene');
      },
    });
  }

  resumeGame() {
    this.isPaused = false;
    if (this.timerEvent) this.timerEvent.paused = false;
    this.tweens.resumeAll();
    if (this.pauseContainer) {
      this.pauseContainer.destroy(true);
      this.pauseContainer = null;
    }
  }

  cleanupPause() {
    this.isPaused = false;
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

    // Cancel timer to prevent further ticks after game ends
    if (this.timerEvent) {
      this.timerEvent.remove(false);
      this.timerEvent = null;
    }

    window.audioEngine.stopBgBeat();

    // Play final sound
    window.audioEngine.playStreakHit(12);

    const highScore = SafeStorage.getInt('whatspoppin_highscore', 0);
    const isNewHigh = this.score > highScore;
    if (isNewHigh) {
      SafeStorage.set('whatspoppin_highscore', Math.max(0, Math.floor(this.score)).toString());
    }

    // Record career stats
    const { stats: career, newRecords } = CareerStats.record({
      score: this.score,
      pops: this.totalPops,
      bestStreak: this.bestStreak,
    });

    // Transition
    this.time.delayedCall(1000, () => {
      this.scene.start('GameOverScene', {
        score: this.score,
        bestStreak: this.bestStreak,
        moves: this.moveCount,
        isNewHigh,
        career,
        newRecords,
        mode: this.gameMode,
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

        // Check if swapped bubbles have power-ups that should activate
        const aPower = a.getData('powerUp');
        const bPower = b.getData('powerUp');

        if (matches.length === 0 && aPower === POWERUP_TYPES.NONE && bPower === POWERUP_TYPES.NONE) {
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
    const points = (baseScore + sizeBonus + powerUpBonus) * streakMultiplier;
    this.score += points;
    this.scoreText.setText(`SCORE: ${this.score.toLocaleString()}`);
    return points;
  }

  // -----------------------------------------------------------
  // MATCH FEEDBACK — Sound, shake, flash, popup, hype bar
  // -----------------------------------------------------------
  applyMatchFeedback(points, streak, anchorBubble) {
    if (anchorBubble) {
      this.showScorePopup(anchorBubble.x, anchorBubble.y, `+${points}`, streak);
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
    const level = STREAK_LEVELS.filter(l => streak >= l.min).pop();
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
    const level = STREAK_LEVELS.filter(l => this.streak >= l.min).pop();
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
      const level = STREAK_LEVELS.filter(l => this.streak >= l.min).pop();
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
  scene: [BootScene, TitleScene, TutorialScene, TipsScene, StatsScene, ScanScene, GameScene, GameOverScene],
};

const game = new Phaser.Game(config);
