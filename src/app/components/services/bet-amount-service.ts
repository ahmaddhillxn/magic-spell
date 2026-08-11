import { Injectable, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface BetStakeSettings {
  minBet: number;
  maxBet: number;
  stakes: number[];
}

export type BetStakeSettingsByCurrency = Record<string, BetStakeSettings>;

@Injectable({
  providedIn: 'root',
})
export class BetAmountService {
  private soundState = new BehaviorSubject<boolean>(true);
  soundState$ = this.soundState.asObservable();

  // --- BET AMOUNT SIGNAL ---
  private _betAmount = signal<number>(0.1);
  betAmount = this._betAmount.asReadonly();

  // --- MODAL STATE SIGNAL ---
  private _isOpen = signal<boolean>(false);
  isOpen = this._isOpen.asReadonly();

  // --- Bounds ---
  private minBound = 0.1;
  private maxBound = 100;
  private readonly fallbackStakeSettings: BetStakeSettingsByCurrency = {
    PKR: { minBet: 100, maxBet: 50000, stakes: [200, 500, 1000, 3000, 5000] },
    USD: { minBet: 0.1, maxBet: 100, stakes: [0.7, 1.75, 6, 12.5, 40] },
    INR: { minBet: 10, maxBet: 25000, stakes: [20, 50, 100, 500, 1000] },
    DEFAULT: { minBet: 0.1, maxBet: 100, stakes: [0.7, 1.75, 6, 12.5, 40] },
  };
  private _stakeSettings = signal<BetStakeSettingsByCurrency>({
    ...this.fallbackStakeSettings,
  });
  stakeSettings = this._stakeSettings.asReadonly();

  constructor() {}

  setBounds(min: number, max: number) {
    this.minBound = min;
    this.maxBound = max;
  }

  setStakeSettings(settings: BetStakeSettingsByCurrency) {
    const normalized: BetStakeSettingsByCurrency = {};

    for (const [currency, value] of Object.entries(settings)) {
      const key = this.normalizeCurrency(currency);
      const stakes = value.stakes
        .map((stake) => Number(stake))
        .filter((stake) => Number.isFinite(stake) && stake > 0);
      if (!stakes.length) continue;

      const minBet = Number(value.minBet);
      const maxBet = Number(value.maxBet);
      normalized[key] = {
        minBet: Number.isFinite(minBet) && minBet > 0 ? minBet : Math.min(...stakes),
        maxBet: Number.isFinite(maxBet) && maxBet > 0 ? maxBet : Math.max(...stakes),
        stakes,
      };
    }

    if (!Object.keys(normalized).length) return;

    this._stakeSettings.set({
      ...this.fallbackStakeSettings,
      ...this._stakeSettings(),
      ...normalized,
    });
  }

  getStakeSettings(currency: string): BetStakeSettings {
    const settings = this._stakeSettings();
    const key = this.normalizeCurrency(currency);
    return settings[key] ?? settings['DEFAULT'] ?? this.fallbackStakeSettings['DEFAULT'];
  }

  normalizeCurrency(currency: string): string {
    if (!currency) return 'DEFAULT';
    const upper = currency.toUpperCase();
    if (upper === 'RS') return 'PKR';
    if (upper === '₹') return 'INR';
    return upper;
  }

  // --- BET AMOUNT METHODS ---
  setBetAmount(amount: number) {
    // limit between min and max
    const validAmount = Math.min(Math.max(amount, this.minBound), this.maxBound);
    this._betAmount.set(validAmount);
  }
  setSoundState(state: boolean) {
    this.soundState.next(state);
  }

  getCurrentState() {
    return this.soundState.value;
  }
  // --- MODAL CONTROL METHODS ---
  open() {
    this._isOpen.set(true);
  }

  close() {
    this._isOpen.set(false);
  }

  toggle() {
    this._isOpen.update((prev) => !prev);
  }
  private modalState = new BehaviorSubject<boolean>(false);
  modalState$ = this.modalState.asObservable();
  private modalguideState = new BehaviorSubject<boolean>(false);
  modalguideState$ = this.modalguideState.asObservable();
  openguideModal() {
    this.modalguideState.next(true);
  }

  closeguideModal() {
    this.modalguideState.next(false);
  }

  openModal() {
    this.modalState.next(true);
  }

  closeModal() {
    this.modalState.next(false);
  }
}
