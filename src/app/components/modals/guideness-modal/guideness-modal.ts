import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { Toggle } from '../../services/toggle';
import { GAME_ASSETS } from '../../game-assets';
import { BetAmountService } from '../../services/bet-amount-service';

type IntroStep = {
  target: string;
  action?: () => void;
  extraDelayMs?: number;
};

export interface GuideSlide {
  title: string;
  welcome?: boolean;
  description?: string;
  body?: string;
  listItems?: string[];
  betSelector?: boolean;
  image?: string;
  showLimits?: boolean;
}

@Component({
  selector: 'app-guideness-modal',
  imports: [],
  templateUrl: './guideness-modal.html',
  styleUrl: './guideness-modal.css',
  host: {
    class: 'is-open',
  },
})
export class GuidenessModal implements OnDestroy {
  @Output() closed = new EventEmitter<void>();
  currentSlide = 0;
  readonly betSlipToggle = inject(Toggle);
  private readonly betAmount = inject(BetAmountService);
  private readonly cdr = inject(ChangeDetectorRef);
  private ignoreCloseUntil = 0;

  readonly stepAmounts = [0.7, 1.75, 6, 12.5, 40] as const;
  demoAmount = 0.1;
  demoAdvance = false;
  cursorClicking = false;
  cursorLeftPx = 0;
  cursorTopPx = 0;
  cursorOpacity = 0;

  @ViewChild('introPopupContainer') introPopupContainer?: ElementRef<HTMLElement>;
  @ViewChild('guideBetShell') guideBetShell?: ElementRef<HTMLElement>;

  private readonly introTimers: ReturnType<typeof setTimeout>[] = [];
  private readonly moveMs = 1200;
  private readonly clickMs = 500;
  private readonly minBet = 0.1;
  private readonly maxBet = 100;
  private resizeObserver: ResizeObserver | null = null;

  get demoSliderPercent(): number {
    return ((this.demoAmount - this.minBet) / (this.maxBet - this.minBet)) * 100;
  }

  readonly slides: GuideSlide[] = [
    {
      welcome: true,
      title: 'The Game Board',
      description:
        'Welcome to Magic Spell! Cast a magic spell to get a random multiplier. If the multiplier is equal to or higher than your payout, you win! But if the magic fails, you lose and the round ends.',
      body: 'Watch the wizard do magic and see your multiplier. On the top side, you can see the results of past rounds to help you choose your next bet.',
      image: GAME_ASSETS.images.gameBoard,
    },
    {
      title: 'Making Moves',
      listItems: [
        'Set your bet amount using +/- buttons or pick from the bet selector.',
        'Set your payout to choose how much you want to win.',
        'Choose your bet and payout, then click the bet button to start the magic spell.',
        'If the magic fails, you lose your bet. If it works, coins will appear in the magic circle and you win!',
      ],
      image: GAME_ASSETS.images.makingMove,
    },
    {
      title: 'Bet Selector',
      betSelector: true,
      description:
        'Choose your bet using the Bet Selector in the betting area, select a preset amount, then press Apply to confirm your choice.',
    },
    {
      title: 'Last Results',
      description:
        'The Last Results section shows multipliers from previous rounds. You can use these past numbers to help you make better betting choices.',
      image: GAME_ASSETS.images.resultStrip,
    },
    {
      title: 'Game Limits',
      description: 'Game limits are set by the operator. The limits for this game are shown below.',
      showLimits: true,
    },
  ];

  get totalSlides(): number {
    return this.slides.length;
  }

  get minBetLabel(): string {
    return this.formatAmount(this.stake.minBet);
  }

  get maxBetLabel(): string {
    return this.formatAmount(this.stake.maxBet);
  }

  get maxWinLabel(): string {
    return this.formatAmount(this.stake.maxBet * 10);
  }

  readonly coinIcon = GAME_ASSETS.icons.amountPopup;

  private get stake() {
    return this.betAmount.getStakeSettings(this.betSlipToggle.currency());
  }

  constructor() {
    this.ignoreCloseUntil = Date.now() + 400;
    this.currentSlide = 0;
  }

  ngOnDestroy(): void {
    this.stopBetIntro();
    this.teardownVpRem();
  }

  close(): void {
    if (Date.now() < this.ignoreCloseUntil) return;
    this.stopBetIntro();
    this.teardownVpRem();
    this.closed.emit();
    this.betSlipToggle.closeGameGuide();
  }

  goNext(): void {
    if (this.currentSlide < this.totalSlides - 1) {
      this.currentSlide += 1;
      this.onSlideChanged();
      return;
    }
    this.close();
  }

  goPrev(): void {
    if (this.currentSlide > 0) {
      this.currentSlide -= 1;
      this.onSlideChanged();
    }
  }

  private onSlideChanged(): void {
    if (this.currentSlide === 2) {
      this.startBetIntro();
    } else {
      this.stopBetIntro();
      this.resetBetIntro();
      this.teardownVpRem();
    }
  }

  private resetBetIntro(): void {
    this.demoAmount = this.minBet;
    this.demoAdvance = false;
    this.cursorOpacity = 0;
    this.cursorClicking = false;
  }

  private stopBetIntro(): void {
    for (const id of this.introTimers) {
      clearTimeout(id);
    }
    this.introTimers.length = 0;
    this.cursorOpacity = 0;
    this.cursorClicking = false;
  }

  private startBetIntro(): void {
    this.stopBetIntro();
    this.resetBetIntro();
    this.queueTimeout(() => {
      this.runBetIntroLoop();
    }, 560);
  }

  private setupVpRem(): void {
    const shell = this.guideBetShell?.nativeElement;
    const container = this.introPopupContainer?.nativeElement;
    const el = container ?? shell;
    if (!el) return;

    const apply = () => {
      const width = el.offsetWidth || 1;
      el.style.setProperty('--vp-rem', `${width / 19.7}px`);
      if (shell && shell !== el) {
        shell.style.setProperty('--vp-rem', `${width / 19.7}px`);
      }
    };

    apply();
    this.teardownVpRem();
    this.resizeObserver = new ResizeObserver(apply);
    this.resizeObserver.observe(el);
  }

  private teardownVpRem(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  private runBetIntroLoop(): void {
    const hot = this.stepAmounts;
    const steps: IntroStep[] = [
      { target: `step-${hot[1]}`, action: () => (this.demoAmount = hot[1]) },
      { target: `step-${hot[2]}`, action: () => (this.demoAmount = hot[2]) },
      { target: `step-${hot[3]}`, action: () => (this.demoAmount = hot[3]) },
      { target: 'max', action: () => (this.demoAmount = this.maxBet) },
      { target: 'min', action: () => (this.demoAmount = this.minBet) },
      { target: 'advance', action: () => (this.demoAdvance = true) },
      {
        target: 'simple',
        action: () => (this.demoAdvance = false),
        extraDelayMs: 900,
      },
      { target: 'submit', action: () => undefined },
    ];

    const schedulePass = () => {
      let delay = 0;
      steps.forEach((step, index) => {
        if (step.extraDelayMs) delay += step.extraDelayMs;
        const at = delay + this.moveMs + index * this.moveMs;
        this.queueTimeout(() => {
          this.moveCursorTo(step.target);
          this.queueTimeout(() => {
            step.action?.();
            this.cdr.detectChanges();
          }, this.clickMs);
        }, at);
      });

      const loopAt = delay + this.moveMs + steps.length * this.moveMs + this.clickMs + 1000;
      this.queueTimeout(() => schedulePass(), loopAt);
    };

    schedulePass();
  }

  private moveCursorTo(target: string): void {
    const container = this.introPopupContainer?.nativeElement;
    if (!container) return;

    const el = container.querySelector<HTMLElement>(`[data-intro="${target}"]`);
    if (!el) return;

    const cRect = container.getBoundingClientRect();
    const tRect = el.getBoundingClientRect();
    if (tRect.width < 2 || tRect.height < 2) return;

    this.cursorClicking = false;
    this.cursorLeftPx = tRect.left - cRect.left + tRect.width * 0.35;
    this.cursorTopPx = tRect.top - cRect.top + tRect.height * 0.35;
    this.cursorOpacity = 1;
    this.cdr.detectChanges();

    this.queueTimeout(() => {
      this.cursorClicking = true;
      this.cdr.detectChanges();
    }, 50);
  }

  private queueTimeout(fn: () => void, ms: number): void {
    this.introTimers.push(setTimeout(fn, ms));
  }

  private formatAmount(value: number): string {
    return Number(value).toFixed(2);
  }
}
