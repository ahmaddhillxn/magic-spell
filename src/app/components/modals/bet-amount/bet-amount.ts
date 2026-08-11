import { Component, effect, EventEmitter, HostListener, OnDestroy, Output } from '@angular/core';
import { Toggle } from '../../services/toggle';
import { CommonModule } from '@angular/common';
import { BetAmountService } from '../../services/bet-amount-service';
import { ModalVisibilityController } from '../../services/modal-visibility';

@Component({
  selector: 'app-bet-amount',
  imports: [CommonModule],
  templateUrl: './bet-amount.html',
  styleUrl: './bet-amount.css',
})
export class BetAmount implements OnDestroy {
  minBet: number = 0.1;
  maxBet: number = 100;
  selectedAmount = 0.1;
  stepAmounts = [0.7, 1.75, 6, 12.5, 40];
  isDragging = false;
  toggleAdvance = false;
  readonly visibility = new ModalVisibilityController(500);
  private sliderRoot: HTMLElement | null = null;

  constructor(
    public betSlipToggle: BetAmountService,
    public toggle: Toggle,
  ) {
    effect(() => {
      this.selectedAmount = this.betSlipToggle.betAmount();
    });
    effect(() => {
      this.toggle.currency();
      this.betSlipToggle.stakeSettings();
      this.refreshBounds();
    });
    effect(() => {
      const open = this.betSlipToggle.isOpen();
      this.visibility.sync(open);
      if (!open) {
        this.toggleAdvance = false;
      }
    });
    this.refreshBounds();
  }

  ngOnDestroy(): void {
    this.visibility.destroy();
  }

  get sliderPercent(): number {
    if (this.maxBet <= this.minBet) return 0;
    return ((this.selectedAmount - this.minBet) / (this.maxBet - this.minBet)) * 100;
  }

  @Output() closePopup = new EventEmitter<void>();
  @Output() betApplied = new EventEmitter<number>();

  applyBet(): void {
    this.closePopup.emit();
    this.betApplied.emit(this.selectedAmount);
    this.betSlipToggle.close();
  }

  setAmount(amount: number): void {
    this.betSlipToggle.setBetAmount(amount);
  }

  setToMin(): void {
    this.betSlipToggle.setBetAmount(this.minBet);
  }

  openGuide(): void {
    this.toggle.openGameGuide();
  }

  closeguide(): void {
    this.toggle.closeGameGuide();
  }

  setToMax(): void {
    this.betSlipToggle.setBetAmount(this.maxBet);
  }

  get currencySymbol(): string {
    return this.toggle.currencySymbol;
  }

  private refreshBounds(): void {
    const settings = this.betSlipToggle.getStakeSettings(this.toggle.currency());

    this.minBet = settings.minBet;
    this.maxBet = settings.maxBet;
    this.stepAmounts = settings.stakes.slice(0, 5);

    this.betSlipToggle.setBounds(this.minBet, this.maxBet);
    this.betSlipToggle.setBetAmount(this.betSlipToggle.betAmount());
  }

  /** Jump thumb to click/tap position on the track, then start drag. */
  onSliderPointerDown(event: MouseEvent | TouchEvent): void {
    const root = (event.currentTarget as HTMLElement).closest('.SliderRoot');
    if (!root) return;

    event.preventDefault();
    this.sliderRoot = root as HTMLElement;
    this.isDragging = true;
    this.applyPointerAmount(event, this.sliderRoot);
  }

  startDrag(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const root = (event.currentTarget as HTMLElement).closest('.SliderRoot');
    this.sliderRoot = root as HTMLElement | null;
    this.isDragging = true;
    if (this.sliderRoot) {
      this.applyPointerAmount(event, this.sliderRoot);
    }
  }

  @HostListener('document:mouseup')
  @HostListener('document:touchend')
  stopDrag(): void {
    this.isDragging = false;
    this.sliderRoot = null;
  }

  @HostListener('document:mousemove', ['$event'])
  @HostListener('document:touchmove', ['$event'])
  updateDrag(event: MouseEvent | TouchEvent): void {
    if (!this.isDragging || !this.sliderRoot) return;
    this.applyPointerAmount(event, this.sliderRoot);
  }

  private applyPointerAmount(event: MouseEvent | TouchEvent, root: HTMLElement): void {
    const slider = root.querySelector('.tracker') as HTMLElement | null;
    if (!slider) return;

    const rect = slider.getBoundingClientRect();
    if (rect.width <= 0) return;

    const touch = 'touches' in event ? event.touches[0] : undefined;
    const clientX = touch?.clientX ?? (event as MouseEvent).clientX;
    const percent = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const newAmount = this.minBet + percent * (this.maxBet - this.minBet);
    this.betSlipToggle.setBetAmount(+newAmount.toFixed(2));
  }

  onToggleAdvance(): void {
    this.toggleAdvance = !this.toggleAdvance;
  }
}
