import { Application, Assets, Container, Graphics, Sprite, Text, TextStyle, Ticker } from 'pixi.js';

export interface PegPosition {
  row: number;
  col: number;
  x: number;
  y: number;
}

export interface PegInstance extends PegPosition {
  id: string;
  radius: number;
  container: Container;
  sprite: Sprite;
  /** Soft sun glint on the peg head. */
  sunlight: Container;
  /** Ms remaining for golden hold + fade-back. */
  goldenMs: number;
}

export interface BinInstance {
  index: number;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
  container: Container;
  sprite: Sprite;
  label: Text;
}

export interface PathWaypoint {
  x: number;
  y: number;
  peg?: PegInstance;
  /** Which way the ball deflects after hitting this peg. */
  goRight?: boolean;
}

export interface BallInstance {
  sprite: Sprite;
  radius: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  /** Radians per frame-step — spins with each peg bounce. */
  angularVelocity: number;
  targetBinIndex: number;
  targetBinX: number;
  targetBinY: number;
  path: PathWaypoint[];
  pathIndex: number;
  settled: boolean;
  settleElapsedMs: number;
  /** Ms on current segment — boosts guide if the ball lingers too long. */
  stuckMs: number;
  /** Peg this ball currently has lit — cleared when it hits the next one. */
  activePeg: PegInstance | null;
  /** Locked at spawn — turbo only affects balls dropped after the toggle. */
  speedScale: number;
}

export interface FireParticle {
  gfx: Container;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifeMs: number;
  maxLifeMs: number;
  size: number;
  color: number;
  gravity: number;
  drag: number;
  /** Soft twinkle for fireworks */
  twinkle: boolean;
  /** Optional masked FX root (low-hit bubbles clipped to bin). */
  root?: Container;
}

export interface FireGlow {
  gfx: Container;
  lifeMs: number;
  maxLifeMs: number;
}

/** Rising soft orb that explodes into a ring blast at peak height. */
export interface FireworkRocket {
  gfx: Container;
  x: number;
  y: number;
  vy: number;
  /** Explode once y reaches this (canvas Y grows downward). */
  explodeY: number;
  lifeMs: number;
  palette: HighWinPalette;
}

export interface BinFlash {
  bin: BinInstance;
  lifeMs: number;
  tint: number;
}

/** Brief Y punch + squash when ball lands in a low multiplier. */
export interface BinBump {
  bin: BinInstance;
  lifeMs: number;
  maxLifeMs: number;
  baseY: number;
  amount: number;
}

/** Sustained orange fire that keeps emitting from mid multipliers. */
export interface BinFireEmitter {
  bin: BinInstance;
  lifeMs: number;
  emitAccMs: number;
}

export const BOARD_WIDTH = 812;
export const BOARD_HEIGHT = 556;
/** Extra canvas room so fireworks / fire aren't clipped at edges. */
export const BOARD_FX_PAD_X = 160;
export const BOARD_FX_PAD_Y = 180;

/**
 * Peg grid fills the wooden triangle:
 * 15 rows, 3 pegs on top → 17 pegs on the bottom (aligned with 17 bins).
 */
export const PEG_CONFIG = {
  rows: 15,
  startCount: 3,
  texturePath: '/assets/peglarge.png',
  /** Yellow-golden peg used while a ball is hitting this peg. */
  activeTexturePath: '/assets/peglarge-active.png',
  anchor: { x: 0.5, y: 0.72 },
  /** Width only — height stays separate so pegs don't get taller. */
  scaleX: 0.64,
  scaleY: 0.38,
  collisionRadius: 5.2,
  /** How far above peg center the ball should touch (higher = hits peg nearer the top). */
  hitOffsetY: 7,
  /** Default peg color — unchanged for all inactive pegs. */
  baseTint: 0xd4b896,
  shadow: {
    width: 8,
    height: 3.8,
    offsetY: 1.1,
    color: 0x9a7058,
    alpha: 0.28,
  },
  /** Soft sun glint on the peg head (upper-left, like reference). */
  sunlight: {
    offsetX: -2.4,
    offsetY: -6.8,
    softRx: 3.2,
    softRy: 2.2,
    softAlpha: 0.22,
    coreRx: 1.55,
    coreRy: 1.05,
    coreAlpha: 0.7,
    color: 0xfff6e0,
    /** Idle glint strength. */
    idleAlpha: 0.55,
    /** Stronger sun flash while peg is golden / ball-hit. */
    activeAlpha: 1,
    activeScale: 1.45,
  },
  /** Active peg — golden color with a soft light highlight. */
  hitGolden: {
    /** Keep white so active golden PNG shows as-is. */
    pegTintBright: 0xffffff,
    /** Safety timeout if this is the last peg (next hit clears earlier). */
    holdMs: 400,
  },
} as const;

/**
 * Play-field bounds — pegs cover the full inner wood area of tableBg.
 * Tuned to the ornate triangle frame (812×556 canvas).
 */
export const PEG_LAYOUT = {
  topY: 130,
  bottomY: 478,
  centerX: BOARD_WIDTH / 2,
  /** Half-width of bottom peg row — wider = less empty space on left/right. */
  bottomHalfWidth: 348,
} as const;

/** Bottom multiplier slots (screenshot order). */
export const MULTIPLIERS = [
  118, 61, 12, 4.5, 2.3, 1.2, 1, 0.7, 0.2, 0.7, 1, 1.2, 2.3, 4.5, 12, 61, 118,
] as const;

/** Unique multipliers for the top selector buttons (low → high). */
export const MULTIPLIER_BUTTONS = [0.2, 0.7, 1, 1.2, 2.3, 4.5, 12, 61, 118] as const;

/**
 * Multiplier strip sits on the bottom wood ledge of the triangle
 * (same band as the reference table), aligned with the peg columns.
 */
export const BIN_LAYOUT = {
  topY: 498,
  height: 57,
  leftX: PEG_LAYOUT.centerX - PEG_LAYOUT.bottomHalfWidth - 8,
  rightX: PEG_LAYOUT.centerX + PEG_LAYOUT.bottomHalfWidth + 8,
  gap: 1.5,
  texturePath: '/assets/betMultiplayar.png',
} as const;

export const BALL_CONFIG = {
  texturePath: '/assets/balllarge.png',
  scale: 0.48,
  radius: 5.4,
  /**
   * Fixed funnel mouth (board space) — every device / every ball.
   * Aligned to tableBg golden U opening (between rim bands ~boardY 40–78).
   */
  spawnX: PEG_LAYOUT.centerX,
  dropY: 73,
  /** Tiny horizontal wander only after leaving the chute (not at spawn). */
  exitJitter: 0.03,
  /** Faster fall toward pegs. */
  gravity: 0.125,
  maxFallSpeed: 2.0,
  /** Near a peg, cap fall speed so the hit feels gentle. */
  nearPegMaxSpeed: 1.35,
  nearPegSlowY: 14,
  /** Bounce arc — closer to full gravity so the pop stays short. */
  bounceGravityScale: 0.7,
  /** Extra downward pull when falling (approaching peg). */
  approachAccel: 0.022,
  /** Pull toward the next peg / bin on the path. */
  guideStrength: 0.085,
  /** Horizontal kick when leaving a peg (deflect feel). */
  pegDeflectMin: 0.22,
  pegDeflectMax: 0.38,
  /** Cap sideways drift so the ball stays on the peg route. */
  maxHorizontalSpeed: 0.8,
  /**
   * Upward bounce impulse ≈ 7px peak.
   * v ≈ sqrt(2 * gravity * bounceGravityScale * 7)
   */
  pegBounceMin: 1.05,
  pegBounceMax: 1.1,
  /** Horizontal only — vertical bounce stays full strength. */
  bounceSpeedScale: 0.65,
  /** Horizontal energy loss after each peg. */
  pegSpeedDamp: 0.52,
  /** How close the ball must be to register a peg touch (no teleport). */
  pegHitRadius: 9,
  /** Extra hit lenience on lower rows where balls move faster. */
  pegHitRadiusBoost: 6,
  /** Y band below peg center that still counts as a row crossing. */
  pegRowCatchUpY: 14,
  /** Drift into bin column — stronger so it lands in the chosen box. */
  binGuideStrength: 0.07,
  /** Last N peg rows gradually align toward the target bin column. */
  lateRowAlignRows: 3,
  airDrag: 0.991,
  /** Spin added per peg hit (radians / step), scaled by deflect side. */
  spinOnHit: 0.18,
  maxSpin: 0.35,
  spinDamping: 0.997,
  /** Extra hang time in the bin before despawn. */
  settleMs: 450,
} as const;

/** Ember / fire burst when a ball lands in a multiplier bin. */
export const FIRE_EFFECT = {
  particleCount: 22,
  /** Offset above bin center so sparks sit inside the triangle ledge. */
  offsetY: 14,
  lifeMinMs: 380,
  lifeMaxMs: 620,
  sizeMin: 1.3,
  sizeMax: 3.4,
  /** Per-step velocities (same step units as ball physics). */
  speedX: 0.85,
  speedYMin: 4.2,
  speedYMax: 6.8,
  /** Light pull so embers keep rising longer / feel smoother. */
  gravity: 0.028,
  drag: 0.985,
  /** Soft glow under the sparks */
  glowRadius: 24,
  glowAlpha: 0.42,
  glowLifeMs: 400,
  colors: [0xfff4c2, 0xffe066, 0xff9a1f, 0xff5a00, 0xff2a00] as const,
  glowColor: 0xff7a1a,
  /** Brief brighten of the landed bin. */
  binFlashMs: 300,
  binFlashTint: 0xffcc88,
} as const;

/**
 * Same fire burst as FIRE_EFFECT — teal/cyan or purple for high bins (118 / 61 / 12).
 */
export const CYAN_FIRE_EFFECT = {
  colors: [0xe8ffff, 0xb8fff8, 0x7fffd4, 0x5eead4, 0x2dd4bf] as const,
  glowColor: 0x5eead4,
  glowAlpha: 0.48,
  binFlashTint: 0xa8fff0,
} as const;

export const PURPLE_FIRE_EFFECT = {
  colors: [0xf2d4ff, 0xe0a6ff, 0xd070ff, 0xc44dff, 0xffffff] as const,
  glowColor: 0xc44dff,
  glowAlpha: 0.48,
  binFlashTint: 0xe8c0ff,
} as const;

export type HighWinPalette = 'cyan' | 'purple';

/** Soft orb rises from high multipliers, then ring-blasts (cyan or purple, random). */
export const FIREWORKS_EFFECT = {
  multipliers: [118, 61, 12, 4.5] as const,
  rockets: 1,
  launchGapMs: 0,
  /** Climb distance before ring blast. */
  riseMin: 320,
  riseMax: 420,
  /** Faster rise / blast */
  rocketSpeedMin: 9.5,
  rocketSpeedMax: 11.5,
  rocketGravity: 0.06,
  orbCoreRadius: 7,
  orbMidRadius: 14,
  orbOuterRadius: 26,
  /** Ring blast — denser circle spray */
  particlesPerBurst: 32,
  lifeMinMs: 420,
  lifeMaxMs: 680,
  sizeMin: 4,
  sizeMax: 9,
  blastMin: 4.8,
  blastMax: 7.2,
  upBias: 0.55,
  gravity: 0.04,
  drag: 0.975,
  glowRadius: 28,
  glowAlpha: 0.5,
  glowLifeMs: 300,
  palettes: {
    cyan: {
      orbCoreColor: 0xffffff,
      orbMidColor: 0xb8fff8,
      orbOuterColor: 0x2dd4bf,
      colors: [0xe8ffff, 0xb8fff8, 0x7fffd4, 0x5eead4, 0xffffff] as const,
    },
    purple: {
      orbCoreColor: 0xffffff,
      orbMidColor: 0xe8a0ff,
      orbOuterColor: 0xc44dff,
      colors: [0xf2d4ff, 0xe0a6ff, 0xd070ff, 0xc44dff, 0xffffff] as const,
    },
  },
} as const;

const FIREWORKS_MULTIPLIERS = new Set<number>(FIREWORKS_EFFECT.multipliers);

/**
 * Soft cream bubbles + bin dhamak for multipliers up to 1 (0.2 / 0.7 / 1).
 * Start inside the box, then drift out (especially upward).
 */
export const LOW_HIT_EFFECT = {
  multipliers: [0.2, 0.7, 1] as const,
  particleCount: 18,
  lifeMinMs: 480,
  lifeMaxMs: 720,
  sizeMin: 3.5,
  sizeMax: 9.5,
  speedX: 0.55,
  speedYMin: 1.1,
  speedYMax: 2.2,
  gravity: 0,
  drag: 0.972,
  colors: [0xfff6e0, 0xffefc8, 0xffe4a8, 0xfffaf0] as const,
  binFlashTint: 0xe8b0ff,
  /** How far the bin punches downward (px). */
  bumpY: 8,
  bumpMs: 340,
} as const;

const LOW_HIT_MULTIPLIERS = new Set<number>(LOW_HIT_EFFECT.multipliers);

/**
 * Continuous orange fire bubbles for mid multipliers (1.2 / 2.3).
 * Keeps emitting for ~2s, rising out of the top of the box.
 */
export const MID_FIRE_EFFECT = {
  multipliers: [1.2, 2.3] as const,
  durationMs: 2000,
  emitIntervalMs: 70,
  particlesPerEmit: 2,
  lifeMinMs: 560,
  lifeMaxMs: 920,
  sizeMin: 5,
  sizeMax: 12,
  /** Ball sprite scale relative to particle size. */
  ballScale: 0.028,
  speedX: 0.55,
  /** Higher rise for fire balls */
  speedYMin: 3.6,
  speedYMax: 6.4,
  gravity: 0.006,
  drag: 0.982,
  colors: [0xfff4c2, 0xffe066, 0xff9a1f, 0xff6a00, 0xff3d00] as const,
  binFlashTint: 0xffcc88,
} as const;

const MID_FIRE_MULTIPLIERS = new Set<number>(MID_FIRE_EFFECT.multipliers);

export const ASSETS = {
  pegLarge: PEG_CONFIG.texturePath,
  pegLargeActive: PEG_CONFIG.activeTexturePath,
  ballLarge: BALL_CONFIG.texturePath,
  binBox: BIN_LAYOUT.texturePath,
} as const;

export class BoardScene {
  private readonly pegLayer = new Container();
  private readonly binLayer = new Container();
  private readonly ballLayer = new Container();
  private readonly effectLayer = new Container();

  private pegs: PegInstance[] = [];
  private pegsByRow: PegInstance[][] = [];
  private bins: BinInstance[] = [];
  private balls: BallInstance[] = [];
  private fireParticles: FireParticle[] = [];
  private fireGlows: FireGlow[] = [];
  private binFlashes: BinFlash[] = [];
  private binBumps: BinBump[] = [];
  private binFireEmitters: BinFireEmitter[] = [];
  private fireworkRockets: FireworkRocket[] = [];
  private lowHitRootCounts = new Map<Container, number>();
  /** Recent path fingerprints so consecutive balls don't clone the same route. */
  private recentPathKeys: string[] = [];
  /** Fired once when a ball settles into a bin (multiplier value). */
  private onBallLanded: ((value: number) => void) | null = null;
  /** Fired when a ball contacts a peg (SFX / FX hooks). */
  private onPegHitSound: (() => void) | null = null;
  /** Play peg SFX after physics — HTMLAudio mid-hit aborts the tick on iOS. */
  private pegHitSoundPending = false;
  /** Land/history/Spine flush after the physics frame (iOS Chrome freezes mid-tick). */
  private pendingLandValues: number[] = [];
  private landFlushScheduled = false;
  /** Applied to newly spawned balls only (in-flight balls keep their own scale). */
  private nextBallSpeedScale = 2;
  /** Mobile / coarse pointer — keep FX light when many balls drop. */
  private readonly isMobile =
    typeof window !== 'undefined' &&
    (window.matchMedia('(pointer: coarse)').matches ||
      /iP(ad|hone|od)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  /** Hard cap live particles — unlimited Graphics freezes iPhone Chrome. */
  private readonly maxFireParticles = this.isMobile ? 36 : 80;
  /** Wall-clock spawn time per ball — force-finish stragglers on iOS. */
  private readonly ballBornAt = new WeakMap<object, number>();
  private readonly maxBallLifeMs = 7000;

  constructor(private readonly app: Application) {
    app.stage.addChild(this.pegLayer, this.binLayer, this.ballLayer, this.effectLayer);
  }

  setSpeedScale(scale: number): void {
    this.nextBallSpeedScale = Math.max(0.25, Math.min(5, scale));
  }

  setOnBallLanded(handler: ((value: number) => void) | null): void {
    this.onBallLanded = handler;
  }

  setOnPegHit(handler: (() => void) | null): void {
    this.onPegHitSound = handler;
  }

  async init(): Promise<void> {
    await Assets.load([
      { alias: 'pegLarge', src: ASSETS.pegLarge },
      { alias: 'pegLargeActive', src: ASSETS.pegLargeActive },
      { alias: 'ballLarge', src: ASSETS.ballLarge },
      { alias: 'binBox', src: ASSETS.binBox },
    ]);

    this.buildPegs();
    this.buildBins();
    this.app.ticker.add(this.onTick, this);
  }

  destroy(): void {
    this.app.ticker.remove(this.onTick, this);
    this.pendingLandValues = [];
    this.landFlushScheduled = false;
    this.clearBalls();
    this.clearFireEffects();
    this.pegs = [];
    this.pegsByRow = [];
    this.bins = [];
    // Leave layers on stage — Application.destroy handles them once.
    // Destroying Text labels here first hits a Pixi TexturePool bug on HMR.
  }

  getPegPositions(): readonly PegPosition[] {
    return this.pegs.map(({ row, col, x, y }) => ({ row, col, x, y }));
  }

  getPegs(): readonly PegInstance[] {
    return this.pegs;
  }

  getBins(): readonly BinInstance[] {
    return this.bins;
  }

  /**
   * Drop from the center funnel onto the first-row middle peg,
   * bounce down one peg per row, then land in the chosen bin.
   */
  dropToMultiplier(value: number): void {
    const matching = this.bins.filter((bin) => bin.value === value);
    if (matching.length === 0) {
      return;
    }

    const target = matching[Math.floor(Math.random() * matching.length)];
    this.spawnBall(target);
  }

  /** Drop a ball into a random multiplier bin. */
  dropRandom(): void {
    if (this.bins.length === 0) {
      return;
    }

    const target = this.bins[Math.floor(Math.random() * this.bins.length)];
    this.spawnBall(target);
  }

  private spawnBall(target: BinInstance): void {
    // Peg route may use neighbor (left 118 follows 61 path); landing stays on target.
    const landBin = target;
    const pathBin = this.pathBinFor(landBin);
    const texture = Assets.get('ballLarge');
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.scale.set(BALL_CONFIG.scale);

    const path = this.buildPathToBin(pathBin);
    const targetBinY = landBin.y + landBin.height * 0.22;
    // Locked funnel mouth — same on every device / every ball
    const spawnX = BALL_CONFIG.spawnX;
    const spawnY = BALL_CONFIG.dropY;

    sprite.x = spawnX;
    sprite.y = spawnY;
    this.ballLayer.addChild(sprite);

    const firstPeg = path[1];
    // Aim straight at first-row middle — tiny jitter only after chute exit.
    const towardFirst = firstPeg ? Math.sign(firstPeg.x - spawnX) * 0.14 : 0;

    const ball: BallInstance = {
      sprite,
      radius: BALL_CONFIG.radius,
      x: spawnX,
      y: spawnY,
      velocityX: towardFirst + (Math.random() - 0.5) * BALL_CONFIG.exitJitter,
      velocityY: 0.42 + Math.random() * 0.16,
      angularVelocity: (Math.random() - 0.5) * 0.05,
      targetBinIndex: landBin.index,
      targetBinX: landBin.x,
      targetBinY,
      path,
      pathIndex: 0,
      settled: false,
      settleElapsedMs: 0,
      stuckMs: 0,
      activePeg: null,
      speedScale: this.nextBallSpeedScale,
    };
    this.ballBornAt.set(ball, performance.now());
    this.balls.push(ball);
  }

  /** Middle peg of the top row (3 pegs → col 1). */
  private firstRowMiddleCol(): number {
    return Math.floor((PEG_CONFIG.startCount - 1) / 2);
  }

  /**
   * Peg route for a landing bin. Left 118 can't be reached from middle start,
   * so follow the neighboring 61 path and only drop into 118 at the bottom.
   */
  private pathBinFor(landBin: BinInstance): BinInstance {
    const middle = this.firstRowMiddleCol();
    const rows = this.pegsByRow.length;
    const rightsNeeded = landBin.index - middle;
    if (rightsNeeded >= 0 && rightsNeeded <= rows) {
      return landBin;
    }

    // Slot 0 (left 118) → same peg path as slot 1 (left 61).
    return this.bins[landBin.index + 1] ?? landBin;
  }

  /**
   * Always drop from board-center funnel onto first-row middle peg.
   * One peg per row: right → next col+1, left → same col. Last peg → target bin.
   * Left/right sequence after the first hit is shuffled so routes stay unique.
   */
  private buildPathToBin(target: BinInstance): PathWaypoint[] {
    const rows = this.pegsByRow.length;
    const targetSlot = target.index;
    const forceStartCol = this.firstRowMiddleCol();
    const { startCol, directions } = this.planUniquePegRoute(
      rows,
      targetSlot,
      forceStartCol,
    );
    const path: PathWaypoint[] = [{ x: BALL_CONFIG.spawnX, y: BALL_CONFIG.dropY }];

    let col = startCol;

    for (let row = 0; row < rows; row++) {
      const rowPegs = this.pegsByRow[row];
      if (!rowPegs.length) {
        continue;
      }

      const pegIndex = Math.min(rowPegs.length - 1, Math.max(0, col));
      const peg = rowPegs[pegIndex];
      const goRight = directions[row];

      path.push({
        x: peg.x,
        y: peg.y - BALL_CONFIG.radius - PEG_CONFIG.hitOffsetY,
        peg,
        goRight,
      });

      if (goRight) {
        col += 1;
      }
    }

    return path;
  }

  /** Pick a route that reaches the bin and isn't a recent duplicate. */
  private planUniquePegRoute(
    rows: number,
    targetSlot: number,
    forcedStartCol?: number,
  ): { startCol: number; directions: boolean[] } {
    const attempts = 12;
    let best = planPegRoute(rows, targetSlot, PEG_CONFIG.startCount, forcedStartCol);

    for (let i = 0; i < attempts; i++) {
      const candidate = planPegRoute(
        rows,
        targetSlot,
        PEG_CONFIG.startCount,
        forcedStartCol,
      );
      const key = pathFingerprint(candidate.startCol, candidate.directions);
      if (!this.recentPathKeys.includes(key)) {
        this.rememberPathKey(key);
        return candidate;
      }
      best = candidate;
    }

    this.rememberPathKey(pathFingerprint(best.startCol, best.directions));
    return best;
  }

  private rememberPathKey(key: string): void {
    this.recentPathKeys.push(key);
    if (this.recentPathKeys.length > 24) {
      this.recentPathKeys.shift();
    }
  }

  private finishBinDrop(ball: BallInstance): void {
    const dx = ball.targetBinX - ball.x;
    const dy = ball.targetBinY - ball.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 1.5 && ball.stuckMs < 2000) {
      ball.x += dx * 0.22;
      ball.y += dy * 0.28;
      ball.velocityX *= 0.45;
      ball.velocityY = Math.max(ball.velocityY * 0.5, 0.12);
      return;
    }

    // Snap + settle — always finish so balls can't hang above bins.
    ball.x = ball.targetBinX;
    ball.y = ball.targetBinY;
    ball.pathIndex = ball.path.length - 1;
    ball.settled = true;
    ball.velocityX = 0;
    ball.velocityY = 0;
    ball.angularVelocity *= 0.2;
    ball.stuckMs = 0;
    const bin = this.bins[ball.targetBinIndex];
    const binValue = bin?.value;
    const fxX = ball.targetBinX;
    const fxY = ball.targetBinY - FIRE_EFFECT.offsetY;

    if (binValue !== undefined) {
      // Defer Angular/Spine/history — sync callbacks freeze iOS Chrome mid-physics.
      this.queueBallLanded(binValue);
    }

    if (bin && binValue !== undefined && LOW_HIT_MULTIPLIERS.has(binValue)) {
      // Soft cream bubbles + hide landing ball (≤1 multipliers)
      ball.sprite.visible = false;
      this.spawnLowHitEffect(bin);
      this.bumpBin(bin);
      this.flashBin(ball.targetBinIndex, LOW_HIT_EFFECT.binFlashTint);
      return;
    }

    if (bin && binValue !== undefined && MID_FIRE_MULTIPLIERS.has(binValue)) {
      // Hide landing ball — fire particles are real ball sprites
      ball.sprite.visible = false;
      this.startMidFire(bin);
      this.bumpBin(bin);
      this.flashBin(ball.targetBinIndex, MID_FIRE_EFFECT.binFlashTint);
      return;
    }

    const isHighWin = binValue !== undefined && FIREWORKS_MULTIPLIERS.has(binValue);
    const highPalette: HighWinPalette = Math.random() < 0.5 ? 'cyan' : 'purple';
    this.spawnFireBurst(fxX, fxY, isHighWin ? highPalette : 'default');
    this.flashBin(
      ball.targetBinIndex,
      isHighWin
        ? highPalette === 'cyan'
          ? CYAN_FIRE_EFFECT.binFlashTint
          : PURPLE_FIRE_EFFECT.binFlashTint
        : undefined,
    );

    if (isHighWin && bin) {
      // Same cream bubbles as 0.7 — under the rising blast
      this.spawnLowHitEffect(bin);
      this.bumpBin(bin);
      this.spawnFireworks(fxX, fxY, highPalette);
    }
  }

  private onPegHit(ball: BallInstance, target: PathWaypoint): void {
    if (!target.peg) {
      return;
    }

    this.pegHitSoundPending = true;
    this.setPegGolden(ball, target.peg);

    // Always bounce on every peg. pathIndex advances in finally so a late
    // catch-up can't shelf-loop on the same peg.
    ball.x = target.x + (Math.random() - 0.5) * 1.2;
    ball.y = target.y;

    const next = ball.path[ball.pathIndex + 2];
    const side = target.goRight ? 1 : -1;
    const kick =
      BALL_CONFIG.pegDeflectMin +
      Math.random() * (BALL_CONFIG.pegDeflectMax - BALL_CONFIG.pegDeflectMin);

    const bounce =
      BALL_CONFIG.pegBounceMin +
      Math.random() * (BALL_CONFIG.pegBounceMax - BALL_CONFIG.pegBounceMin);

    // Spin with the bounce direction (right → clockwise).
    const spin =
      side *
      (BALL_CONFIG.spinOnHit + Math.random() * BALL_CONFIG.spinOnHit * 0.45);
    ball.angularVelocity = Math.max(
      -BALL_CONFIG.maxSpin,
      Math.min(BALL_CONFIG.maxSpin, ball.angularVelocity * 0.35 + spin),
    );

    // ~7px upward pop on every peg.
    ball.velocityY = -bounce;

    if (!next) {
      ball.velocityX =
        (ball.velocityX * 0.2 + side * kick * 0.45) * BALL_CONFIG.bounceSpeedScale;
      return;
    }

    const towardNext = Math.sign(next.x - ball.x) || side;
    const guideKick = Math.abs(next.x - ball.x) * 0.014;
    const newVx = towardNext * (kick * 0.55 + guideKick) + side * kick * 0.25;
    ball.velocityX = (ball.velocityX * 0.2 + newVx * 0.8) * BALL_CONFIG.pegSpeedDamp;
    ball.velocityX *= BALL_CONFIG.bounceSpeedScale;
    ball.velocityX = Math.max(
      -BALL_CONFIG.maxHorizontalSpeed,
      Math.min(BALL_CONFIG.maxHorizontalSpeed, ball.velocityX),
    );
  }

  /** Flush land callbacks one-per-frame so iOS Chrome never batches UI freezes. */
  private queueBallLanded(value: number): void {
    this.pendingLandValues.push(value);
    this.scheduleLandFlush();
  }

  private scheduleLandFlush(): void {
    if (this.landFlushScheduled || this.pendingLandValues.length === 0) {
      return;
    }
    this.landFlushScheduled = true;
    requestAnimationFrame(() => {
      this.landFlushScheduled = false;
      const value = this.pendingLandValues.shift();
      if (value === undefined) {
        return;
      }
      try {
        this.onBallLanded?.(value);
      } catch {
        /* land UI must never break the board */
      }
      if (this.pendingLandValues.length > 0) {
        this.scheduleLandFlush();
      }
    });
  }

  private onTick = (ticker: Ticker): void => {
    try {
      this.tickBoard(ticker);
    } catch {
      /* never let one bad frame freeze iPhone Chrome */
    }
  };

  private tickBoard(ticker: Ticker): void {
    // Cap delta so hitch frames don't explode physics work (keeps ~60fps feel)
    const cappedDelta = Math.min(ticker.deltaMS, 1000 / 30);
    const cappedDeltaTime = Math.min(ticker.deltaTime, 2);
    const pressure = this.getLoadPressure();
    const settleMs =
      pressure > 0.35 ? BALL_CONFIG.settleMs * (1 - pressure * 0.55) : BALL_CONFIG.settleMs;
    const now = performance.now();

    this.pegHitSoundPending = false;

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      const speed = ball.speedScale;
      const deltaMs = cappedDelta * speed;
      // Always ≥2 substeps so turbo/low-FPS balls still meet every peg (no skip).
      const steps = Math.min(
        4,
        Math.max(2, Math.round((cappedDeltaTime * speed) || 1)),
      );

      if (ball.settled) {
        ball.settleElapsedMs += deltaMs;
        if (ball.settleElapsedMs >= settleMs) {
          this.removeBallAt(i);
        }
        continue;
      }

      // Absolute lifetime — if a ball somehow shelves, finish at the bin (FX at bin).
      const born = this.ballBornAt.get(ball) ?? now;
      if (now - born > this.maxBallLifeMs) {
        ball.x = ball.targetBinX;
        ball.y = ball.targetBinY;
        this.finishBinDrop(ball);
        continue;
      }

      for (let step = 0; step < steps; step++) {
        try {
          this.advanceBall(ball, deltaMs / steps);
        } catch {
          break;
        }
      }

      ball.sprite.x = ball.x;
      ball.sprite.y = ball.y;
      const spinScale = Math.min(cappedDeltaTime * speed, 3);
      ball.sprite.rotation += ball.angularVelocity * Math.max(1, spinScale);
      ball.angularVelocity *= Math.pow(BALL_CONFIG.spinDamping, Math.max(1, spinScale));
    }

    // Peg SFX mid multi-ball freezes iOS Chrome — only play when load is light.
    if (this.pegHitSoundPending && !(this.isMobile && this.balls.length > 2)) {
      this.pegHitSoundPending = false;
      try {
        this.onPegHitSound?.();
      } catch {
        /* never let audio break the board loop */
      }
    } else {
      this.pegHitSoundPending = false;
    }

    // FX stay on wall-clock time (not turbo) so sparks don't look frantic
    this.updatePegGolden(cappedDelta);
    this.updateFireworkRockets(cappedDelta);
    this.updateFireEffects(cappedDelta);
    this.updateBinFlashes(cappedDelta);
    this.updateBinBumps(cappedDelta);
    this.updateMidFireEmitters(cappedDelta);
  }

  /** 0 = light, 1 = heavy — drives FX/physics scaling on mobile Safari. */
  private getLoadPressure(): number {
    const balls = this.balls.length;
    const fx =
      this.fireParticles.length * 0.04 +
      this.fireGlows.length * 0.08 +
      this.binFireEmitters.length * 0.12 +
      this.fireworkRockets.length * 0.1;
    const ballPressure = Math.max(0, (balls - 2) / (this.isMobile ? 10 : 16));
    return Math.min(1, ballPressure + fx);
  }

  /** Scale particle counts down when many balls / FX are live. */
  private fxCountScale(): number {
    const pressure = this.getLoadPressure();
    if (!this.isMobile) {
      return Math.max(0.5, 1 - pressure * 0.35);
    }
    return Math.max(0.25, 1 - pressure * 0.7);
  }

  /** Gravity-driven drop: fast into each peg, slow bounce off, then into the bin. */
  private advanceBall(ball: BallInstance, deltaMs: number): void {
    if (ball.settled) {
      return;
    }

    const step = deltaMs / 16;
    const allPegsDone = ball.pathIndex >= ball.path.length - 1;

    if (allPegsDone) {
      ball.velocityY = Math.min(
        ball.velocityY + BALL_CONFIG.gravity * step,
        BALL_CONFIG.maxFallSpeed,
      );

      const binDx = ball.targetBinX - ball.x;
      if (Math.abs(binDx) > 0.8) {
        ball.velocityX += binDx * BALL_CONFIG.binGuideStrength * step;
      } else {
        ball.velocityX *= 0.82;
        ball.x += binDx * 0.18 * step;
      }
      ball.velocityX *= Math.pow(BALL_CONFIG.airDrag, step);
      ball.velocityX = Math.max(
        -BALL_CONFIG.maxHorizontalSpeed,
        Math.min(BALL_CONFIG.maxHorizontalSpeed, ball.velocityX),
      );

      ball.x += ball.velocityX * step;
      ball.y += ball.velocityY * step;
      ball.stuckMs += deltaMs;

      // Force settle if lingering above the bin (multi-ball / low FPS on iOS).
      if (
        ball.y >= ball.targetBinY - 4 ||
        ball.stuckMs > 2000 ||
        ball.y > BOARD_HEIGHT - 8
      ) {
        if (ball.stuckMs > 2000 || ball.y > BOARD_HEIGHT - 8) {
          ball.x = ball.targetBinX;
          ball.y = ball.targetBinY;
        }
        this.finishBinDrop(ball);
      }
      return;
    }

    const target = ball.path[ball.pathIndex + 1];
    if (!target) {
      ball.x = ball.targetBinX;
      ball.y = ball.targetBinY;
      this.finishBinDrop(ball);
      return;
    }

    const pegsRemaining = ball.path.length - 1 - ball.pathIndex;
    const bouncing = ball.velocityY < 0;

    if (bouncing) {
      // Short bounce arc after peg hit.
      ball.velocityY += BALL_CONFIG.gravity * BALL_CONFIG.bounceGravityScale * step;
    } else {
      // Soft approach toward the next peg.
      ball.velocityY = Math.min(
        ball.velocityY + (BALL_CONFIG.gravity + BALL_CONFIG.approachAccel) * step,
        BALL_CONFIG.maxFallSpeed,
      );

      const distToPeg = target.y - ball.y;
      if (distToPeg > 0 && distToPeg < BALL_CONFIG.nearPegSlowY) {
        ball.velocityY = Math.min(ball.velocityY, BALL_CONFIG.nearPegMaxSpeed);
      }
    }

    let aimX = target.x;
    if (pegsRemaining <= BALL_CONFIG.lateRowAlignRows) {
      const blend = 1 - pegsRemaining / (BALL_CONFIG.lateRowAlignRows + 1);
      aimX = target.x + (ball.targetBinX - target.x) * blend * 0.35;
    }

    const dx = aimX - ball.x;
    const farFactor = Math.min(2.4, 1 + Math.abs(dx) * 0.01);
    let guide = BALL_CONFIG.guideStrength * farFactor;

    if (ball.stuckMs > 500) {
      guide *= 1 + Math.min(1.2, ball.stuckMs / 1200);
    }

    if (bouncing) {
      guide *= 0.55;
    }

    ball.velocityX += dx * guide * step;
    ball.velocityX *= Math.pow(BALL_CONFIG.airDrag, step);
    ball.velocityX = Math.max(
      -BALL_CONFIG.maxHorizontalSpeed,
      Math.min(BALL_CONFIG.maxHorizontalSpeed, ball.velocityX),
    );

    ball.x += ball.velocityX * step;
    ball.y += ball.velocityY * step;
    ball.stuckMs += deltaMs;

    if (!target.peg) {
      return;
    }

    const hit =
      this.checkPegTouch(ball, target) ||
      this.checkPegMissed(ball, target) ||
      ball.stuckMs > 1800;

    if (!hit) {
      return;
    }

    // Bounce on every peg. pathIndex advances in finally so a mid-hit throw
    // can never leave the ball stuck on the same peg (iOS shelf bug).
    try {
      this.onPegHit(ball, target);
    } finally {
      ball.pathIndex += 1;
      ball.stuckMs = 0;
    }
  }

  private pegHitRadiusFor(ball: BallInstance): number {
    const depthT = ball.pathIndex / Math.max(1, ball.path.length - 2);
    return BALL_CONFIG.pegHitRadius + depthT * BALL_CONFIG.pegHitRadiusBoost;
  }

  private checkPegTouch(ball: BallInstance, target: PathWaypoint): boolean {
    const dx = target.x - ball.x;
    const dy = target.y - ball.y;
    const hitRadius = this.pegHitRadiusFor(ball);
    const pegDist = Math.hypot(dx, dy);

    if (pegDist <= hitRadius) {
      return true;
    }

    // At peg height — count hit even during a small upward bounce.
    if (Math.abs(dx) < hitRadius + 3 && Math.abs(dy) < hitRadius + 2) {
      return true;
    }

    // Descending through the peg row band.
    return (
      ball.velocityY > -0.05 &&
      dy > 0 &&
      ball.y >= target.y - 2 &&
      Math.abs(dx) < hitRadius + 4
    );
  }

  private checkPegMissed(ball: BallInstance, target: PathWaypoint): boolean {
    const dx = target.x - ball.x;
    const hitRadius = this.pegHitRadiusFor(ball);
    const catchUpY =
      BALL_CONFIG.pegRowCatchUpY +
      (ball.pathIndex / Math.max(1, ball.path.length - 2)) * 6;

    // Well past the row — always register a hit (even if drifted sideways).
    if (ball.y > target.y + catchUpY + 8) {
      return true;
    }

    return ball.y > target.y + catchUpY && Math.abs(dx) < hitRadius + 6;
  }

  private clearPegActive(peg: PegInstance): void {
    peg.goldenMs = 0;
    peg.sprite.texture = Assets.get('pegLarge');
    peg.sprite.tint = PEG_CONFIG.baseTint;
    this.setPegSunlightActive(peg, false);
  }

  /** Turn peg off only if no other in-flight ball still has it lit. */
  private releasePegForBall(ball: BallInstance): void {
    const peg = ball.activePeg;
    if (!peg) {
      return;
    }

    ball.activePeg = null;
    const stillUsed = this.balls.some((other) => other.activePeg === peg);
    if (!stillUsed) {
      this.clearPegActive(peg);
    }
  }

  private setPegGolden(ball: BallInstance, peg: PegInstance): void {
    // Only clear THIS ball's previous peg — other balls keep their active pegs.
    if (ball.activePeg && ball.activePeg !== peg) {
      this.releasePegForBall(ball);
    }

    ball.activePeg = peg;
    peg.goldenMs = PEG_CONFIG.hitGolden.holdMs;
    peg.sprite.texture = Assets.get('pegLargeActive');
    peg.sprite.tint = 0xffffff;
    this.setPegSunlightActive(peg, true);
  }

  private setPegSunlightActive(peg: PegInstance, active: boolean): void {
    const { idleAlpha, activeAlpha, activeScale } = PEG_CONFIG.sunlight;
    peg.sunlight.alpha = active ? activeAlpha : idleAlpha;
    peg.sunlight.scale.set(active ? activeScale : 1);
  }

  private updatePegGolden(deltaMs: number): void {
    for (const peg of this.pegs) {
      if (peg.goldenMs <= 0) {
        continue;
      }

      peg.goldenMs = Math.max(0, peg.goldenMs - deltaMs);

      if (peg.goldenMs <= 0) {
        // Timeout — clear references from balls that were on this peg.
        for (const ball of this.balls) {
          if (ball.activePeg === peg) {
            ball.activePeg = null;
          }
        }
        this.clearPegActive(peg);
      }
      // Don't re-assign texture every frame — iOS Chrome stalls on texture thrash.
    }
  }

  private removeBallAt(index: number): void {
    const [ball] = this.balls.splice(index, 1);
    if (ball) {
      this.releasePegForBall(ball);
      ball.sprite.destroy();
    }
  }

  private clearBalls(): void {
    for (const ball of this.balls) {
      this.releasePegForBall(ball);
      ball.sprite.destroy();
    }
    this.balls = [];
  }

  private spawnFireBurst(
    x: number,
    y: number,
    palette: 'default' | HighWinPalette = 'default',
  ): void {
    const highFx =
      palette === 'cyan'
        ? CYAN_FIRE_EFFECT
        : palette === 'purple'
          ? PURPLE_FIRE_EFFECT
          : null;
    const colors = highFx?.colors ?? FIRE_EFFECT.colors;
    const glowColor = highFx?.glowColor ?? FIRE_EFFECT.glowColor;
    const glowAlpha = highFx?.glowAlpha ?? FIRE_EFFECT.glowAlpha;

    // High-win fireworks already light the blast — skip the solid glow disc
    // (it reads as a round purple/cyan shadow on the board).
    // Also skip glow under heavy mobile load (Safari GPU fill cost).
    if (!highFx && this.getLoadPressure() < 0.55) {
      const glow = new Graphics();
      glow.circle(0, 0, FIRE_EFFECT.glowRadius);
      glow.fill({ color: glowColor, alpha: glowAlpha });
      glow.x = x;
      glow.y = y;
      glow.blendMode = this.isMobile ? 'normal' : 'add';
      this.effectLayer.addChild(glow);
      this.fireGlows.push({
        gfx: glow,
        lifeMs: FIRE_EFFECT.glowLifeMs,
        maxLifeMs: FIRE_EFFECT.glowLifeMs,
      });
    }

    const particleCount = Math.max(
      4,
      Math.round(FIRE_EFFECT.particleCount * this.fxCountScale()),
    );
    for (let i = 0; i < particleCount; i++) {
      if (this.fireParticles.length >= this.maxFireParticles) {
        break;
      }
      const size =
        FIRE_EFFECT.sizeMin +
        Math.random() * (FIRE_EFFECT.sizeMax - FIRE_EFFECT.sizeMin);
      const color = colors[Math.floor(Math.random() * colors.length)];
      const lifeMs =
        FIRE_EFFECT.lifeMinMs +
        Math.random() * (FIRE_EFFECT.lifeMaxMs - FIRE_EFFECT.lifeMinMs);

      // Narrow upward cone — mostly rises, little sideways jitter
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.7;
      const speed =
        FIRE_EFFECT.speedYMin +
        Math.random() * (FIRE_EFFECT.speedYMax - FIRE_EFFECT.speedYMin);

      const gfx = new Graphics();
      gfx.circle(0, 0, size);
      gfx.fill({ color, alpha: 0.9 });
      gfx.x = x + (Math.random() - 0.5) * 6;
      gfx.y = y + (Math.random() - 0.5) * 3;
      gfx.blendMode = this.isMobile ? 'normal' : 'add';
      this.effectLayer.addChild(gfx);

      this.fireParticles.push({
        gfx,
        x: gfx.x,
        y: gfx.y,
        vx: Math.cos(angle) * speed * 0.35 + (Math.random() - 0.5) * FIRE_EFFECT.speedX,
        vy: Math.sin(angle) * speed,
        lifeMs,
        maxLifeMs: lifeMs,
        size,
        color,
        gravity: FIRE_EFFECT.gravity,
        drag: FIRE_EFFECT.drag,
        twinkle: false,
      });
    }
  }

  /** Soft orb rises from the bin, then ring-blasts at height (cyan or purple). */
  private spawnFireworks(x: number, y: number, palette: HighWinPalette): void {
    this.launchFireworkRocket(x, y - 6, palette);
  }

  private launchFireworkRocket(x: number, y: number, palette: HighWinPalette): void {
    const rise =
      FIREWORKS_EFFECT.riseMin +
      Math.random() * (FIREWORKS_EFFECT.riseMax - FIREWORKS_EFFECT.riseMin);
    const speed =
      FIREWORKS_EFFECT.rocketSpeedMin +
      Math.random() * (FIREWORKS_EFFECT.rocketSpeedMax - FIREWORKS_EFFECT.rocketSpeedMin);
    const colors = FIREWORKS_EFFECT.palettes[palette];

    // Single solid ball — no border / soft halo
    const gfx = new Container();
    const ball = new Graphics();
    ball.circle(0, 0, FIREWORKS_EFFECT.orbCoreRadius + 2);
    ball.fill({ color: colors.orbMidColor, alpha: 1 });
    gfx.addChild(ball);
    gfx.x = x;
    gfx.y = y;
    gfx.blendMode = this.isMobile ? 'normal' : 'add';
    this.effectLayer.addChild(gfx);

    this.fireworkRockets.push({
      gfx,
      x,
      y,
      vy: -speed,
      explodeY: y - rise,
      lifeMs: 0,
      palette,
    });
  }

  /** Soft ball-like circle: bright core + mid glow (+ optional outer bloom). */
  private createSoftOrb(
    coreR: number,
    midR: number,
    outerR: number,
    coreColor: number,
    midColor: number,
    outerColor: number,
    /** Large outer fill reads as a round shadow on the board — off for blasts. */
    withOuterBloom = true,
  ): Container {
    const root = new Container();

    if (withOuterBloom) {
      const outer = new Graphics();
      outer.circle(0, 0, outerR);
      outer.fill({ color: outerColor, alpha: 0.28 });
      root.addChild(outer);
    }

    const mid = new Graphics();
    mid.circle(0, 0, midR);
    mid.fill({ color: midColor, alpha: 0.55 });
    root.addChild(mid);

    const core = new Graphics();
    core.circle(0, 0, coreR);
    core.fill({ color: coreColor, alpha: 0.95 });
    root.addChild(core);

    return root;
  }

  private updateFireworkRockets(deltaMs: number): void {
    for (let i = this.fireworkRockets.length - 1; i >= 0; i--) {
      const rocket = this.fireworkRockets[i];
      const step = deltaMs / 16;

      rocket.vy += FIREWORKS_EFFECT.rocketGravity * step;
      rocket.y += rocket.vy * step;
      rocket.lifeMs += deltaMs;

      // Gentle pulse while rising (ball-like circle feel)
      const pulse = 1 + Math.sin(rocket.lifeMs * 0.018) * 0.08;
      rocket.gfx.scale.set(pulse);
      rocket.gfx.x = rocket.x;
      rocket.gfx.y = rocket.y;
      rocket.gfx.alpha = 0.85 + Math.sin(rocket.lifeMs * 0.03) * 0.1;

      if (rocket.y <= rocket.explodeY || rocket.vy >= 0) {
        const blastX = rocket.x;
        const blastY = rocket.y;
        rocket.gfx.destroy({ children: true });
        this.fireworkRockets.splice(i, 1);
        this.spawnFireworkBurst(blastX, blastY, rocket.palette);
      }
    }
  }

  private spawnFireworkBurst(x: number, y: number, palette: HighWinPalette): void {
    const colors = FIREWORKS_EFFECT.palettes[palette];
    const particleCount = Math.max(
      8,
      Math.round(FIREWORKS_EFFECT.particlesPerBurst * this.fxCountScale()),
    );

    // Solid balls only — no stroke/border
    for (let i = 0; i < particleCount; i++) {
      if (this.fireParticles.length >= this.maxFireParticles) {
        break;
      }
      const size =
        FIREWORKS_EFFECT.sizeMin +
        Math.random() * (FIREWORKS_EFFECT.sizeMax - FIREWORKS_EFFECT.sizeMin);
      const color =
        colors.colors[Math.floor(Math.random() * colors.colors.length)];
      const lifeMs =
        FIREWORKS_EFFECT.lifeMinMs +
        Math.random() * (FIREWORKS_EFFECT.lifeMaxMs - FIREWORKS_EFFECT.lifeMinMs);
      const angle =
        (Math.PI * 2 * i) / particleCount +
        (Math.random() - 0.5) * 0.25;
      const blast =
        FIREWORKS_EFFECT.blastMin +
        Math.random() * (FIREWORKS_EFFECT.blastMax - FIREWORKS_EFFECT.blastMin);

      const orb = new Container();
      const ball = new Graphics();
      ball.circle(0, 0, size * 0.45);
      ball.fill({ color, alpha: 0.95 });
      orb.addChild(ball);
      orb.x = x;
      orb.y = y;
      orb.blendMode = this.isMobile ? 'normal' : 'add';
      this.effectLayer.addChild(orb);

      this.fireParticles.push({
        gfx: orb,
        x,
        y,
        vx: Math.cos(angle) * blast,
        vy: Math.sin(angle) * blast - FIREWORKS_EFFECT.upBias,
        lifeMs,
        maxLifeMs: lifeMs,
        size,
        color,
        gravity: FIREWORKS_EFFECT.gravity,
        drag: FIREWORKS_EFFECT.drag,
        twinkle: false,
      });
    }
  }

  private flashBin(index: number, tint: number = FIRE_EFFECT.binFlashTint): void {
    const bin = this.bins[index];
    if (!bin) return;

    bin.sprite.tint = tint;
    this.binFlashes.push({ bin, lifeMs: FIRE_EFFECT.binFlashMs, tint });
  }

  /** Cream bubbles start in the box, then float out past the edges. */
  private spawnLowHitEffect(bin: BinInstance): void {
    const fxRoot = new Container();
    const hw = bin.width * 0.36;
    const hh = bin.height * 0.36;

    // No mask — bubbles can leave the box (esp. upward)
    bin.container.addChild(fxRoot);

    this.lowHitRootCounts.set(
      fxRoot,
      Math.max(4, Math.round(LOW_HIT_EFFECT.particleCount * this.fxCountScale())),
    );

    const bubbleCount = this.lowHitRootCounts.get(fxRoot) ?? LOW_HIT_EFFECT.particleCount;
    for (let i = 0; i < bubbleCount; i++) {
      if (this.fireParticles.length >= this.maxFireParticles) {
        break;
      }
      const size =
        LOW_HIT_EFFECT.sizeMin +
        Math.random() * (LOW_HIT_EFFECT.sizeMax - LOW_HIT_EFFECT.sizeMin);
      const color =
        LOW_HIT_EFFECT.colors[Math.floor(Math.random() * LOW_HIT_EFFECT.colors.length)];
      const lifeMs =
        LOW_HIT_EFFECT.lifeMinMs +
        Math.random() * (LOW_HIT_EFFECT.lifeMaxMs - LOW_HIT_EFFECT.lifeMinMs);

      // Solid cream ball — no border / soft shadow layers
      const orb = new Container();
      const ball = new Graphics();
      ball.circle(0, 0, size * 0.5);
      ball.fill({ color, alpha: 0.88 });
      orb.addChild(ball);
      orb.alpha = 0.95;

      // Spawn inside the box, then burst outward on all 4 sides
      const x = (Math.random() - 0.5) * hw * 1.1;
      const y = (Math.random() - 0.5) * hh * 0.9;
      orb.x = x;
      orb.y = y;
      fxRoot.addChild(orb);

      const angle = Math.random() * Math.PI * 2;
      const speed =
        LOW_HIT_EFFECT.speedYMin +
        Math.random() * (LOW_HIT_EFFECT.speedYMax - LOW_HIT_EFFECT.speedYMin);

      this.fireParticles.push({
        gfx: orb,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        lifeMs,
        maxLifeMs: lifeMs,
        size,
        color,
        gravity: LOW_HIT_EFFECT.gravity,
        drag: LOW_HIT_EFFECT.drag,
        twinkle: false,
        root: fxRoot,
      });
    }
  }

  /** Quick Y punch + squash for a dhamak feel. */
  private bumpBin(bin: BinInstance): void {
    for (let i = this.binBumps.length - 1; i >= 0; i--) {
      if (this.binBumps[i].bin === bin) {
        bin.container.y = this.binBumps[i].baseY;
        bin.container.scale.set(1);
        this.binBumps.splice(i, 1);
      }
    }

    this.binBumps.push({
      bin,
      lifeMs: LOW_HIT_EFFECT.bumpMs,
      maxLifeMs: LOW_HIT_EFFECT.bumpMs,
      baseY: bin.y,
      amount: LOW_HIT_EFFECT.bumpY,
    });
  }

  /** Start continuous orange fire from mid multipliers (1.2 / 2.3). */
  private startMidFire(bin: BinInstance): void {
    // Reset if already burning
    for (let i = this.binFireEmitters.length - 1; i >= 0; i--) {
      if (this.binFireEmitters[i].bin === bin) {
        this.binFireEmitters.splice(i, 1);
      }
    }

    const pressure = this.getLoadPressure();
    const durationScale = pressure > 0.4 ? Math.max(0.35, 1 - pressure * 0.55) : 1;

    this.binFireEmitters.push({
      bin,
      lifeMs: MID_FIRE_EFFECT.durationMs * durationScale,
      emitAccMs: 0,
    });

    // Immediate burst so it doesn't wait for first interval
    const burst = pressure > 0.55 ? 2 : 4;
    for (let i = 0; i < burst; i++) {
      this.emitMidFireParticle(bin);
    }
  }

  private emitMidFireParticle(bin: BinInstance): void {
    if (this.fireParticles.length >= this.maxFireParticles) {
      return;
    }
    const size =
      MID_FIRE_EFFECT.sizeMin +
      Math.random() * (MID_FIRE_EFFECT.sizeMax - MID_FIRE_EFFECT.sizeMin);
    const color =
      MID_FIRE_EFFECT.colors[
        Math.floor(Math.random() * MID_FIRE_EFFECT.colors.length)
      ];
    const lifeMs =
      MID_FIRE_EFFECT.lifeMinMs +
      Math.random() * (MID_FIRE_EFFECT.lifeMaxMs - MID_FIRE_EFFECT.lifeMinMs);

    // Spawn from inside the multiplier box, then rise out
    const x = bin.x + (Math.random() - 0.5) * bin.width * 0.45;
    const y = bin.y + (Math.random() - 0.5) * bin.height * 0.35;

    // Real ball sprite (same as drop ball) — tinted as fire
    const gfx = new Container();
    const sprite = new Sprite(Assets.get('ballLarge'));
    sprite.anchor.set(0.5);
    sprite.scale.set(size * MID_FIRE_EFFECT.ballScale);
    sprite.tint = color;
    gfx.addChild(sprite);
    gfx.x = x;
    gfx.y = y;
    gfx.blendMode = this.isMobile ? 'normal' : 'add';
    this.effectLayer.addChild(gfx);

    this.fireParticles.push({
      gfx,
      x,
      y,
      vx: (Math.random() - 0.5) * MID_FIRE_EFFECT.speedX * 2,
      vy: -(
        MID_FIRE_EFFECT.speedYMin +
        Math.random() * (MID_FIRE_EFFECT.speedYMax - MID_FIRE_EFFECT.speedYMin)
      ),
      lifeMs,
      maxLifeMs: lifeMs,
      size,
      color,
      gravity: MID_FIRE_EFFECT.gravity,
      drag: MID_FIRE_EFFECT.drag,
      twinkle: false,
    });
  }

  private updateMidFireEmitters(deltaMs: number): void {
    for (let i = this.binFireEmitters.length - 1; i >= 0; i--) {
      const emitter = this.binFireEmitters[i];
      emitter.lifeMs -= deltaMs;
      if (emitter.lifeMs <= 0) {
        this.binFireEmitters.splice(i, 1);
        continue;
      }

      emitter.emitAccMs += deltaMs;
      while (emitter.emitAccMs >= MID_FIRE_EFFECT.emitIntervalMs) {
        emitter.emitAccMs -= MID_FIRE_EFFECT.emitIntervalMs;
        for (let n = 0; n < MID_FIRE_EFFECT.particlesPerEmit; n++) {
          this.emitMidFireParticle(emitter.bin);
        }
      }
    }
  }

  private updateBinBumps(deltaMs: number): void {
    for (let i = this.binBumps.length - 1; i >= 0; i--) {
      const bump = this.binBumps[i];
      bump.lifeMs -= deltaMs;
      if (bump.lifeMs <= 0) {
        bump.bin.container.y = bump.baseY;
        bump.bin.container.scale.set(1);
        this.binBumps.splice(i, 1);
        continue;
      }

      const t = 1 - bump.lifeMs / bump.maxLifeMs;
      let offset: number;
      let squash: number;
      if (t < 0.22) {
        const p = t / 0.22;
        offset = bump.amount * p;
        squash = p;
      } else {
        const p = (t - 0.22) / 0.78;
        const ease = 1 - Math.pow(1 - p, 3);
        offset = bump.amount * (1 - ease);
        squash = 1 - ease;
      }

      bump.bin.container.y = bump.baseY + offset;
      bump.bin.container.scale.set(1 + squash * 0.06, 1 - squash * 0.12);
    }
  }

  private releaseLowHitRoot(root: Container | undefined): void {
    if (!root) return;
    const left = (this.lowHitRootCounts.get(root) ?? 1) - 1;
    if (left <= 0) {
      this.lowHitRootCounts.delete(root);
      root.destroy({ children: true });
    } else {
      this.lowHitRootCounts.set(root, left);
    }
  }

  private updateFireEffects(deltaMs: number): void {
    for (let i = this.fireParticles.length - 1; i >= 0; i--) {
      const p = this.fireParticles[i];
      p.lifeMs -= deltaMs;
      if (p.lifeMs <= 0) {
        const root = p.root;
        p.gfx.destroy({ children: true });
        this.fireParticles.splice(i, 1);
        this.releaseLowHitRoot(root);
        continue;
      }

      const step = deltaMs / 16;
      p.vy += p.gravity * step;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * step;
      p.y += p.vy * step;

      const t = p.lifeMs / p.maxLifeMs;
      const fade = t * t * (3 - 2 * t);
      let alpha = fade;
      if (p.twinkle) {
        alpha *= 0.65 + 0.35 * Math.sin(p.lifeMs * 0.045 + p.x * 0.1);
      }

      p.gfx.x = p.x;
      p.gfx.y = p.y;
      p.gfx.alpha = Math.max(0, Math.min(1, alpha));
      p.gfx.scale.set(0.45 + fade * 0.7);
    }

    for (let i = this.fireGlows.length - 1; i >= 0; i--) {
      const glow = this.fireGlows[i];
      glow.lifeMs -= deltaMs;
      if (glow.lifeMs <= 0) {
        glow.gfx.destroy({ children: true });
        this.fireGlows.splice(i, 1);
        continue;
      }

      const t = glow.lifeMs / glow.maxLifeMs;
      const fade = t * t * (3 - 2 * t);
      glow.gfx.alpha = FIRE_EFFECT.glowAlpha * fade;
      glow.gfx.scale.set(0.9 + (1 - t) * 0.75);
    }
  }

  private updateBinFlashes(deltaMs: number): void {
    for (let i = this.binFlashes.length - 1; i >= 0; i--) {
      const flash = this.binFlashes[i];
      flash.lifeMs -= deltaMs;
      if (flash.lifeMs <= 0) {
        flash.bin.sprite.tint = 0xffffff;
        this.binFlashes.splice(i, 1);
        continue;
      }

      const t = flash.lifeMs / FIRE_EFFECT.binFlashMs;
      // Blend flash tint back toward white
      const sr = (flash.tint >> 16) & 0xff;
      const sg = (flash.tint >> 8) & 0xff;
      const sb = flash.tint & 0xff;
      const r = Math.round(sr + (0xff - sr) * (1 - t));
      const g = Math.round(sg + (0xff - sg) * (1 - t));
      const b = Math.round(sb + (0xff - sb) * (1 - t));
      flash.bin.sprite.tint = (r << 16) | (g << 8) | b;
    }
  }

  private clearFireEffects(): void {
    for (const rocket of this.fireworkRockets) {
      rocket.gfx.destroy({ children: true });
    }
    this.fireworkRockets = [];

    for (const p of this.fireParticles) {
      if (!p.root) {
        p.gfx.destroy({ children: true });
      }
    }
    for (const root of this.lowHitRootCounts.keys()) {
      root.destroy({ children: true });
    }
    this.lowHitRootCounts.clear();

    for (const g of this.fireGlows) {
      g.gfx.destroy({ children: true });
    }
    for (const flash of this.binFlashes) {
      flash.bin.sprite.tint = 0xffffff;
    }
    for (const bump of this.binBumps) {
      bump.bin.container.y = bump.baseY;
      bump.bin.container.scale.set(1);
    }
    this.fireParticles = [];
    this.fireGlows = [];
    this.binFlashes = [];
    this.binBumps = [];
    this.binFireEmitters = [];
  }

  private buildPegs(): void {
    const pegTexture = Assets.get('pegLarge');
    const positions = computePegPositions();
    this.pegsByRow = Array.from({ length: PEG_CONFIG.rows }, () => []);

    for (const position of positions) {
      const container = new Container();
      container.x = position.x;
      container.y = position.y;
      container.addChild(this.createPegShadow());

      const peg = new Sprite(pegTexture);
      peg.anchor.set(PEG_CONFIG.anchor.x, PEG_CONFIG.anchor.y);
      peg.scale.set(PEG_CONFIG.scaleX, PEG_CONFIG.scaleY);
      peg.tint = PEG_CONFIG.baseTint;
      container.addChild(peg);
      const sunlight = this.createPegSunlight();
      sunlight.alpha = PEG_CONFIG.sunlight.idleAlpha;
      container.addChild(sunlight);

      const instance: PegInstance = {
        id: `peg-${position.row}-${position.col}`,
        row: position.row,
        col: position.col,
        x: position.x,
        y: position.y,
        radius: PEG_CONFIG.collisionRadius,
        container,
        sprite: peg,
        sunlight,
        goldenMs: 0,
      };

      this.pegs.push(instance);
      this.pegsByRow[position.row].push(instance);
      this.pegLayer.addChild(container);
    }
  }

  private createPegShadow(): Graphics {
    const { width, height, offsetY, color, alpha } = PEG_CONFIG.shadow;
    const shadow = new Graphics();

    shadow.ellipse(0, offsetY, width * 1.15, height * 1.25);
    shadow.fill({ color, alpha: alpha * 0.45 });
    shadow.ellipse(0, offsetY + 0.4, width * 0.7, height * 0.75);
    shadow.fill({ color, alpha: alpha * 0.75 });

    return shadow;
  }

  /** Soft sun-kissed specular on the top-left of each peg head. */
  private createPegSunlight(): Container {
    const {
      offsetX,
      offsetY,
      softRx,
      softRy,
      softAlpha,
      coreRx,
      coreRy,
      coreAlpha,
      color,
    } = PEG_CONFIG.sunlight;

    const root = new Container();
    root.x = offsetX;
    root.y = offsetY;
    // ADD on desktop; normal on mobile still shows the glint without GPU thrash.
    root.blendMode = this.isMobile ? 'normal' : 'add';

    const soft = new Graphics();
    soft.ellipse(0, 0, softRx, softRy);
    soft.fill({ color, alpha: softAlpha });
    root.addChild(soft);

    const core = new Graphics();
    core.ellipse(-0.3, -0.2, coreRx, coreRy);
    core.fill({ color: 0xffffff, alpha: this.isMobile ? coreAlpha * 0.85 : coreAlpha });
    root.addChild(core);

    return root;
  }

  private buildBins(): void {
    const binTexture = Assets.get('binBox');
    const count = MULTIPLIERS.length;
    const lastRow = this.pegsByRow[this.pegsByRow.length - 1] ?? [];

    const pegXs =
      lastRow.length === count
        ? lastRow.map((peg) => peg.x)
        : evenlySpacedXs(count, BIN_LAYOUT.leftX, BIN_LAYOUT.rightX);

    const binWidth =
      pegXs.length > 1
        ? Math.abs(pegXs[1] - pegXs[0]) - BIN_LAYOUT.gap
        : (BIN_LAYOUT.rightX - BIN_LAYOUT.leftX) / count;

    const labelStyle = new TextStyle({
      fill: 0xffffff,
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 14,
      fontWeight: '900',
      align: 'center',
    });

    MULTIPLIERS.forEach((value, index) => {
      const container = new Container();
      const x = pegXs[index];
      const y = BIN_LAYOUT.topY + BIN_LAYOUT.height / 2;
      container.x = x;
      container.y = y;

      const sprite = new Sprite(binTexture);
      sprite.anchor.set(0.5);
      sprite.width = Math.max(18, binWidth);
      sprite.height = BIN_LAYOUT.height;
      container.addChild(sprite);

      const label = new Text({
        text: formatMultiplier(value),
        style: labelStyle,
      });
      label.anchor.set(0.5);
      label.y = -1;
      container.addChild(label);

      this.bins.push({
        index,
        value,
        x,
        y,
        width: binWidth,
        height: BIN_LAYOUT.height,
        container,
        sprite,
        label,
      });

      this.binLayer.addChild(container);
    });
  }
}

/**
 * Every ball exits onto the first-row middle peg, then wanders to the target bin.
 * Right → col+1 on next row, left → same col (classic staggered Plinko).
 * L/R shuffle (same right-count) keeps each ball's route unique.
 */
function planPegRoute(
  rows: number,
  targetSlot: number,
  startCount: number,
  forcedStartCol?: number,
): { startCol: number; directions: boolean[] } {
  const maxStart = startCount - 1;
  const centerStart = Math.floor(maxStart / 2);

  // Always use forced middle when provided (caller resolves unreachable bins).
  let startCol: number;
  if (
    forcedStartCol !== undefined &&
    forcedStartCol >= 0 &&
    forcedStartCol <= maxStart
  ) {
    startCol = forcedStartCol;
  } else {
    const candidates: number[] = [];
    for (let col = 0; col <= maxStart; col++) {
      const rights = targetSlot - col;
      if (rights >= 0 && rights <= rows) {
        candidates.push(col);
      }
    }
    if (candidates.length === 0) {
      startCol = Math.max(0, Math.min(maxStart, targetSlot));
    } else if (candidates.includes(centerStart) && Math.random() < 0.45) {
      startCol = centerStart;
    } else {
      startCol = candidates[Math.floor(Math.random() * candidates.length)];
    }
  }

  const rightsNeeded = Math.max(0, Math.min(rows, targetSlot - startCol));
  const directions: boolean[] = Array.from({ length: rows }, (_, i) => i < rightsNeeded);

  // Fisher–Yates shuffle — keeps right-count, changes the bounce order
  for (let i = directions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = directions[i];
    directions[i] = directions[j];
    directions[j] = tmp;
  }

  return { startCol, directions };
}

function pathFingerprint(startCol: number, directions: boolean[]): string {
  let bits = '';
  for (const goRight of directions) {
    bits += goRight ? '1' : '0';
  }
  return `${startCol}:${bits}`;
}

function evenlySpacedXs(count: number, leftX: number, rightX: number): number[] {
  const width = rightX - leftX;
  const step = width / count;
  return Array.from({ length: count }, (_, i) => leftX + step * (i + 0.5));
}

function formatMultiplier(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

/**
 * Centered staggered triangle that fills the wood play area.
 * Bottom row has 17 pegs — one column path into each multiplier bin.
 */
export function computePegPositions(): PegPosition[] {
  const positions: PegPosition[] = [];
  const { rows, startCount } = PEG_CONFIG;
  const lastRowCount = startCount + rows - 1;
  const bottomSpan = PEG_LAYOUT.bottomHalfWidth * 2;
  const spacing = lastRowCount > 1 ? bottomSpan / (lastRowCount - 1) : 0;
  const rowGap = (PEG_LAYOUT.bottomY - PEG_LAYOUT.topY) / (rows - 1);

  for (let row = 0; row < rows; row++) {
    const pegCount = startCount + row;
    const y = PEG_LAYOUT.topY + row * rowGap;
    const rowWidth = (pegCount - 1) * spacing;
    const startX = PEG_LAYOUT.centerX - rowWidth / 2;

    for (let col = 0; col < pegCount; col++) {
      positions.push({
        row,
        col,
        x: startX + col * spacing,
        y,
      });
    }
  }

  return positions;
}
