import { Component, effect, OnDestroy } from '@angular/core';
import { Toggle } from '../../services/toggle';
import { ModalVisibilityController } from '../../services/modal-visibility';
import { GAME_ASSETS } from '../../game-assets';

export interface GuideSlide {
  title: string;
  description?: string;
  listItems?: string[];
  image?: string;
  imageMobile?: string;
  showLimits?: boolean;
}

@Component({
  selector: 'app-guideness-modal',
  imports: [],
  templateUrl: './guideness-modal.html',
  styleUrl: './guideness-modal.css',
})
export class GuidenessModal implements OnDestroy {
  currentSlide = 0;
  readonly visibility = new ModalVisibilityController(500);

  readonly slides: GuideSlide[] = [
    {
      title: 'The Game Board',
      description:
        'Welcome to Magic Spell! Cast a magic spell to get a random multiplier. If the multiplier is equal to or higher than your payout, you win! But if the magic fails, you lose and the round ends.',
      listItems: [
        'Watch the wizard do magic and see your multiplier. On the top side, you can see the results of past rounds to help you choose your next bet.',
      ],
      image: GAME_ASSETS.images.gameBoard,
      imageMobile: GAME_ASSETS.images.gameBoardMobile,
    },
    {
      title: 'Making Moves',
      listItems: [
        'Set your payout to choose how much you want to win.',
        'Choose your bet and payout, then click the bet button to start the magic spell.',
        'If the magic fails, you lose your bet. If it works, coins will appear in the magic circle and you win!',
      ],
      image: GAME_ASSETS.images.makingMove,
      imageMobile: GAME_ASSETS.images.makingMoveMobile,
    },
    {
      title: 'Bet Selector',
      description:
        'Choose your bet using the Bet Selector in the betting area, select a preset amount, then press Apply Bet to confirm your choice.',
      image: GAME_ASSETS.icons.amountPopup,
    },
    {
      title: 'Last Results',
      description:
        'The Last Results section shows multipliers from previous rounds. You can use these past numbers to help you make better betting choices.',
      image: GAME_ASSETS.images.resultStrip,
    },
    {
      title: 'Game Limits',
      description: 'Game limits are set by the operator. The limits for this game are shown below.',
      showLimits: true,
    },
  ];

  get totalSlides(): number {
    return this.slides.length;
  }

  get slide(): GuideSlide {
    return this.slides[this.currentSlide];
  }

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
    this.betSlipToggle.closeGameGuide();
  }

  goPrev(): void {
    if (this.currentSlide > 0) {
      this.currentSlide -= 1;
    }
  }
}
