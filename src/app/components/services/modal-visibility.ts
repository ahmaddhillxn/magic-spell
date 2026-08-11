import { signal } from '@angular/core';

/**
 * Keeps modal mounted while close (exit) CSS transitions finish.
 * Uses signals so zoneless Angular updates the view (setTimeout alone will not).
 */
export class ModalVisibilityController {
  private readonly _visible = signal(false);
  private readonly _active = signal(false);

  readonly visible = this._visible.asReadonly();
  readonly active = this._active.asReadonly();

  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly hideDelayMs = 500) {}

  sync(open: boolean): void {
    if (open) {
      this.clearHideTimer();
      this.clearOpenTimer();
      this._visible.set(true);
      this._active.set(false);
      // Let closed styles paint, then activate enter animation.
      this.openTimer = setTimeout(() => {
        this._active.set(true);
        this.openTimer = null;
      }, 20);
      return;
    }

    this.clearOpenTimer();
    if (!this._visible()) return;

    this._active.set(false);
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      this._visible.set(false);
      this.hideTimer = null;
    }, this.hideDelayMs);
  }

  destroy(): void {
    this.clearOpenTimer();
    this.clearHideTimer();
  }

  private clearOpenTimer(): void {
    if (this.openTimer === null) return;
    clearTimeout(this.openTimer);
    this.openTimer = null;
  }

  private clearHideTimer(): void {
    if (this.hideTimer === null) return;
    clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }
}
