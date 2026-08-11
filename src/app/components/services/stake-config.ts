import { Injectable, signal } from '@angular/core';
import { GameConfigService } from './game-config';

export interface CurrencyStakeConfig {
  minBet: number;
  maxBet: number;
  stakes: number[];
}

export interface StakeConfig extends CurrencyStakeConfig {
  step: number;
}

export const STAKE_SETTINGS: Record<string, CurrencyStakeConfig> = {
  PKR: {
    minBet: 100,
    maxBet: 50000,
    stakes: [200, 500, 1000, 3000, 5000],
  },
  USD: {
    minBet: 0.1,
    maxBet: 100,
    stakes: [0.7, 1.75, 6, 12.5, 40],
  },
  INR: {
    minBet: 10,
    maxBet: 25000,
    stakes: [20, 50, 100, 500, 1000],
  },
  DEFAULT: {
    minBet: 0.1,
    maxBet: 100,
    stakes: [0.7, 1.75, 6, 12.5, 40],
  },
};

export const DEFAULT_STAKE_CONFIG = toStakeConfig(STAKE_SETTINGS['DEFAULT']);

export function getStakeConfig(currency: string | null | undefined): StakeConfig {
  const normalizedCurrency = normalizeCurrency(currency);
  const config =
    (normalizedCurrency && STAKE_SETTINGS[normalizedCurrency]) || STAKE_SETTINGS['DEFAULT'];

  return toStakeConfig(config);
}

@Injectable({
  providedIn: 'root',
})
export class StakeConfigService {
  private _stakeConfig = signal<StakeConfig>(DEFAULT_STAKE_CONFIG);
  readonly stakeConfig = this._stakeConfig.asReadonly();

  private isLoading = false;
  private hasLoaded = false;

  constructor(private gameConfigService: GameConfigService) {}

  loadConfig(force = false) {
    if (!localStorage.getItem('token')) return;
    if (this.isLoading) return;
    if (this.hasLoaded && !force) return;

    this.isLoading = true;
    this.gameConfigService.loadConfig();

    const settings = this.gameConfigService.getStakeSettings();
    const stakeConfig: StakeConfig = {
      minBet: settings.minBet,
      maxBet: settings.maxBet,
      stakes: settings.stakes,
      step: settings.stakes[0] ?? settings.minBet,
    };

    this._stakeConfig.set(stakeConfig);
    this.hasLoaded = true;
    this.isLoading = false;
  }
}

function toStakeConfig(config: CurrencyStakeConfig): StakeConfig {
  return {
    ...config,
    stakes: [...config.stakes],
    step: config.stakes[0] ?? config.minBet,
  };
}

function normalizeCurrency(currency: string | null | undefined) {
  const normalizedCurrency = currency?.trim().toUpperCase();
  return normalizedCurrency || null;
}
