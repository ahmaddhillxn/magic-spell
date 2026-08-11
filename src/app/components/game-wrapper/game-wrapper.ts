import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { Application } from 'pixi.js';
import { MagicSpellScene } from '../scene-manager/magic-spell-scene';
import { Toggle } from '../services/toggle';
import { BetAmountService } from '../services/bet-amount-service';
import { BetHistoryModal } from '../modals/bet-history-modal/bet-history-modal';
import { GuidenessModal } from '../modals/guideness-modal/guideness-modal';
import { BetAmount } from '../modals/bet-amount/bet-amount';
import { AutoplayModal } from '../modals/autoplay-modal/autoplay-modal';
import { GAME_ASSETS } from '../game-assets';

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

  private app?: Application;
  private scene?: MagicSpellScene;
  private resizeObserver?: ResizeObserver;

  constructor(private readonly cdr: ChangeDetectorRef) {
    this.displayAmount = this.betAmount.betAmount().toFixed(2);
  }

  async ngAfterViewInit(): Promise<void> {
    const host = this.spineHost.nativeElement;
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
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

      app.ticker.maxFPS = isIOS || isCoarse ? 45 : 60;
      app.ticker.minFPS = 30;

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
      });
      this.resizeObserver.observe(host);
      requestAnimationFrame(() => {
        this.app?.resize();
        this.scene?.layout();
      });
      this.cdr.detectChanges();
    } catch (err) {
      console.error('[GameWrapper] spine init failed', err);
      this.error = err instanceof Error ? err.message : 'Failed to load spine';
      this.cdr.detectChanges();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.menu-root')) return;
    if (this.toggle.isOpenMenu()) this.toggle.closeMenu();
  }

  toggleMenu(): void {
    this.toggle.toggleMenu();
  }

  openHistory(): void {
    this.toggle.openBetHistory();
  }

  openGuide(): void {
    this.toggle.openGameGuide();
  }

  openBetAmount(): void {
    this.betAmount.open();
  }

  onBetApplied(amount: number): void {
    this.displayAmount = amount.toFixed(2);
  }

  toggleSound(): void {
    this.toggle.markGameInteraction();
    this.toggle.toggleMusicTrigger();
  }

  adjustAmount(delta: number): void {
    const settings = this.betAmount.getStakeSettings(this.toggle.currency());
    const next = Math.min(
      settings.maxBet,
      Math.max(settings.minBet, +(this.betAmount.betAmount() + delta).toFixed(2)),
    );
    this.betAmount.setBetAmount(next);
    this.displayAmount = next.toFixed(2);
  }

  adjustPayout(delta: number): void {
    this.payout = Math.min(100, Math.max(1.01, +(this.payout + delta).toFixed(2)));
    this.displayPayout = `${this.payout.toFixed(2)}x`;
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
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.scene?.destroy();
    this.scene = undefined;
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = undefined;
    }
  }
}
