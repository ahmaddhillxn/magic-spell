import { GAME_ASSETS } from '../game-assets';
import { ResourceLoaderService } from '../services/resource-loader';

type SoundGate = () => boolean;

/**
 * Central audio scene — all game sounds play here in a fixed order:
 * 1. UI click → duck bg → click SFX
 * 2. Bet → second click → spine loop (Web Audio scheduled on Safari)
 * 3. Round end → win/lose (scheduled on Web Audio clock during bet gesture)
 */
export class SoundScene {
  private bgAudio: HTMLAudioElement | null = null;
  private bgDuckTimer: ReturnType<typeof setTimeout> | null = null;
  private spineSoundTimer: ReturnType<typeof setTimeout> | null = null;
  private spineAudio: HTMLAudioElement | null = null;
  private userInteracted = false;
  private roundAudioScheduled = false;

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

  /** Bet button click SFX. */
  playBetClick(): void {
    this.loader.prepareAudio();
    this.loader.primeSound(GAME_ASSETS.sounds.win);
    this.loader.primeSound(GAME_ASSETS.sounds.lose);
    this.loader.primeSound(GAME_ASSETS.sounds.spine);
    this.playUiSound(
      GAME_ASSETS.sounds.secondClick,
      this.sfxButtonVolume,
      this.uiDuckMs,
      this.sfxBetGain,
    );
  }

  /** @deprecated use {@link playBetClick} */
  playBetSequence(): void {
    this.playBetClick();
  }

  /**
   * Schedule spine + win/lose on the Web Audio timeline (Safari-safe — call synchronously from bet click).
   */
  startRoundAudio(didWin: boolean, countingMs: number): void {
    if (!this.isSoundOn() || !this.isTabAudible()) return;

    this.loader.prepareAudio();
    this.loader.cancelScheduledAudio();
    this.roundAudioScheduled = false;

    const spineStartSec = this.spineDelayMs / 1000;
    const resultDelaySec = (countingMs + 50) / 1000;
    const spineDurationSec = Math.max(0.08, resultDelaySec - spineStartSec);
    const resultUrl = didWin ? GAME_ASSETS.sounds.win : GAME_ASSETS.sounds.lose;

    this.duckBackground(this.spineDuckMs);

    const spineScheduled = this.loader.scheduleDecodedLoop(
      GAME_ASSETS.sounds.spine,
      this.sfxSpineVolume,
      spineStartSec,
      spineDurationSec,
    );
    const resultScheduled = this.loader.scheduleDecodedSound(
      resultUrl,
      this.sfxResultVolume,
      resultDelaySec,
    );

    this.roundAudioScheduled = spineScheduled && resultScheduled;
    if (spineScheduled) {
      this.duckBackground(this.resultDuckMs);
    }

    if (!spineScheduled) {
      this.scheduleSpineSoundHtml();
    }
  }

  /** Fallback when counting ends — only if Web Audio schedule failed. */
  playRoundResult(didWin: boolean): void {
    this.stopSpineSound();
    if (this.roundAudioScheduled) {
      this.roundAudioScheduled = false;
      return;
    }
    const url = didWin ? GAME_ASSETS.sounds.win : GAME_ASSETS.sounds.lose;
    window.setTimeout(() => this.playResultSound(url), 50);
  }

  cancelPendingRoundSounds(): void {
    if (this.spineSoundTimer !== null) {
      clearTimeout(this.spineSoundTimer);
      this.spineSoundTimer = null;
    }
    this.loader.cancelScheduledAudio();
    this.roundAudioScheduled = false;
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

  private scheduleSpineSoundHtml(): void {
    if (this.spineSoundTimer !== null) {
      clearTimeout(this.spineSoundTimer);
    }
    this.spineSoundTimer = window.setTimeout(() => {
      this.spineSoundTimer = null;
      this.playSpineSoundHtml();
    }, this.spineDelayMs);
  }

  private playUiSound(url: string, volume: number, duckMs: number, gain = 1): void {
    if (!this.isSoundOn() || !this.isTabAudible()) return;
    this.loader.prepareAudio();
    this.duckBackground(duckMs);
    this.loader.playSound(url, volume, gain);
  }

  private playSpineSoundHtml(): void {
    if (!this.isSoundOn() || !this.isTabAudible()) return;
    this.loader.prepareAudio();
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
    this.loader.stopDecodedLoop(GAME_ASSETS.sounds.spine);
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
