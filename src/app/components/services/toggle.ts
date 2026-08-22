import { Injectable, signal, WritableSignal } from '@angular/core';

import { BehaviorSubject } from 'rxjs';

export const currencySymbols: { [key: string]: string } = {
  FUN: '$', // United States Dollar
  USD: '$', // United States Dollar
  EUR: '€', // Euro
  GBP: '£', // British Pound Sterling
  JPY: '¥', // Japanese Yen
  CHF: 'CHF', // Swiss Franc
  CAD: '$', // Canadian Dollar
  AUD: '$', // Australian Dollar
  CNY: '¥', // Chinese Yuan
  INR: '₹', // Indian Rupee
  RUB: '₽', // Russian Ruble
  BRL: 'R$', // Brazilian Real
  ZAR: 'R', // South African Rand
  SEK: 'kr', // Swedish Krona
  NOK: 'kr', // Norwegian Krone
  DKK: 'kr', // Danish Krone
  SGD: '$', // Singapore Dollar
  HKD: '$', // Hong Kong Dollar
  NZD: '$', // New Zealand Dollar
  KRW: '₩', // South Korean Won
  TRY: '₺', // Turkish Lira
  MXN: '$', // Mexican Peso
  ILS: '₪', // Israeli New Shekel
  SAR: '﷼', // Saudi Riyal
  AED: 'د.إ', // United Arab Emirates Dirham
  ARS: '$', // Argentine Peso
  CLP: '$', // Chilean Peso
  COP: '$', // Colombian Peso
  MYR: 'RM', // Malaysian Ringgit
  THB: '฿', // Thai Baht
  IDR: 'Rp', // Indonesian Rupiah
  PHP: '₱', // Philippine Peso
  PKR: '₨', // Pakistani Rupee
  EGP: '£', // Egyptian Pound
  VND: '₫', // Vietnamese Dong
  NGN: '₦', // Nigerian Naira
  PLN: 'zł', // Polish Zloty
  HUF: 'Ft', // Hungarian Forint
  CZK: 'Kč', // Czech Koruna
  RON: 'lei', // Romanian Leu
  BGN: 'лв', // Bulgarian Lev
  HRK: 'kn', // Croatian Kuna
  ISK: 'kr', // Icelandic Króna
  PEN: 'S/.', // Peruvian Sol
  UAH: '₴', // Ukrainian Hryvnia
  GHS: '₵', // Ghanaian Cedi
  MAD: 'د.م.', // Moroccan Dirham
  KES: 'KSh', // Kenyan Shilling
  TWD: 'NT$', // New Taiwan Dollar
  JMD: 'J$', // Jamaican Dollar
  LKR: '₨', // Sri Lankan Rupee
  BDT: '৳', // Bangladeshi Taka
  NPR: '₨', // Nepalese Rupee
  MMK: 'K', // Burmese Kyat
  GEL: '₾', // Georgian Lari
  ETB: 'Br', // Ethiopian Birr
  AZN: '₼', // Azerbaijani Manat
  BHD: 'ب.د', // Bahraini Dinar
  QAR: '﷼', // Qatari Riyal
  KWD: 'د.ك', // Kuwaiti Dinar
  BND: '$', // Brunei Dollar
  OMR: 'ر.ع.', // Omani Rial
  UZS: 'UZS', // Uzbekistani Som
  DZD: 'دج', // Algerian Dinar
  KZT: '₸', // Kazakhstani Tenge
  MNT: '₮', // Mongolian Tögrög
  XOF: 'CFA', // West African CFA Franc
  XAF: 'FCFA', // Central African CFA Franc
  ZMW: 'ZK', // Zambian Kwacha
  MWK: 'MK', // Malawian Kwacha
  SZL: 'E', // Swazi Lilangeni
  NAD: '$', // Namibian Dollar
  MGA: 'Ar', // Malagasy Ariary
  BWP: 'P', // Botswanan Pula
  BIF: 'FBu', // Burundian Franc
  CDF: 'FC', // Congolese Franc
  RWF: 'FRw', // Rwandan Franc
  UGX: 'USh', // Ugandan Shilling
  LSL: 'M', // Lesotho Loti
  ZWL: '$', // Zimbabwean Dollar
  SLL: 'Le', // Sierra Leonean Leone
  LRD: '$', // Liberian Dollar
  SCR: '₨', // Seychellois Rupee
  MVR: 'Rf', // Maldivian Rufiyaa
  AOA: 'Kz', // Angolan Kwanza
  GNF: 'FG', // Guinean Franc
  MOP: 'MOP$', // Macanese Pataca
  KYD: '$', // Cayman Islands Dollar
  TTD: '$', // Trinidad and Tobago Dollar
  BBD: '$', // Barbadian Dollar
  BSD: '$', // Bahamian Dollar
  ANG: 'ƒ', // Netherlands Antillean Guilder
  AWG: 'ƒ', // Aruban Florin
  HTG: 'G', // Haitian Gourde
  PYG: '₲', // Paraguayan Guarani
  UYU: '$U', // Uruguayan Peso
  BZD: 'BZ$', // Belize Dollar
  GTQ: 'Q', // Guatemalan Quetzal
  HNL: 'L', // Honduran Lempira
  SVC: '₡', // Salvadoran Colón
  NIO: 'C$', // Nicaraguan Córdoba
  DOP: 'RD$', // Dominican Peso
  BOB: 'Bs.', // Bolivian Boliviano
  PAB: 'B/.', // Panamanian Balboa
  CRC: '₡', // Costa Rican Colón
  SHP: '£', // Saint Helena Pound
  FKP: '£', // Falkland Islands Pound
  TOP: 'T$', // Tongan Paʻanga
  WST: 'WS$', // Samoan Tala
  FJD: '$', // Fijian Dollar
  PGK: 'K', // Papua New Guinean Kina
  SBD: '$', // Solomon Islands Dollar
  VUV: 'VT', // Vanuatu Vatu
  KPW: '₩', // North Korean Won
  KGS: 'лв', // Kyrgystani Som
  TJS: 'ЅМ', // Tajikistani Somoni
  TMT: 'm', // Turkmenistani Manat
  IRR: '﷼', // Iranian Rial
  IQD: 'ع.د', // Iraqi Dinar
  LBP: 'ل.ل', // Lebanese Pound
  SYP: '£', // Syrian Pound
  YER: '﷼', // Yemeni Rial
  AFN: '؋', // Afghan Afghani
  MUR: '₨', // Mauritian Rupee
  SRD: '$', // Surinamese Dollar
  MZN: 'MT', // Mozambican Metical
  SOS: 'S', // Somali Shilling
  BAM: 'KM', // Bosnia-Herzegovina Convertible Mark
  MKD: 'ден', // Macedonian Denar
  MDL: 'L', // Moldovan Leu
  ALL: 'L', // Albanian Lek
  GIP: '£', // Gibraltar Pound
  MRO: 'UM', // Mauritanian Ouguiya (pre-2018)
  MRU: 'UM', // Mauritanian Ouguiya
  STN: 'Db', // São Tomé and Príncipe Dobra
  CVE: '$', // Cape Verdean Escudo
  KMF: 'CF', // Comorian Franc
  AMD: '֏', // Armenian Dram
  BTN: 'Nu.', // Bhutanese Ngultrum
  XDR: 'SDR', // Special Drawing Rights
  SSP: '£', // South Sudanese Pound
  BYN: 'Br', // Belarusian Ruble
  GYD: '$', // Guyanese Dollar
  RSD: 'дин', // Serbian Dinar
  TND: 'د.ت', // Tunisian Dinar
  VES: 'Bs.S', // Venezuelan Bolívar Soberano
  XPF: '₣', // CFP Franc (franc Pacifique)
  XCD: '$', // East Caribbean Dollar
  JOD: 'د.ا', // Jordanian Dinar
  LYD: 'ل.د', // Libyan Dinar
  SDG: 'ج.س', // Sudanese Pound
  BMD: '$', // Bermudian Dollar
  GGP: '£', // Guernsey Pound
  IMP: '£', // Isle of Man Pound
  JEP: '£', // Jersey Pound
  SPL: '$', // Seborga Luigino
  TVD: '$', // Tuvaluan Dollar
  BTC: '₿', // Bitcoin
  ETH: 'Ξ', // Ethereum
};

@Injectable({
  providedIn: 'root',
})
export class Toggle {
  private _balance: WritableSignal<number> = signal(0);
  readonly balance = this._balance.asReadonly();

  private _currency: WritableSignal<string> = signal('USD');
  readonly currency = this._currency.asReadonly();

  get currencySymbol(): string {
    const currency = this.currency();
    return currencySymbols[currency] || currency;
  }

  private _isOpenMenu = signal(false);
  isOpenMenu = this._isOpenMenu.asReadonly();

  private _isOpenBetHistory = signal(false);
  isOpenBetHistory = this._isOpenBetHistory.asReadonly();

  private _isOpenGameQuideModal = signal(false);
  isOpenGameQuideModal = this._isOpenGameQuideModal.asReadonly();

  /** Persisted mute preference — used by SoundScene + volume button. */
  private readonly soundStorageKey = 'plinko_sound_enabled';
  private readonly gameInteractionStorageKey = 'justjump_game_interacted';

  private readonly _soundEnabled = signal(this.readInitialSoundPreference());
  readonly soundEnabled = this._soundEnabled.asReadonly();

  /** @deprecated use soundEnabled() / isSoundOn() */
  get musicTrigger(): boolean {
    return this._soundEnabled();
  }
  set musicTrigger(value: boolean) {
    this.setSoundEnabled(value);
  }

  private hasGameInteraction = this.readStoredBoolean(this.gameInteractionStorageKey, false);

  private readInitialSoundPreference(): boolean {
    if (typeof window === 'undefined') return true;
    try {
      const next = window.localStorage.getItem(this.soundStorageKey);
      if (next !== null) return next === 'true';
      // Migrate legacy key once
      const legacy = window.localStorage.getItem('justjump_music_enabled');
      if (legacy !== null) {
        const on = legacy === 'true';
        this.persistBoolean(this.soundStorageKey, on);
        return on;
      }
    } catch {
      /* ignore */
    }
    return true;
  }

  playMusicTrigger() {
    this.setSoundEnabled(true);
  }

  stopMusicTrigger() {
    this.setSoundEnabled(false);
  }

  toggleMusicTrigger() {
    this.setSoundEnabled(!this._soundEnabled());
  }

  setSoundEnabled(on: boolean): void {
    this._soundEnabled.set(on);
    this.persistBoolean(this.soundStorageKey, on);
    // Keep legacy key in sync for older builds
    this.persistBoolean('justjump_music_enabled', on);
  }

  isSoundOn(): boolean {
    return this._soundEnabled();
  }

  markGameInteraction() {
    if (this.hasGameInteraction) return;
    this.hasGameInteraction = true;
    this.persistBoolean(this.gameInteractionStorageKey, true);
  }

  canUseHeaderVolume(): boolean {
    return this.hasGameInteraction;
  }

  openMenu() {
    this._isOpenMenu.set(true);
  }
  closeMenu() {
    this._isOpenMenu.set(false);
  }
  toggleMenu() {
    this._isOpenMenu.update((open) => !open);
  }

  openBetHistory() {
    this.closeMenu();
    this._isOpenGameQuideModal.set(false);
    this._isOpenBetHistory.set(true);
  }
  closeBetHistory() {
    this._isOpenBetHistory.set(false);
  }

  openGameGuide() {
    this.closeMenu();
    this._isOpenBetHistory.set(false);
    this._isOpenGameQuideModal.set(true);
  }
  closeGameGuide() {
    this._isOpenGameQuideModal.set(false);
  }

  setCurrency(currency: string) {
    this._currency.set(currency);
  }
  setBalance(balance: number) {
    this._balance.set(Number(balance.toFixed(2)));
  }

  /** Apply a delta (negative = bet stake, positive = win payout). */
  adjustBalance(delta: number): number {
    const next = Number((this._balance() + delta).toFixed(2));
    this._balance.set(next);
    return next;
  }

  currencyCodeForPipe(): string {
    return this.currency() === 'PKR' ? 'Rs' : this.currency();
  }

  private readStoredBoolean(key: string, fallback: boolean): boolean {
    if (typeof window === 'undefined') return fallback;
    try {
      const value = window.localStorage.getItem(key);
      if (value === null) return fallback;
      return value === 'true';
    } catch {
      return fallback;
    }
  }

  private persistBoolean(key: string, value: boolean): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      // ignore storage write errors
    }
  }
}
