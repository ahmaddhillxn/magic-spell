import { Application, Assets } from 'pixi.js';
import { Spine } from '@esotericsoftware/spine-pixi-v8';
import type { TrackEntry } from '@esotericsoftware/spine-pixi-v8';
import { GAME_ASSETS } from '../components/game-assets';

/** Spine character layout — tweak scale / position here */
export const PLINKO_SPINE_CONFIG = {
  /**
   * Base display scale at the matching referenceWidth.
   * Actual scale = baseScale * (canvasWidth / referenceWidth) — grows with width.
   */
  landscapeScale: 0.13,
  landscapeReferenceWidth: 672,
  portraitScale: 0.06,
  portraitReferenceWidth: 345,
  /** Anchor within the canvas (0–1) */
  anchorX: 0.55,
  anchorY: 0.92,
  /** Portrait: sit in the left peek zone (board covers most of the canvas) */
  portraitAnchorX: 0.22,
  portraitAnchorY: 0.98,
  /** Extra horizontal shift as fraction of canvas width */
  translateX: 0.03,
  portraitTranslateX: 0,
  /** Min / max clamp for computed / manual scale */
  minScale: 0.02,
  maxScale: 0.5,
  defaultAnimation: 'Idle_main',
} as const;

/** Exact Spine animation names from harleysPlinko.skel */
export const PLINKO_ANIMS = {
  idleMain: 'Idle_main',
  idle2: 'Idle_2',
  happyBall3: 'Happy_Ball_3',
  happyBlink: 'Happy_blink',
  laughing2: 'Laughing_2',
  win1: 'Win_1',
  win2: 'Win_2',
} as const;

/**
 * No-bet loop: Idle_main → Happy_Ball_3 → repeat.
 * On bin land: play reaction once, then return to idle loop.
 */
export const PLINKO_REACTION_BY_MULTIPLIER: Readonly<Record<number, string>> = {
  0.2: PLINKO_ANIMS.laughing2,
  0.7: PLINKO_ANIMS.idle2,
  1: PLINKO_ANIMS.idle2,
  1.2: PLINKO_ANIMS.happyBlink,
  2.3: PLINKO_ANIMS.happyBlink,
  4.5: PLINKO_ANIMS.win1,
  12: PLINKO_ANIMS.win1,
  61: PLINKO_ANIMS.win2,
  118: PLINKO_ANIMS.win2,
};

export const PLINKO_SPINE_ASSETS = {
  skeletonAlias: 'harleysPlinkoSkel',
  atlasAlias: 'harleysPlinkoAtlas',
  skeletonSrc: GAME_ASSETS.spine.harleysPlinkoSkel,
  atlasSrc: GAME_ASSETS.spine.harleysPlinkoAtlas,
} as const;

type IdlePhase = 'idle' | 'happy';

export class PlinkoScene {
  private spine?: Spine;
  private scale: number = PLINKO_SPINE_CONFIG.landscapeScale;
  /** When true, layout() computes scale from canvas width + orientation */
  private autoScale = true;
  private idlePhase: IdlePhase = 'idle';
  private inReaction = false;
  private readonly onComplete = (entry: TrackEntry): void => {
    this.handleTrackComplete(entry);
  };

  constructor(private readonly app: Application) {}

  async init(): Promise<void> {
    await Assets.load([
      {
        alias: PLINKO_SPINE_ASSETS.skeletonAlias,
        src: PLINKO_SPINE_ASSETS.skeletonSrc,
      },
      {
        alias: PLINKO_SPINE_ASSETS.atlasAlias,
        src: PLINKO_SPINE_ASSETS.atlasSrc,
      },
    ]);

    // skeleton scale = 1; display size controlled only via setScale() / layout()
    const spine = Spine.from({
      skeleton: PLINKO_SPINE_ASSETS.skeletonAlias,
      atlas: PLINKO_SPINE_ASSETS.atlasAlias,
      scale: 1,
    });

    this.app.stage.addChild(spine);
    this.spine = spine;
    spine.state.addListener({ complete: this.onComplete });
    this.layout();
    this.startIdleLoop();
  }

  getAnimations(): string[] {
    return this.spine?.skeleton.data.animations.map((a) => a.name) ?? [];
  }

  getScale(): number {
    return this.scale;
  }

  /** Change spine display scale — managed from this scene / constants. */
  setScale(scale: number): void {
    this.autoScale = false;
    this.scale = this.clampScale(scale);
    this.applyScale();
    this.layout();
  }

  play(name: string, loop = true): void {
    if (!this.spine) return;
    if (!this.hasAnim(name)) return;
    this.spine.state.setAnimation(0, name, loop);
  }

  /** Idle_main ↔ Happy_Ball_3 while no reaction is playing. */
  startIdleLoop(): void {
    this.inReaction = false;
    this.idlePhase = 'idle';
    this.play(PLINKO_ANIMS.idleMain, false);
  }

  /** Play a one-shot reaction for the landed multiplier, then resume idle loop. */
  playForMultiplier(value: number): void {
    const name = PLINKO_REACTION_BY_MULTIPLIER[value];
    if (!name || !this.hasAnim(name)) {
      this.startIdleLoop();
      return;
    }
    this.inReaction = true;
    this.play(name, false);
  }

  stop(): void {
    if (!this.spine) return;
    this.inReaction = false;
    this.spine.state.clearTracks();
    this.spine.skeleton.setToSetupPose();
  }

  layout(): void {
    const spine = this.spine;
    if (!spine) return;

    const { width, height } = this.app.screen;
    // Canvas host is often square — use viewport orientation, not canvas aspect
    const isPortrait = window.matchMedia('(orientation: portrait)').matches;

    if (this.autoScale) {
      this.scale = this.scaleForWidth(width, isPortrait);
      this.applyScale();
    }

    if (isPortrait) {
      spine.x =
        width *
        (PLINKO_SPINE_CONFIG.portraitAnchorX + PLINKO_SPINE_CONFIG.portraitTranslateX);
      spine.y = height * PLINKO_SPINE_CONFIG.portraitAnchorY;
    } else {
      spine.x = width * (PLINKO_SPINE_CONFIG.anchorX + PLINKO_SPINE_CONFIG.translateX);
      spine.y = height * PLINKO_SPINE_CONFIG.anchorY;
    }
  }

  destroy(): void {
    const spine = this.spine;
    this.spine = undefined;
    this.inReaction = false;
    if (!spine) return;

    spine.state.removeListener({ complete: this.onComplete });
    spine.parent?.removeChild(spine);
    try {
      spine.destroy({ children: true });
    } catch {
      /* Pixi can throw during Angular HMR teardown */
    }
  }

  private handleTrackComplete(entry: TrackEntry): void {
    if (!this.spine || entry.trackIndex !== 0) return;
    const finished = entry.animation?.name;

    if (this.inReaction) {
      this.startIdleLoop();
      return;
    }

    // Idle cycle: Idle_main → Happy_Ball_3 → Idle_main → …
    if (finished === PLINKO_ANIMS.idleMain || this.idlePhase === 'idle') {
      this.idlePhase = 'happy';
      this.play(PLINKO_ANIMS.happyBall3, false);
      return;
    }

    this.idlePhase = 'idle';
    this.play(PLINKO_ANIMS.idleMain, false);
  }

  private hasAnim(name: string): boolean {
    return !!this.spine?.skeleton.data.findAnimation(name);
  }

  /** Scale grows/shrinks with canvas width relative to the orientation reference. */
  private scaleForWidth(width: number, isPortrait: boolean): number {
    if (width <= 0) {
      return isPortrait
        ? PLINKO_SPINE_CONFIG.portraitScale
        : PLINKO_SPINE_CONFIG.landscapeScale;
    }

    const base = isPortrait
      ? PLINKO_SPINE_CONFIG.portraitScale
      : PLINKO_SPINE_CONFIG.landscapeScale;
    const reference = isPortrait
      ? PLINKO_SPINE_CONFIG.portraitReferenceWidth
      : PLINKO_SPINE_CONFIG.landscapeReferenceWidth;

    return this.clampScale(base * (width / reference));
  }

  private clampScale(scale: number): number {
    return Math.min(
      PLINKO_SPINE_CONFIG.maxScale,
      Math.max(PLINKO_SPINE_CONFIG.minScale, scale),
    );
  }

  private applyScale(): void {
    this.spine?.scale.set(this.scale);
  }
}
