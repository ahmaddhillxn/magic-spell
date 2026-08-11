import { Component, effect, OnDestroy } from '@angular/core';
import { Toggle } from '../../services/toggle';
import { ModalVisibilityController } from '../../services/modal-visibility';

@Component({
  selector: 'app-guideness-modal',
  imports: [],
  templateUrl: './guideness-modal.html',
  styleUrl: './guideness-modal.css',
})
export class GuidenessModal implements OnDestroy {
  currentSlide = 0;
  readonly totalSlides = 5;
  readonly visibility = new ModalVisibilityController(500);

  constructor(public betSlipToggle: Toggle) {
    effect(() => {
      const open = this.betSlipToggle.isOpenGameQuideModal();
      this.visibility.sync(open);
      if (open) {
        this.currentSlide = 0;
      }
    });
  }

  ngOnDestroy(): void {
    this.visibility.destroy();
  }

  goNext(): void {
    if (this.currentSlide < this.totalSlides - 1) {
      this.currentSlide += 1;
      return;
    }

    // Keep current slide while exit animation plays — reset only on next open
    this.betSlipToggle.closeGameGuide();
  }

  goPrev(): void {
    if (this.currentSlide > 0) {
      this.currentSlide -= 1;
    }
  }
}
