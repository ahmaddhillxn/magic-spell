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

@Injectable({ providedIn: 'root' })
export class BetHistoryService {
  private readonly historySubject = new BehaviorSubject<SpinResultPayload[]>([]);
  readonly history$ = this.historySubject.asObservable();
  private nextNumericId = 253;

  /** @deprecated Prefer history$; kept for single-event listeners */
  private readonly spinResultSubject = new BehaviorSubject<SpinResultPayload | null>(null);
  spinResult$ = this.spinResultSubject.asObservable();

  emitSpinResult(data: SpinResultPayload) {
    const id = this.toNumericId(data.id);
    const payload = { ...data, id };
    const next = [payload, ...this.historySubject.value].slice(0, 50);
    this.historySubject.next(next);
    this.spinResultSubject.next(payload);
  }

  getHistory(): SpinResultPayload[] {
    return this.historySubject.value;
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
