import { CommonModule } from '@angular/common';
import { Component, effect, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { BetHistoryService } from '../../services/history';
import { Toggle } from '../../services/toggle';
import { ModalVisibilityController } from '../../services/modal-visibility';

@Component({
  selector: 'app-bet-history-modal',
  imports: [CommonModule],
  templateUrl: './bet-history-modal.html',
  styleUrl: './bet-history-modal.css',
})
export class BetHistoryModal implements OnInit, OnDestroy {
  historyList: any[] = [];
  readonly visibility = new ModalVisibilityController(500);
  private readonly destroy$ = new Subject<void>();

  constructor(
    public betSlipToggle: Toggle,
    private historyService: BetHistoryService,
  ) {
    effect(() => {
      this.visibility.sync(this.betSlipToggle.isOpenBetHistory());
    });
  }

  ngOnInit(): void {
    this.historyService.history$.pipe(takeUntil(this.destroy$)).subscribe((list) => {
      this.historyList = list.map((item) => ({
        ...item,
        time: item.time instanceof Date ? item.time : new Date(item.time),
      }));
    });
  }

  ngOnDestroy(): void {
    this.visibility.destroy();
    this.destroy$.next();
    this.destroy$.complete();
  }

  getBetTime(item: any): Date | string | null {
    return item?.time ?? item?.updatedAt ?? item?.createdAt ?? item?.betTime ?? null;
  }

  getHourValue(item: any): string {
    const date = this.toDate(this.getBetTime(item));
    if (!date) return '--';
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  getDayValue(item: any): string {
    const date = this.toDate(this.getBetTime(item));
    if (!date) return '--';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  getBetAmount(item: any): number | string {
    return (
      this.toNumber(item?.betAmount) ??
      this.toNumber(item?.stake) ??
      this.toNumber(item?.amount) ??
      this.toNumber(item?.bet?.amount) ??
      '-'
    );
  }

  getMultiplier(item: any): number | string {
    if (this.isLossEntry(item)) return '--';
    return this.toNumber(item?.result) ?? this.toNumber(item?.multiplier) ?? '-';
  }

  getWinAmount(item: any): number | string {
    if (this.isLossEntry(item)) return '--';
    return (
      this.toNumber(item?.winAmount) ??
      this.toNumber(item?.cashoutAmount) ??
      this.toNumber(item?.cashout) ??
      this.toNumber(item?.win) ??
      '-'
    );
  }

  private isLossEntry(item: any): boolean {
    if (item?.win === false) return true;

    const winAmount =
      this.toNumber(item?.winAmount) ??
      this.toNumber(item?.cashoutAmount) ??
      this.toNumber(item?.cashout);
    const multiplier = this.toNumber(item?.result) ?? this.toNumber(item?.multiplier);

    // Fallback for records that do not include explicit boolean status.
    return (winAmount ?? 0) <= 0 && (multiplier ?? 0) <= 0;
  }

  private toDate(value: Date | string | null): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    if (typeof value === 'object') {
      const decimalValue = value.$numberDecimal ?? value.value;
      if (decimalValue !== undefined) {
        const parsed = Number(decimalValue);
        return Number.isFinite(parsed) ? parsed : null;
      }
    }

    return null;
  }
}
