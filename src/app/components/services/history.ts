import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface SpinResultPayload {
  id: string | number;
  time: Date;
  betAmount: number;
  multiplier: number;
  winAmount: number;
  win: boolean;
  payout?: number;
}

const BET_HISTORY_STORAGE_KEY = 'magic_spell_bet_history';

@Injectable({ providedIn: 'root' })
export class BetHistoryService {
  private readonly historySubject = new BehaviorSubject<SpinResultPayload[]>(this.loadStoredHistory());
  readonly history$ = this.historySubject.asObservable();
  private nextNumericId = 253;

  /** @deprecated Prefer history$; kept for single-event listeners */
  private readonly spinResultSubject = new BehaviorSubject<SpinResultPayload | null>(null);
  spinResult$ = this.spinResultSubject.asObservable();

  constructor() {
    const maxStoredId = this.historySubject.value.reduce((max, item) => {
      const id = Number(item.id);
      if (!Number.isFinite(id)) return max;
      return Math.max(max, Math.trunc(id));
    }, this.nextNumericId - 1);
    this.nextNumericId = Math.max(this.nextNumericId, maxStoredId + 1);
  }

  emitSpinResult(data: SpinResultPayload) {
    const id = this.toNumericId(data.id);
    const payload = { ...data, id };
    const next = [payload, ...this.historySubject.value].slice(0, 50);
    this.historySubject.next(next);
    this.persistHistory(next);
    this.spinResultSubject.next(payload);
  }

  getHistory(): SpinResultPayload[] {
    return this.historySubject.value;
  }

  private loadStoredHistory(): SpinResultPayload[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(BET_HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .slice(0, 50)
        .map((item) => ({
          ...item,
          time: new Date(item.time),
        }))
        .filter((item) => !Number.isNaN(item.time.getTime()));
    } catch {
      return [];
    }
  }

  private persistHistory(history: SpinResultPayload[]): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(BET_HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // ignore storage write errors
    }
  }

  private toNumericId(value: string | number | undefined): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      this.nextNumericId = Math.max(this.nextNumericId, value + 1);
      return value;
    }

    if (typeof value === 'string' && /^\d+$/.test(value)) {
      const parsed = Number(value);
      this.nextNumericId = Math.max(this.nextNumericId, parsed + 1);
      return parsed;
    }

    const id = this.nextNumericId;
    this.nextNumericId += 1;
    return id;
  }
}
