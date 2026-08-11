import { Injectable, signal, WritableSignal } from '@angular/core';
import { Api, GameConfigResponse } from './api';

export interface GameConfig {
  currency: string;
  currencySymbol: string;
  balance: number;
  minBet: number;
  maxBet: number;
  maxWin: number;
  stakes: number[];
}

const DEFAULT_CONFIG: GameConfig = {
  currency: 'USD',
  currencySymbol: '$',
  balance: 0,
  minBet: 0.5,
  maxBet: 1000,
  maxWin: 1000,
  stakes: [0.5, 5, 10, 50, 100, 500],
};

export const currencySymbols: { [key: string]: string } = {
  FUN: '$',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CHF: 'CHF',
  CAD: '$',
  AUD: '$',
  CNY: '¥',
  INR: '₹',
  RUB: '₽',
  BRL: 'R$',
  ZAR: 'R',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  SGD: '$',
  HKD: '$',
  NZD: '$',
  KRW: '₩',
  TRY: '₺',
  MXN: '$',
  ILS: '₪',
  SAR: '﷼',
  AED: 'د.إ',
  ARS: '$',
  CLP: '$',
  COP: '$',
  MYR: 'RM',
  THB: '฿',
  IDR: 'Rp',
  PHP: '₱',
  PKR: '₨',
  EGP: '£',
  VND: '₫',
  NGN: '₦',
  PLN: 'zł',
  HUF: 'Ft',
  CZK: 'Kč',
  RON: 'lei',
  BGN: 'лв',
  HRK: 'kn',
  ISK: 'kr',
  PEN: 'S/.',
  UAH: '₴',
  GHS: '₵',
  MAD: 'د.م.',
  KES: 'KSh',
  TWD: 'NT$',
  JMD: 'J$',
  LKR: '₨',
  BDT: '৳',
  NPR: '₨',
  MMK: 'K',
  GEL: '₾',
  ETB: 'Br',
  AZN: '₼',
  BHD: 'ب.د',
  QAR: '﷼',
  KWD: 'د.ك',
  BND: '$',
  OMR: 'ر.ع.',
  UZS: 'UZS',
  DZD: 'دج',
  KZT: '₸',
  MNT: '₮',
  XOF: 'CFA',
  XAF: 'FCFA',
  ZMW: 'ZK',
  MWK: 'MK',
  SZL: 'E',
  NAD: '$',
  MGA: 'Ar',
  BWP: 'P',
  BIF: 'FBu',
  CDF: 'FC',
  RWF: 'FRw',
  UGX: 'USh',
  LSL: 'M',
  ZWL: '$',
  SLL: 'Le',
  LRD: '$',
  SCR: '₨',
  MVR: 'Rf',
  AOA: 'Kz',
  GNF: 'FG',
  MOP: 'MOP$',
  KYD: '$',
  TTD: '$',
  BBD: '$',
  BSD: '$',
  ANG: 'ƒ',
  AWG: 'ƒ',
  HTG: 'G',
  PYG: '₲',
  UYU: '$U',
  BZD: 'BZ$',
  GTQ: 'Q',
  HNL: 'L',
  SVC: '₡',
  NIO: 'C$',
  DOP: 'RD$',
  BOB: 'Bs.',
  PAB: 'B/.',
  CRC: '₡',
  SHP: '£',
  FKP: '£',
  TOP: 'T$',
  WST: 'WS$',
  FJD: '$',
  PGK: 'K',
  SBD: '$',
  VUV: 'VT',
  KPW: '₩',
  KGS: 'лв',
  TJS: 'ЅМ',
  TMT: 'm',
  IRR: '﷼',
  IQD: 'ع.د',
  LBP: 'ل.ل',
  SYP: '£',
  YER: '﷼',
  AFN: '؋',
  MUR: '₨',
  SRD: '$',
  MZN: 'MT',
  SOS: 'S',
  BAM: 'KM',
  MKD: 'ден',
  MDL: 'L',
  ALL: 'L',
  GIP: '£',
  MRO: 'UM',
  MRU: 'UM',
  STN: 'Db',
  CVE: '$',
  KMF: 'CF',
  AMD: '֏',
  BTN: 'Nu.',
  XDR: 'SDR',
  SSP: '£',
  BYN: 'Br',
  GYD: '$',
  RSD: 'дин',
  TND: 'د.ت',
  VES: 'Bs.S',
  XPF: '₣',
  XCD: '$',
  JOD: 'د.ا',
  LYD: 'ل.د',
  SDG: 'ج.س',
  BMD: '$',
  GGP: '£',
  IMP: '£',
  JEP: '£',
  SPL: '$',
  TVD: '$',
  BTC: '₿',
  ETH: 'Ξ',
};

@Injectable({
  providedIn: 'root',
})
export class GameConfigService {
  private _gameConfig: WritableSignal<GameConfig> = signal(DEFAULT_CONFIG);
  readonly gameConfig = this._gameConfig.asReadonly();

  private isLoading = false;
  private hasLoaded = false;

  constructor(private api: Api) {}

  /**
   * Get currency symbol for the currently set currency
   */
  getCurrencySymbol(): string {
    const currency = this._gameConfig().currency;
    return currencySymbols[currency] || currency;
  }

  /**
   * Get current balance
   */
  getBalance(): number {
    return this._gameConfig().balance;
  }

  /**
   * Get current currency
   */
  getCurrency(): string {
    return this._gameConfig().currency;
  }

  /**
   * Get stake settings
   */
  getStakeSettings() {
    const config = this._gameConfig();
    return {
      minBet: config.minBet,
      maxBet: config.maxBet,
      maxWin: config.maxWin,
      stakes: config.stakes,
    };
  }

  /**
   * Update balance from parent
   */
  updateBalance(balance: number, currency: string) {
    this._gameConfig.update((current) => ({
      ...current,
      balance,
      currency: currency || current.currency,
      currencySymbol: currencySymbols[currency] || currency || current.currencySymbol,
    }));
    localStorage.setItem('currency', currency);
    localStorage.setItem('balance', String(balance));
  }

  /**
   * Load game config from API
   */
  loadConfig() {
    if (!localStorage.getItem('token')) return;
    if (this.isLoading) return;
    if (this.hasLoaded) return;

    this.isLoading = true;

    this.api.getGameConfig().subscribe({
      next: (response) => {
        this.applyConfig(response);
      },
      error: (error) => {
        console.warn('Failed to load game config', error);
        this.isLoading = false;
      },
    });
  }

  private applyConfig(response: GameConfigResponse) {
    if (response?.status && response.status !== 'success') {
      this.isLoading = false;
      return;
    }

    const data = response?.data;
    if (!data) {
      this.isLoading = false;
      return;
    }

    const currency = data.currency || this._gameConfig().currency;
    const currencySymbol = currencySymbols[currency] || currency;
    const stakeSettings = data.stakeSettings;

    let validStakes = this._gameConfig().stakes;
    if (Array.isArray(stakeSettings?.stakes)) {
      const filtered = stakeSettings.stakes.filter(
        (s): s is number => s !== null && s !== undefined,
      );
      if (filtered.length > 0) {
        validStakes = filtered;
      }
    }

    this._gameConfig.set({
      currency,
      currencySymbol,
      balance: this._gameConfig().balance,
      minBet: stakeSettings?.minBet ?? this._gameConfig().minBet,
      maxBet: stakeSettings?.maxBet ?? this._gameConfig().maxBet,
      maxWin: this._gameConfig().maxWin,
      stakes: validStakes,
    });

    this.hasLoaded = true;
    this.isLoading = false;
    localStorage.setItem('currency', currency);
  }
}
