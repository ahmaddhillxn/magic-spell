import { Application, Assets, Container } from 'pixi.js';
import { Spine, Physics } from '@esotericsoftware/spine-pixi-v8';
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
 * - background hall cover-fits the stage (floor pinned to bottom)
 * - wizard scales by height and sits mid-stage
 */
export class MagicSpellScene {
  private root?: Container;
  private background?: Spine;
  private main?: Spine;
  private destroyed = false;
  private wizardBusy = false;
  private manualControl = false;
  private pendingResultAnim: string | null = null;
  private resultCompleteCallback?: () => void;
  private resultTimeout: ReturnType<typeof setTimeout> | null = null;

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

    this.playBackgroundIdle();
    this.startWizardIdleLoop();

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
      const { coverPad, anchorY, fitAttachments, offsetY } = MAGIC_SPELL_SPINE_CONFIG.background;
      this.fitCover(
        this.background,
        width,
        height,
        cx,
        height * anchorY,
        coverPad,
        fitAttachments,
        offsetY,
      );
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

  resumeIdle(): void {
    this.clearResultTimeout();
    this.pendingResultAnim = null;
    this.resultCompleteCallback = undefined;
    this.manualControl = false;
    this.wizardBusy = false;
    this.playBackgroundIdle();
    this.startWizardIdleLoop();
  }

  playWin(onComplete?: () => void): void {
    this.playResultSequence(MAGIC_SPELL_ANIMS.win, onComplete);
  }

  playBigWin(onComplete?: () => void): void {
    const outcome =
      this.main && this.hasAnim(this.main, MAGIC_SPELL_ANIMS.win4)
        ? MAGIC_SPELL_ANIMS.win4
        : MAGIC_SPELL_ANIMS.win2;
    this.playResultSequence(outcome, onComplete);
  }

  playLose(onComplete?: () => void): void {
    this.playResultSequence(MAGIC_SPELL_ANIMS.lose, onComplete);
  }

  /** Head + chest anchors as % of stage height for HTML multiplier overlay. */
  getWizardAnchorPercents(stageHeight: number): { headY: number; chestY: number } {
    const fallback = { headY: 14, chestY: 48 };
    if (!this.main || stageHeight <= 0) return fallback;

    const bounds = this.main.getBounds();
    if (!bounds.height) return fallback;

    const headY = ((bounds.y + bounds.height * 0.02) / stageHeight) * 100;
    const chestY = ((bounds.y + bounds.height * 0.38) / stageHeight) * 100;

    return {
      headY: Math.min(Math.max(headY - 4, 8), 30),
      chestY: Math.min(Math.max(chestY, headY + 14), 62),
    };
  }

  private playResultSequence(outcomeAnim: string, onComplete?: () => void): void {
    if (!this.main) {
      onComplete?.();
      return;
    }
    this.manualControl = true;
    this.wizardBusy = true;
    this.resultCompleteCallback = onComplete;
    this.pendingResultAnim = this.hasAnim(this.main, outcomeAnim) ? outcomeAnim : MAGIC_SPELL_ANIMS.wizarding;

    const main = this.main;
    if (this.hasAnim(main, MAGIC_SPELL_ANIMS.wizarding)) {
      main.state.setAnimation(0, MAGIC_SPELL_ANIMS.wizarding, false);
      if (this.hasAnim(main, outcomeAnim)) {
        main.state.addAnimation(0, outcomeAnim, false, 0);
      }
    } else if (this.hasAnim(main, outcomeAnim)) {
      main.state.setAnimation(0, outcomeAnim, false);
    } else {
      this.finishResultSequence();
      return;
    }

    this.armResultTimeout();
  }

  startWizardIdleLoop(): void {
    if (this.manualControl) return;
    this.wizardBusy = false;
    this.playRandomWizardIdle();
  }

  destroy(): void {
    this.destroyed = true;
    this.clearResultTimeout();
    this.pendingResultAnim = null;
    this.resultCompleteCallback = undefined;
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

  /** Cover-fit hall and pin bottom edge to stage bottom. */
  private fitCover(
    spine: Spine,
    canvasW: number,
    canvasH: number,
    cx: number,
    anchorY: number,
    pad: number,
    attachmentNames?: readonly string[],
    offsetY = 0,
  ): void {
    const bounds = this.measureBounds(spine, attachmentNames);
    if (!bounds) {
      spine.position.set(cx, canvasH / 2 + offsetY);
      return;
    }
    const scale = Math.max(canvasW / bounds.width, canvasH / bounds.height) * pad;
    spine.scale.set(scale);
    spine.position.set(
      cx - (bounds.x + bounds.width / 2) * scale,
      anchorY - (bounds.y + bounds.height) * scale + offsetY,
    );
  }

  /** Size wizard by height and center on anchor point. */
  private fitByHeight(spine: Spine, targetHeight: number, cx: number, anchorY: number): void {
    const bounds = this.measureBounds(spine);
    if (!bounds?.height) {
      spine.position.set(cx, anchorY);
      return;
    }
    const scale = targetHeight / bounds.height;
    spine.scale.set(scale);
    spine.position.set(
      cx - (bounds.x + bounds.width / 2) * scale,
      anchorY - (bounds.y + bounds.height / 2) * scale,
    );
  }

  private measureBounds(
    spine: Spine,
    attachmentNames?: readonly string[],
  ): { x: number; y: number; width: number; height: number } | null {
    const prevX = spine.scale.x;
    const prevY = spine.scale.y;
    spine.scale.set(1);
    spine.skeleton.setupPose();
    spine.skeleton.updateWorldTransform(Physics.none);

    const named = attachmentNames?.length ? this.measureAttachmentBounds(spine, attachmentNames) : null;
    const bounds = named ?? spine.getLocalBounds();
    spine.scale.set(prevX, prevY);
    if (!bounds.width || !bounds.height) return null;
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  }

  private measureAttachmentBounds(
    spine: Spine,
    names: readonly string[],
  ): { x: number; y: number; width: number; height: number } | null {
    const wanted = new Set(names);
    const slots = spine.skeleton.slots;
    const saved = slots.map((slot) => slot.pose.getAttachment());

    for (const slot of slots) {
      const attachment = slot.pose.getAttachment();
      const keep =
        !!attachment && (wanted.has(attachment.name) || wanted.has(slot.data.name));
      if (!keep) slot.pose.setAttachment(null);
    }

    spine.skeleton.updateWorldTransform(Physics.none);
    const bounds = spine.getLocalBounds();
    slots.forEach((slot, i) => slot.pose.setAttachment(saved[i]));
    spine.skeleton.updateWorldTransform(Physics.none);

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
    const finished = entry.animation?.name ?? '';

    if (this.resultCompleteCallback || this.pendingResultAnim) {
      if (finished === MAGIC_SPELL_ANIMS.wizarding && this.pendingResultAnim !== MAGIC_SPELL_ANIMS.wizarding) {
        return;
      }
      this.finishResultSequence();
      return;
    }

    if (this.manualControl) return;

    if (this.wizardBusy) {
      this.startWizardIdleLoop();
      return;
    }

    this.playRandomWizardIdle();
  }

  private armResultTimeout(): void {
    this.clearResultTimeout();
    const wizarding = this.main?.skeleton.data.findAnimation(MAGIC_SPELL_ANIMS.wizarding);
    const outcome = this.pendingResultAnim
      ? this.main?.skeleton.data.findAnimation(this.pendingResultAnim)
      : null;
    const durationMs = Math.round(((wizarding?.duration ?? 0) + (outcome?.duration ?? 0)) * 1000);
    this.resultTimeout = setTimeout(() => this.finishResultSequence(), Math.max(durationMs + 180, 900));
  }

  private finishResultSequence(): void {
    if (!this.pendingResultAnim && !this.resultCompleteCallback) return;
    this.clearResultTimeout();
    this.pendingResultAnim = null;
    const callback = this.resultCompleteCallback;
    this.resultCompleteCallback = undefined;
    callback?.();
  }

  private clearResultTimeout(): void {
    if (this.resultTimeout == null) return;
    clearTimeout(this.resultTimeout);
    this.resultTimeout = null;
  }

  private getAnimations(spine: Spine): string[] {
    return spine.skeleton.data.animations.map((a) => a.name);
  }

  private hasAnim(spine: Spine, name: string): boolean {
    return !!spine.skeleton.data.findAnimation(name);
  }
}
