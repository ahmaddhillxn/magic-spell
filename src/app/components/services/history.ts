import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface SpinResultPayload {
  id: string;
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

  /** @deprecated Prefer history$; kept for single-event listeners */
  private readonly spinResultSubject = new BehaviorSubject<SpinResultPayload | null>(null);
  spinResult$ = this.spinResultSubject.asObservable();

  emitSpinResult(data: SpinResultPayload) {
    const next = [data, ...this.historySubject.value].slice(0, 50);
    this.historySubject.next(next);
    this.spinResultSubject.next(data);
  }

  getHistory(): SpinResultPayload[] {
    return this.historySubject.value;
  }
}
