import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { Application } from 'pixi.js';
import { MagicSpellScene } from '../scene-manager/magic-spell-scene';
import { SoundScene } from '../scene-manager/sound-scene';
import { Toggle } from '../services/toggle';
import { BetAmountService } from '../services/bet-amount-service';
import { BetHistoryModal } from '../modals/bet-history-modal/bet-history-modal';
import { GuidenessModal } from '../modals/guideness-modal/guideness-modal';
import { BetAmount } from '../modals/bet-amount/bet-amount';
import { AutoplayModal } from '../modals/autoplay-modal/autoplay-modal';
import { GAME_ASSETS, GAME_TARGET_FPS } from '../game-assets';
import { BetHistoryService } from '../services/history';
import { Api } from '../services/api';
import { ResourceLoaderService } from '../services/resource-loader';

type ResultAnimationPhase =
  | 'idle'
  | 'counting'
  | 'resultLocked'
  | 'resultDropping'
  | 'winPopupPlaying'
  | 'reset';

@Component({
  selector: 'app-game-wrapper',
  imports: [BetHistoryModal, GuidenessModal, BetAmount, AutoplayModal],
  templateUrl: './game-wrapper.html',
  styleUrl: './game-wrapper.css',
})
export class GameWrapper implements AfterViewInit, OnDestroy {
  @ViewChild('spineHost', { static: true }) spineHost!: ElementRef<HTMLDivElement>;

  readonly assets = GAME_ASSETS;
  readonly toggle = inject(Toggle);
  readonly betAmount = inject(BetAmountService);
  readonly betHistory = inject(BetHistoryService);
  readonly api = inject(Api);
  readonly loader = inject(ResourceLoaderService);
  readonly guideOpen = signal(false);

  ready = false;
  error = '';
  showAnimPanel = true;
  loop = false;
  currentWizardAnim = '';
  currentBgAnim = '';
  backgroundAnims: string[] = [];
  wizardAnims: string[] = [];

  displayAmount = '0.10';
  displayPayout = '2.00x';
  payout = 2;
  readonly maxRecentMultipliers = 10;
  recentMultipliers = [20.59, 1.04, 2.25, 2.06, 5.8, 362.88, 1.34, 1.69, 2.69, 3.97];
  liveMultiplier = 1;
  liveMultiplierVisible = false;
  multiplierTone: 'neutral' | 'win' | 'lose' = 'neutral';
  winPopupVisible = false;
  winAmount = 0;
  roundRunning = false;
  animationPhase: ResultAnimationPhase = 'idle';
  prefersReducedMotion = false;
  multiplierHeadY = '14%';
  multiplierChestY = '48%';

  private app?: Application;
  private scene?: MagicSpellScene;
  private resizeObserver?: ResizeObserver;
  private roundAnimationFrame: number | null = null;
  private countingInterval: ReturnType<typeof setInterval> | null = null;
  private readonly phaseTimers: ReturnType<typeof setTimeout>[] = [];
  private fallbackResultIndex = 0;
  private soundScene!: SoundScene;
  private adjustRepeatDelayTimer: ReturnType<typeof setTimeout> | null = null;
  private adjustRepeatInterval: ReturnType<typeof setInterval> | null = null;
  private adjustRepeatPointerId: number | null = null;

  constructor(private readonly cdr: ChangeDetectorRef) {
    this.displayAmount = this.betAmount.betAmount().toFixed(2);
    this.prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.soundScene = new SoundScene(
      this.loader,
      () => this.toggle.isSoundOn(),
      () => this.loader.isTabAudible(),
    );
  }

  async ngAfterViewInit(): Promise<void> {
    const host = this.spineHost.nativeElement;
    const isCoarse =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(pointer: coarse)').matches
        : false;
    const isIOS =
      /iP(ad|hone|od)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const dpr = window.devicePixelRatio || 1;
    const resolution = Math.min(Math.max(dpr, 1), isIOS || isCoarse ? 1.25 : 2);

    try {
      const app = new Application();
      await app.init({
        backgroundColor: 0x0b0614,
        backgroundAlpha: 1,
        antialias: !(isIOS || isCoarse),
        resolution,
        autoDensity: true,
        resizeTo: host,
        powerPreference: 'high-performance',
        preference: 'webgl',
      });

      app.ticker.maxFPS = GAME_TARGET_FPS;
      app.ticker.minFPS = GAME_TARGET_FPS;

      app.canvas.classList.add('sc-jObViz', 'spine-canvas');
      host.appendChild(app.canvas);
      this.app = app;
      app.resize();

      const scene = new MagicSpellScene(app);
      await scene.init();
      this.scene = scene;
      this.ready = true;
      this.backgroundAnims = scene.getBackgroundAnimations();
      this.wizardAnims = scene.getWizardAnimations();
      this.currentBgAnim = this.backgroundAnims[0] ?? '';
      this.currentWizardAnim = 'idle-loop';

      this.resizeObserver = new ResizeObserver(() => {
        this.app?.resize();
        this.scene?.layout();
        this.updateMultiplierAnchors();
      });
      this.resizeObserver.observe(host);
      requestAnimationFrame(() => {
        this.app?.resize();
        this.scene?.layout();
        this.updateMultiplierAnchors();
      });
      this.loader.markSceneReady();
      this.cdr.detectChanges();
    } catch (err) {
      console.error('[GameWrapper] spine init failed', err);
      this.error = err instanceof Error ? err.message : 'Failed to load spine';
      this.loader.markSceneReady();
      this.cdr.detectChanges();
    }
  }

  @HostListener('document:pointerup', ['$event'])
  @HostListener('document:pointercancel', ['$event'])
  onDocumentPointerUp(event: PointerEvent): void {
    if (
      this.adjustRepeatPointerId !== null &&
      event.pointerId !== this.adjustRepeatPointerId
    ) {
      return;
    }
    this.adjustRepeatPointerId = null;
    this.stopAdjustRepeat();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    this.soundScene.markInteraction();
    const target = event.target as HTMLElement | null;
    if (target?.closest('.menu-root')) return;
    if (target?.closest('app-bet-history-modal, app-guideness-modal')) return;
    if (this.toggle.isOpenMenu()) this.toggle.closeMenu();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.hidden) {
      this.soundScene.pauseAll();
      return;
    }
    if (this.toggle.isSoundOn() && this.soundScene.hasUserInteracted) {
      this.soundScene.startBackground();
    }
  }

  @HostListener('window:pagehide')
  onPageHide(): void {
    this.soundScene.pauseAll();
  }

  toggleMenu(): void {
    this.toggle.toggleMenu();
  }

  openHistory(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.toggle.openBetHistory();
  }

  openGuide(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.toggle.closeMenu();
    this.guideOpen.set(true);
    this.toggle.openGameGuide();
  }

  closeGuide(): void {
    this.guideOpen.set(false);
    this.toggle.closeGameGuide();
  }

  openBetAmount(): void {
    this.soundScene.playUiClick();
    this.betAmount.open();
  }

  onBetApplied(amount: number): void {
    this.displayAmount = amount.toFixed(2);
  }

  toggleSound(): void {
    this.soundScene.markInteraction();
    this.toggle.markGameInteraction();
    this.toggle.toggleMusicTrigger();
    if (this.toggle.isSoundOn()) {
      this.soundScene.startBackground();
      return;
    }
    this.soundScene.stopBackground();
  }

  adjustAmount(delta: number, playSound = true): void {
    if (playSound) this.soundScene.playUiClick();
    const settings = this.betAmount.getStakeSettings(this.toggle.currency());
    const next = Math.min(
      settings.maxBet,
      Math.max(settings.minBet, +(this.betAmount.betAmount() + delta).toFixed(2)),
    );
    this.betAmount.setBetAmount(next);
    this.displayAmount = next.toFixed(2);
    this.cdr.detectChanges();
  }

  adjustPayout(delta: number, playSound = true): void {
    if (playSound) this.soundScene.playUiClick();
    this.payout = Math.min(100, Math.max(1.01, +(this.payout + delta).toFixed(2)));
    this.displayPayout = `${this.payout.toFixed(2)}x`;
    this.cdr.detectChanges();
  }

  startAmountAdjust(delta: number, event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.adjustRepeatPointerId = event.pointerId;
    this.adjustAmount(delta);
    this.beginAdjustRepeat(() => this.adjustAmount(delta, false), event);
  }

  startPayoutAdjust(delta: number, event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.adjustRepeatPointerId = event.pointerId;
    this.adjustPayout(delta);
    this.beginAdjustRepeat(() => this.adjustPayout(delta, false), event);
  }

  stopAdjustRepeat(): void {
    if (this.adjustRepeatDelayTimer !== null) {
      clearTimeout(this.adjustRepeatDelayTimer);
      this.adjustRepeatDelayTimer = null;
    }
    if (this.adjustRepeatInterval !== null) {
      clearInterval(this.adjustRepeatInterval);
      this.adjustRepeatInterval = null;
    }
  }

  private beginAdjustRepeat(apply: () => void, event: PointerEvent): void {
    this.stopAdjustRepeat();
    this.soundScene.markInteraction();
    const target = event.currentTarget;
    if (target instanceof HTMLElement && target.setPointerCapture) {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Ignore if pointer capture is unavailable.
      }
    }

    this.adjustRepeatDelayTimer = setTimeout(() => {
      this.adjustRepeatDelayTimer = null;
      apply();
      this.adjustRepeatInterval = setInterval(apply, 75);
    }, 280);
  }

  get liveMultiplierLabel(): string {
    return `${this.liveMultiplier.toFixed(2)} x`;
  }

  get isMultiplierAtChest(): boolean {
    return this.animationPhase === 'resultLocked' || this.animationPhase === 'winPopupPlaying';
  }

  get winAmountLabel(): string {
    return this.winAmount.toFixed(2).replace(/\.?0+$/, '');
  }

  resultIsWin(multiplier: number): boolean {
    return multiplier >= this.payout;
  }

  placeBet(): void {
    if (this.roundRunning) return;
    this.soundScene.playBetSequence();
    this.soundScene.markInteraction();
    const result = this.resolveRoundResult();
    this.playResultAnimation(result.multiplier, result.winAmount, 'auto');
  }

  demoWin(): void {
    if (this.roundRunning) return;
    this.updateMultiplierAnchors();
    const winAmount = +(this.betAmount.betAmount() * this.payout).toFixed(2);
    this.playResultAnimation(3.79, winAmount, 'win');
  }

  demoWinBig(): void {
    if (this.roundRunning) return;
    this.updateMultiplierAnchors();
    const winAmount = +(this.betAmount.betAmount() * this.payout).toFixed(2);
    this.playResultAnimation(20.59, winAmount, 'winBig');
  }

  demoLose(): void {
    if (this.roundRunning) return;
    this.updateMultiplierAnchors();
    this.playResultAnimation(1.34, 0, 'lose');
  }

  playWizard(name: string): void {
    this.currentWizardAnim = name;
    this.scene?.playWizard(name, this.loop);
  }

  playBackground(name: string): void {
    this.currentBgAnim = name;
    this.scene?.playBackground(name, true);
  }

  toggleLoop(): void {
    this.loop = !this.loop;
  }

  resumeIdle(): void {
    this.currentWizardAnim = 'idle-loop';
    this.scene?.resumeIdle();
  }

  togglePanel(): void {
    this.showAnimPanel = !this.showAnimPanel;
  }

  ngOnDestroy(): void {
    this.stopAdjustRepeat();
    this.clearRoundTimers();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.scene?.destroy();
    this.scene = undefined;
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = undefined;
    }
    this.soundScene.destroy();
  }

  private clearRoundTimers(): void {
    if (this.roundAnimationFrame !== null) {
      cancelAnimationFrame(this.roundAnimationFrame);
      this.roundAnimationFrame = null;
    }
    if (this.countingInterval !== null) {
      clearInterval(this.countingInterval);
      this.countingInterval = null;
    }
    this.soundScene.cancelPendingRoundSounds();
    for (const timer of this.phaseTimers) {
      clearTimeout(timer);
    }
    this.phaseTimers.length = 0;
  }

  private createRoundId(): string {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
    } catch {
      // Fallback below for older Safari / non-secure contexts.
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private forceFinishRoundIfStuck(): void {
    if (!this.roundRunning) return;
    this.clearRoundTimers();
    this.winPopupVisible = false;
    this.liveMultiplierVisible = false;
    this.multiplierTone = 'neutral';
    this.animationPhase = 'idle';
    this.roundRunning = false;
    this.scene?.resumeIdle();
    this.cdr.detectChanges();
  }

  private playResultAnimation(
    targetMultiplier: number,
    computedWinAmount: number,
    mode: 'auto' | 'win' | 'winBig' | 'lose' = 'auto',
  ): void {
    this.updateMultiplierAnchors();
    const betAmount = this.betAmount.betAmount();
    const didWin =
      mode === 'win' || mode === 'winBig' || (mode === 'auto' && targetMultiplier >= this.payout);
    const winAmount = didWin ? computedWinAmount : 0;
    const countingMs = this.prefersReducedMotion ? 120 : 600;
    const dropMs = this.prefersReducedMotion ? 120 : 2000;
    const dropDelayMs = this.prefersReducedMotion ? 60 : 90;
    const popupCycleMs = this.prefersReducedMotion ? 420 : 2000;
    const dropEndMs = dropDelayMs + dropMs;
    const popupStartMs = dropDelayMs + Math.round(dropMs * 0.25);

    this.clearRoundTimers();
    this.roundRunning = true;
    this.liveMultiplierVisible = true;
    this.winPopupVisible = false;
    this.liveMultiplier = 1;
    this.multiplierTone = 'neutral';
    this.animationPhase = 'counting';
    if (mode === 'winBig') this.scene?.playBigWin(() => this.unlockBetAfterSpine());
    else if (didWin) this.scene?.playWin(() => this.unlockBetAfterSpine());
    else this.scene?.playLose(() => this.unlockBetAfterSpine());
    this.cdr.detectChanges();

    const maxRoundMs =
      countingMs +
      (didWin ? popupStartMs + popupCycleMs : dropEndMs + 320) +
      900;
    this.queuePhase(() => this.forceFinishRoundIfStuck(), maxRoundMs);

    const onCountingComplete = (): void => {
      if (this.countingInterval !== null) {
        clearInterval(this.countingInterval);
        this.countingInterval = null;
      }

      this.liveMultiplier = targetMultiplier;
      this.multiplierTone = 'neutral';
      this.animationPhase = 'resultLocked';
      this.recentMultipliers = [targetMultiplier, ...this.recentMultipliers].slice(
        0,
        this.maxRecentMultipliers,
      );

      try {
        this.betHistory.emitSpinResult({
          id: this.createRoundId(),
          time: new Date(),
          betAmount,
          multiplier: targetMultiplier,
          winAmount,
          win: didWin,
          payout: this.payout,
        });
      } catch (error) {
        console.warn('[GameWrapper] failed to persist spin result', error);
      }

      this.soundScene.playRoundResult(didWin);
      this.cdr.detectChanges();

      this.queuePhase(() => {
        this.animationPhase = 'resultDropping';
        this.multiplierTone = didWin ? 'win' : 'lose';
        this.cdr.detectChanges();
      }, dropDelayMs);

      if (didWin) {
        this.queuePhase(() => {
          this.winAmount = winAmount;
          this.winPopupVisible = true;
          this.cdr.detectChanges();
        }, popupStartMs);

        this.queuePhase(() => {
          this.animationPhase = 'winPopupPlaying';
          this.cdr.detectChanges();
        }, dropEndMs);

        this.queuePhase(() => this.finishWinRound(), popupStartMs + popupCycleMs);
      } else {
        this.queuePhase(() => {
          this.animationPhase = 'resultLocked';
          this.cdr.detectChanges();
        }, dropEndMs);

        this.queuePhase(
          () => this.resetResultLayer(),
          dropEndMs + (this.prefersReducedMotion ? 160 : 320),
        );
      }
    };

    const tickMs = 32;
    let elapsed = 0;
    let countingDone = false;
    this.countingInterval = setInterval(() => {
      elapsed += tickMs;
      const progress = Math.min(1, elapsed / countingMs);
      const eased = 1 - Math.pow(1 - progress, 2.7);
      this.liveMultiplier = 1 + (targetMultiplier - 1) * eased;
      this.cdr.detectChanges();
      if (progress >= 1 && !countingDone) {
        countingDone = true;
        onCountingComplete();
      }
    }, tickMs);
  }

  private resolveRoundResult(): { multiplier: number; winAmount: number } {
    const fromApi = this.extractResultFromUnknown(this.api.getApiResult());
    if (fromApi) return fromApi;

    // Fallback only when no backend/current-round result is available in project state.
    const fallbackMultipliers = [1.04, 1.34, 1.66, 2.06, 2.25, 5.8, 12.32, 20.59, 36.88];
    const multiplier = fallbackMultipliers[this.fallbackResultIndex % fallbackMultipliers.length] ?? 2.06;
    this.fallbackResultIndex += 1;
    const winAmount = +(this.betAmount.betAmount() * this.payout).toFixed(2);
    return { multiplier, winAmount };
  }

  private extractResultFromUnknown(source: unknown): { multiplier: number; winAmount: number } | null {
    if (!source || typeof source !== 'object') return null;
    const candidate = source as Record<string, unknown>;
    const multiplier = this.readNumberCandidate(candidate, [
      'multiplier',
      'resultMultiplier',
      'targetMultiplier',
      'payoutMultiplier',
      'winMultiplier',
    ]);
    if (multiplier === null || multiplier <= 0) return null;

    const winAmount =
      this.readNumberCandidate(candidate, ['winAmount', 'cashoutAmount', 'payoutAmount']) ??
      +(this.betAmount.betAmount() * this.payout).toFixed(2);
    return { multiplier, winAmount };
  }

  private readNumberCandidate(
    source: Record<string, unknown>,
    keys: string[],
    depth = 0,
  ): number | null {
    if (depth > 3) return null;
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }

    for (const value of Object.values(source)) {
      if (!value || typeof value !== 'object') continue;
      const nested = this.readNumberCandidate(value as Record<string, unknown>, keys, depth + 1);
      if (nested !== null) return nested;
    }
    return null;
  }

  private queuePhase(action: () => void, delayMs: number): void {
    const timer = setTimeout(action, Math.max(0, delayMs));
    this.phaseTimers.push(timer);
  }

  private updateMultiplierAnchors(): void {
    const host = this.spineHost?.nativeElement;
    if (!host || !this.scene) return;
    const { headY, chestY } = this.scene.getWizardAnchorPercents(host.clientHeight);
    this.multiplierHeadY = `${headY.toFixed(2)}%`;
    this.multiplierChestY = `${chestY.toFixed(2)}%`;
  }

  private resetResultLayer(): void {
    if (this.countingInterval !== null) {
      clearInterval(this.countingInterval);
      this.countingInterval = null;
    }
    this.animationPhase = 'reset';
    this.winPopupVisible = false;
    this.queuePhase(() => {
      this.liveMultiplierVisible = false;
      this.multiplierTone = 'neutral';
      this.animationPhase = 'idle';
      this.roundRunning = false;
      this.cdr.detectChanges();
    }, this.prefersReducedMotion ? 50 : 120);
    this.cdr.detectChanges();
  }

  private finishWinRound(): void {
    if (this.countingInterval !== null) {
      clearInterval(this.countingInterval);
      this.countingInterval = null;
    }
    this.winPopupVisible = false;
    this.liveMultiplierVisible = false;
    this.multiplierTone = 'neutral';
    this.animationPhase = 'idle';
    this.roundRunning = false;
    this.cdr.detectChanges();
  }

  private unlockBetAfterSpine(): void {
    this.scene?.resumeIdle();
    this.cdr.detectChanges();
  }
}
