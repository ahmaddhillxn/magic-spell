import { GAME_ASSETS } from '../game-assets';
import { ResourceLoaderService } from '../services/resource-loader';

type SoundGate = () => boolean;

/**
 * Central audio scene — all game sounds play here in a fixed order:
 * 1. UI click → duck bg → click SFX
 * 2. Bet → second click → (delay) spine loop
 * 3. Round end → stop spine → win/lose
 */
export class SoundScene {
  private bgAudio: HTMLAudioElement | null = null;
  private bgDuckTimer: ReturnType<typeof setTimeout> | null = null;
  private spineSoundTimer: ReturnType<typeof setTimeout> | null = null;
  private spineAudio: HTMLAudioElement | null = null;
  private userInteracted = false;

  private readonly bgVolume = 0.18;
  private readonly bgDuckedVolume = 0.07;
  private readonly sfxButtonVolume = 1;
  /** secondLevelButtonsSound.mp3 is mastered quieter than buttonsSound.mp3 */
  private readonly sfxBetGain = 1.85;
  private readonly sfxSpineVolume = 1;
  private readonly sfxResultVolume = 1;
  private readonly uiDuckMs = 700;
  private readonly spineDuckMs = 3200;
  private readonly resultDuckMs = 2800;
  private readonly spineDelayMs = 120;

  constructor(
    private readonly loader: ResourceLoaderService,
    private readonly isSoundOn: SoundGate,
    private readonly isTabAudible: SoundGate,
  ) {}

  get hasUserInteracted(): boolean {
    return this.userInteracted;
  }

  /** First user gesture — unlock pools and start background music. */
  markInteraction(): void {
    if (this.userInteracted) return;
    this.userInteracted = true;
    this.loader.unlockAudio();
    this.startBackground();
  }

  /** Amount/payout +/- and bet-amount open. */
  playUiClick(): void {
    this.playUiSound(GAME_ASSETS.sounds.click, this.sfxButtonVolume, this.uiDuckMs);
  }

  /**
   * Bet button — second click SFX only (spine starts in {@link startRoundSpine}).
   */
  playBetClick(): void {
    this.loader.unlockAudio();
    this.loader.primeSound(GAME_ASSETS.sounds.win);
    this.loader.primeSound(GAME_ASSETS.sounds.lose);
    this.playUiSound(
      GAME_ASSETS.sounds.secondClick,
      this.sfxButtonVolume,
      this.uiDuckMs,
      this.sfxBetGain,
    );
  }

  /** @deprecated use {@link playBetClick} + {@link startRoundSpine} */
  playBetSequence(): void {
    this.playBetClick();
  }

  /**
   * Wizard round SFX — call after round timers reset so pending spine is not cancelled.
   */
  startRoundSpine(): void {
    this.scheduleSpineSound();
  }

  /**
   * Multiplier counting finished — ordered sequence:
   * stop spine loop, then play win or lose.
   */
  playRoundResult(didWin: boolean): void {
    this.stopSpineSound();
    const url = didWin ? GAME_ASSETS.sounds.win : GAME_ASSETS.sounds.lose;
    // Brief gap so looping spine releases the audio session before win/lose.
    window.setTimeout(() => this.playResultSound(url), 50);
  }

  cancelPendingRoundSounds(): void {
    if (this.spineSoundTimer !== null) {
      clearTimeout(this.spineSoundTimer);
      this.spineSoundTimer = null;
    }
    this.stopSpineSound();
  }

  startBackground(): void {
    if (!this.isSoundOn() || !this.userInteracted || !this.isTabAudible()) return;
    if (!this.bgAudio) {
      this.bgAudio = this.loader.createAudio(GAME_ASSETS.sounds.bg);
      this.bgAudio.loop = true;
      this.bgAudio.volume = this.bgVolume;
      void this.bgAudio.load();
    }
    if (!this.bgAudio.paused) return;
    void this.bgAudio.play().catch(() => {
      // Browser may block autoplay until stronger user gesture.
    });
  }

  stopBackground(): void {
    if (this.bgDuckTimer !== null) {
      clearTimeout(this.bgDuckTimer);
      this.bgDuckTimer = null;
    }
    if (!this.bgAudio) return;
    this.bgAudio.pause();
    this.bgAudio.currentTime = 0;
  }

  pauseAll(): void {
    this.cancelPendingRoundSounds();
    if (this.spineAudio) {
      this.spineAudio.pause();
      try {
        this.spineAudio.currentTime = 0;
      } catch {
        // Ignore seek errors.
      }
    }
    this.loader.pauseAllSounds();
    this.stopBackground();
  }

  destroy(): void {
    this.pauseAll();
    this.spineAudio = null;
    this.bgAudio = null;
  }

  private scheduleSpineSound(): void {
    if (this.spineSoundTimer !== null) {
      clearTimeout(this.spineSoundTimer);
    }
    this.spineSoundTimer = window.setTimeout(() => {
      this.spineSoundTimer = null;
      this.playSpineSound();
    }, this.spineDelayMs);
  }

  private playUiSound(url: string, volume: number, duckMs: number, gain = 1): void {
    if (!this.isSoundOn() || !this.isTabAudible()) return;
    this.loader.unlockAudio();
    this.duckBackground(duckMs);
    this.loader.playSound(url, volume, gain);
  }

  private playSpineSound(): void {
    if (!this.isSoundOn() || !this.isTabAudible()) return;
    this.loader.unlockAudio();
    this.duckBackground(this.spineDuckMs);

    if (!this.spineAudio) {
      this.spineAudio = this.loader.createAudio(GAME_ASSETS.sounds.spine);
      this.spineAudio.loop = true;
      this.spineAudio.preload = 'auto';
      void this.spineAudio.load();
    }

    this.spineAudio.volume = this.sfxSpineVolume;
    try {
      this.spineAudio.currentTime = 0;
    } catch {
      // Ignore seek errors on not-yet-ready audio.
    }
    void this.spineAudio.play().catch(() => {
      this.loader.playSound(GAME_ASSETS.sounds.spine, this.sfxSpineVolume);
    });
  }

  private stopSpineSound(): void {
    if (this.spineAudio) {
      this.spineAudio.pause();
      try {
        this.spineAudio.currentTime = 0;
      } catch {
        // Ignore seek errors.
      }
    }
    this.loader.stopSound(GAME_ASSETS.sounds.spine);
  }

  private playResultSound(url: string): void {
    if (!this.isSoundOn() || !this.isTabAudible()) return;
    this.duckBackground(this.resultDuckMs);

    if (this.loader.playDecodedSound(url, this.sfxResultVolume)) {
      return;
    }

    this.loader.playSound(url, this.sfxResultVolume);
  }

  private duckBackground(durationMs: number): void {
    if (!this.bgAudio || this.bgAudio.paused) return;
    this.bgAudio.volume = this.bgDuckedVolume;
    if (this.bgDuckTimer !== null) {
      clearTimeout(this.bgDuckTimer);
    }
    this.bgDuckTimer = setTimeout(() => this.restoreBackgroundVolume(), durationMs);
  }

  private restoreBackgroundVolume(): void {
    this.bgDuckTimer = null;
    if (this.bgAudio && !this.bgAudio.paused) {
      this.bgAudio.volume = this.bgVolume;
    }
  }
}
