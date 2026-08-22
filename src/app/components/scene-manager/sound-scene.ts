import { GAME_ASSETS } from '../game-assets';
import { ResourceLoaderService } from '../services/resource-loader';

type SoundGate = () => boolean;

/**
 * Central audio scene — all game sounds play here in a fixed order:
 * 1. UI click → duck bg → click SFX
 * 2. Bet → second click → spine loop (Web Audio scheduled on Safari)
 * 3. Round end → win/lose via primed HTML audio (Safari-safe delayed playback)
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
    this.loader.prepareAudio();
    this.startBackground();
    this.loader.unlockAudio();
  }

  /** Amount/payout +/- and bet-amount open. */
  playUiClick(): void {
    this.playUiSound(GAME_ASSETS.sounds.click, this.sfxButtonVolume, this.uiDuckMs);
  }

  /**
   * Prime win/lose for delayed playback at counting end.
   */
  primeRoundResults(): void {
    this.loader.primeSound(GAME_ASSETS.sounds.win);
    this.loader.primeSound(GAME_ASSETS.sounds.lose);
  }

  /** Bet button click SFX. */
  playBetClick(): void {
    this.loader.prepareAudio();
    const gain = this.loader.isMobileSafari() ? 1 : this.sfxBetGain;
    this.playUiSound(
      GAME_ASSETS.sounds.secondClick,
      this.sfxButtonVolume,
      this.uiDuckMs,
      gain,
    );
    this.startBackground();
  }

  /** @deprecated use {@link playBetClick} */
  playBetSequence(): void {
    this.playBetClick();
  }

  /**
   * Schedule spine during bet tap; win/lose play via primed element at counting end.
   */
  startRoundAudio(didWin: boolean, countingMs: number): void {
    if (!this.isSoundOn() || !this.isTabAudible()) return;

    this.loader.prepareAudio();
    this.loader.cancelScheduledAudio();
    this.primeRoundResults();

    this.duckBackground(this.spineDuckMs);

    if (this.loader.isMobileSafari()) {
      // Safari blocks setTimeout/Web-Audio-delayed SFX — play spine in the same tap gesture.
      this.playSpineSoundHtml();
      return;
    }

    const spineStartSec = this.spineDelayMs / 1000;
    const resultDelaySec = (countingMs + 50) / 1000;
    const spineDurationSec = Math.max(0.08, resultDelaySec - spineStartSec);

    const spineScheduled = this.loader.scheduleDecodedLoop(
      GAME_ASSETS.sounds.spine,
      this.sfxSpineVolume,
      spineStartSec,
      spineDurationSec,
    );

    if (spineScheduled) {
      this.duckBackground(this.resultDuckMs);
    } else {
      this.scheduleSpineSoundHtml();
    }
  }

  /** Play win/lose when counting ends. */
  playRoundResult(didWin: boolean): void {
    this.stopSpineSound();

    const url = didWin ? GAME_ASSETS.sounds.win : GAME_ASSETS.sounds.lose;
    this.playResultSound(url);
  }

  cancelPendingRoundSounds(): void {
    if (this.spineSoundTimer !== null) {
      clearTimeout(this.spineSoundTimer);
      this.spineSoundTimer = null;
    }
    this.loader.cancelScheduledAudio();
    this.stopSpineSound();
  }

  startBackground(): void {
    if (!this.isSoundOn() || !this.userInteracted || !this.isTabAudible()) return;

    if (!this.bgAudio) {
      const cached = this.loader.get<HTMLAudioElement>(GAME_ASSETS.sounds.bg);
      this.bgAudio = cached ?? this.loader.createAudio(GAME_ASSETS.sounds.bg);
      this.bgAudio.loop = true;
      this.bgAudio.volume = this.bgVolume;
      if (!cached) void this.bgAudio.load();
    }

    this.playBackgroundNow();
  }

  private playBackgroundNow(): void {
    if (!this.bgAudio || !this.isSoundOn() || !this.isTabAudible()) return;
    if (!this.bgAudio.paused) return;

    const play = (): void => {
      if (!this.bgAudio || !this.isSoundOn()) return;
      this.bgAudio.volume = this.bgVolume;
      void this.bgAudio.play().catch(() => {
        // Retry once media is ready (common on iOS first gesture).
      });
    };

    if (this.bgAudio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      play();
      return;
    }

    const onReady = (): void => {
      this.bgAudio?.removeEventListener('canplaythrough', onReady);
      this.bgAudio?.removeEventListener('loadeddata', onReady);
      play();
    };

    this.bgAudio.addEventListener('canplaythrough', onReady, { once: true });
    this.bgAudio.addEventListener('loadeddata', onReady, { once: true });
    if (this.bgAudio.readyState === HTMLMediaElement.HAVE_NOTHING) {
      void this.bgAudio.load();
    }
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
      this.spineAudio.volume = this.sfxSpineVolume;
      void this.spineAudio.load();
    }

    this.spineAudio.volume = this.sfxSpineVolume;
    try {
      this.spineAudio.pause();
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
    this.loader.prepareAudio();
    this.duckBackground(this.resultDuckMs);

    if (this.loader.playPrimedSound(url, this.sfxResultVolume)) {
      return;
    }
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
