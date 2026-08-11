import { Component, effect, OnDestroy } from '@angular/core';
import { Toggle } from '../../services/toggle';
import { ModalVisibilityController } from '../../services/modal-visibility';

@Component({
  selector: 'app-autoplay-modal',
  imports: [],
  templateUrl: './autoplay-modal.html',
  styleUrl: './autoplay-modal.css',
})
export class AutoplayModal implements OnDestroy {
  readonly roundOptions = [3, 10, 25, 100, 200, 500];
  selectedRounds = 10;
  readonly visibility = new ModalVisibilityController(500);

  constructor(public toggle: Toggle) {
    effect(() => {
      this.visibility.sync(this.toggle.isOpenAutoModal());
    });
  }

  ngOnDestroy(): void {
    this.visibility.destroy();
  }

  selectRounds(rounds: number): void {
    this.selectedRounds = rounds;
  }

  startAuto(): void {
    this.toggle.closeAutoModal();
  }
}
