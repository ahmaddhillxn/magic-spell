import { Application, Assets, Container } from 'pixi.js';
import { Spine } from '@esotericsoftware/spine-pixi-v8';
import type { TrackEntry } from '@esotericsoftware/spine-pixi-v8';
import {
  GAME_ASSETS,
  MAGIC_SPELL_ANIMS,
  MAGIC_SPELL_SPINE_CONFIG,
} from '../game-assets';

const BG = {
  skel: 'magicSpellBgSkel',
  atlas: 'magicSpellBgAtlas',
} as const;

const MAIN = {
  skel: 'magicSpellMainSkel',
  atlas: 'magicSpellMainAtlas',
} as const;

/**
 * Dual-spine scene matching live Magic Spell / Vimplay:
 * - background spine loops behind (cover-fit to canvas)
 * - wizard sits in front with weighted idle cycle
 */
export class MagicSpellScene {
  private root?: Container;
  private background?: Spine;
  private main?: Spine;
  private destroyed = false;
  private wizardBusy = false;
  /** When true, idle auto-cycle is paused (debug controller). */
  private manualControl = false;

  private readonly onWizardComplete = (entry: TrackEntry): void => {
    this.handleWizardComplete(entry);
  };

  constructor(private readonly app: Application) {}

  async init(): Promise<void> {
    await Assets.load([
      { alias: BG.skel, src: GAME_ASSETS.spine.backgroundSkel },
      { alias: BG.atlas, src: GAME_ASSETS.spine.backgroundAtlas },
      { alias: MAIN.skel, src: GAME_ASSETS.spine.mainSkel },
      { alias: MAIN.atlas, src: GAME_ASSETS.spine.mainAtlas },
    ]);

    if (this.destroyed) return;

    const root = new Container();
    root.sortableChildren = true;
    this.app.stage.addChild(root);
    this.root = root;

    const background = Spine.from({
      skeleton: BG.skel,
      atlas: BG.atlas,
      scale: 1,
      autoUpdate: true,
    });
    background.zIndex = 0;
    root.addChild(background);
    this.background = background;

    const main = Spine.from({
      skeleton: MAIN.skel,
      atlas: MAIN.atlas,
      scale: 1,
      autoUpdate: true,
    });
    main.zIndex = 1;
    root.addChild(main);
    this.main = main;
    main.state.addListener({ complete: this.onWizardComplete });

    // Pose once so getLocalBounds() is valid before first layout
    this.playBackgroundIdle();
    this.startWizardIdleLoop();

    // Layout now + next frame once Pixi has real screen size
    this.layout();
    this.app.ticker.addOnce(() => this.layout());

    console.info('[MagicSpellScene] ready', {
      bgAnims: this.getAnimations(background),
      mainAnims: this.getAnimations(main),
      screen: { w: this.app.screen.width, h: this.app.screen.height },
    });
  }

  layout(): void {
    const { width, height } = this.app.screen;
    if (width <= 0 || height <= 0) return;

    const cx = width / 2;

    if (this.background) {
      this.fitCover(this.background, width, height, cx, height / 2, MAGIC_SPELL_SPINE_CONFIG.background.coverPad);
    }

    if (this.main) {
      const { heightRatio, anchorY } = MAGIC_SPELL_SPINE_CONFIG.main;
      this.fitByHeight(this.main, height * heightRatio, cx, height * anchorY);
    }
  }

  getBackgroundAnimations(): string[] {
    return this.background ? this.getAnimations(this.background) : [];
  }

  getWizardAnimations(): string[] {
    return this.main ? this.getAnimations(this.main) : [];
  }

  playWizard(name: string, loop = false): void {
    if (!this.main || !this.hasAnim(this.main, name)) return;
    this.manualControl = true;
    this.wizardBusy = !loop;
    this.main.state.setAnimation(0, name, loop);
  }

  playBackground(name: string, loop = true): void {
    if (!this.background || !this.hasAnim(this.background, name)) return;
    this.background.state.setAnimation(0, name, loop);
  }

  /** Resume automatic idle cycle after manual testing. */
  resumeIdle(): void {
    this.manualControl = false;
    this.wizardBusy = false;
    this.playBackgroundIdle();
    this.startWizardIdleLoop();
  }

  playWin(): void {
    this.playWizard(MAGIC_SPELL_ANIMS.wizarding, false);
  }

  playLose(): void {
    this.playWizard(MAGIC_SPELL_ANIMS.wizarding, false);
  }

  startWizardIdleLoop(): void {
    if (this.manualControl) return;
    this.wizardBusy = false;
    this.playRandomWizardIdle();
  }

  destroy(): void {
    this.destroyed = true;
    const main = this.main;
    const background = this.background;
    const root = this.root;
    this.main = undefined;
    this.background = undefined;
    this.root = undefined;

    if (main) {
      main.state.removeListener({ complete: this.onWizardComplete });
      main.parent?.removeChild(main);
      try {
        main.destroy({ children: true });
      } catch {
        /* HMR teardown */
      }
    }

    if (background) {
      background.parent?.removeChild(background);
      try {
        background.destroy({ children: true });
      } catch {
        /* HMR teardown */
      }
    }

    root?.destroy({ children: true });
  }

  /** Fill stage like live Magic Spell background. */
  private fitCover(
    spine: Spine,
    canvasW: number,
    canvasH: number,
    cx: number,
    cy: number,
    pad: number,
  ): void {
    const bounds = this.measureBounds(spine);
    if (!bounds) {
      spine.position.set(cx, cy);
      return;
    }
    const scale = Math.max(canvasW / bounds.width, canvasH / bounds.height) * pad;
    spine.scale.set(scale);
    spine.position.set(
      cx - (bounds.x + bounds.width / 2) * scale,
      cy - (bounds.y + bounds.height / 2) * scale,
    );
  }

  /** Size wizard by height and pin visual center to an anchor point. */
  private fitByHeight(spine: Spine, targetHeight: number, cx: number, cy: number): void {
    const bounds = this.measureBounds(spine);
    if (!bounds || !bounds.height) {
      spine.position.set(cx, cy);
      return;
    }
    const scale = targetHeight / bounds.height;
    spine.scale.set(scale);
    spine.position.set(
      cx - (bounds.x + bounds.width / 2) * scale,
      cy - (bounds.y + bounds.height / 2) * scale,
    );
  }

  private measureBounds(spine: Spine): { x: number; y: number; width: number; height: number } | null {
    const prevX = spine.scale.x;
    const prevY = spine.scale.y;
    spine.scale.set(1);
    const bounds = spine.getLocalBounds();
    spine.scale.set(prevX, prevY);
    if (!bounds.width || !bounds.height) return null;
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  }

  private resolveBackgroundIdle(spine: Spine): string | undefined {
    const preferred = [
      MAGIC_SPELL_SPINE_CONFIG.background.idleAnimation,
      'background_animation',
      'Background_animation',
    ];
    return (
      preferred.find((n) => this.hasAnim(spine, n)) ??
      this.getAnimations(spine).find((n) => /background/i.test(n))
    );
  }

  private playBackgroundIdle(): void {
    const spine = this.background;
    if (!spine) return;
    const name = this.resolveBackgroundIdle(spine);
    if (!name) {
      console.warn('[MagicSpellScene] no background idle animation found');
      return;
    }
    spine.state.setAnimation(0, name, true);
  }

  private playRandomWizardIdle(): void {
    const spine = this.main;
    if (!spine || this.wizardBusy) return;

    const configured = MAGIC_SPELL_SPINE_CONFIG.main.idleAnimations.filter((a) =>
      this.hasAnim(spine, a.name),
    );
    let name: string | undefined;

    if (configured.length) {
      const roll = Math.random();
      let acc = 0;
      for (const entry of configured) {
        acc += entry.probability;
        if (roll <= acc) {
          name = entry.name;
          break;
        }
      }
      name ??= configured[configured.length - 1]?.name;
    } else {
      name = MAGIC_SPELL_ANIMS.wizardIdle.find((n) => this.hasAnim(spine, n));
    }

    if (!name) {
      console.warn('[MagicSpellScene] no wizard idle animation found');
      return;
    }
    spine.state.setAnimation(0, name, false);
  }

  private handleWizardComplete(entry: TrackEntry): void {
    if (!this.main || entry.trackIndex !== 0) return;
    if (this.manualControl) {
      // Stay on last frame / don't auto-advance while testing
      return;
    }
    const finished = entry.animation?.name ?? '';

    if (this.wizardBusy) {
      if (finished === MAGIC_SPELL_ANIMS.wizarding) {
        const next = this.hasAnim(this.main, MAGIC_SPELL_ANIMS.win)
          ? MAGIC_SPELL_ANIMS.win
          : MAGIC_SPELL_ANIMS.lose;
        if (this.hasAnim(this.main, next)) {
          this.main.state.setAnimation(0, next, false);
          return;
        }
      }
      this.startWizardIdleLoop();
      return;
    }

    this.playRandomWizardIdle();
  }

  private getAnimations(spine: Spine): string[] {
    return spine.skeleton.data.animations.map((a) => a.name);
  }

  private hasAnim(spine: Spine, name: string): boolean {
    return !!spine.skeleton.data.findAnimation(name);
  }
}
