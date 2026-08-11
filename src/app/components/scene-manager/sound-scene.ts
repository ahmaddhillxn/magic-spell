import { Injectable } from '@angular/core';
import { GAME_ASSETS } from '../components/game-assets';

/** Sound scene volumes / loop settings */
export const SOUND_SCENE_CONFIG = {
  bgVolume: 0.35,
  clickVolume: 0.7,
  turboVolume: 0.75,
  /** Soft bubble when ball hits a peg — keep modest (many hits). */
  pegHitVolume: 0.55,
  /** Max overlapping one-shot SFX (prevents clone spam). */
  maxOneShots: 8,
  /** Prefetched voices — never cloneNode during the game ticker. */
  pegHitPoolSize: 3,
  /** Min ms between peg-hit plays under multi-ball. */
  pegHitMinIntervalMs: 55,
} as const;

export const SOUND_ASSETS = {
  bg: GAME_ASSETS.sounds.bg,
  click: GAME_ASSETS.sounds.click,
  turbo: GAME_ASSETS.sounds.turbo,
  pegHit: GAME_ASSETS.sounds.pegHit,
} as const;

/**
 * Game audio scene — single background loop + pooled one-shot SFX.
 * Safe to call init() many times; never creates duplicate BGM instances.
 */
@Injectable({ providedIn: 'root' })
export class SoundScene {
  private enabled = true;
  private unlocked = false;
  private tabVisible = typeof document === 'undefined' ? true : !document.hidden;
  private bg: HTMLAudioElement | null = null;
  private click: HTMLAudioElement | null = null;
  private turbo: HTMLAudioElement | null = null;
  private pegHit: HTMLAudioElement | null = null;
  private pegHitPool: HTMLAudioElement[] = [];
  private pegHitPoolIndex = 0;
  private lastPegHitAt = 0;
  /** Shared in-flight load — concurrent init() callers await the same promise. */
  private initPromise: Promise<void> | null = null;
  private ready = false;
  private visibilityBound = false;
  private activeOneShots = 0;
  private readonly onVisibility = () => this.handleVisibilityChange();
  private readonly isIOS =
    typeof navigator !== 'undefined' &&
    (/iP(ad|hone|od)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  /** Preload all scene sounds (idempotent — safe to call multiple times). */
  async init(enabled = true): Promise<void> {
    this.enabled = enabled;
    this.bindVisibility();

    if (!this.initPromise) {
      this.initPromise = this.loadAll();
    }

    await this.initPromise;
    this.setEnabled(this.enabled);
  }

  /** Mute / unmute — pauses or resumes the single background track. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!this.bg) return;

    if (!on) {
      this.bg.pause();
      return;
    }

    if (this.unlocked && this.tabVisible) {
      this.startBg();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Call from any click/tap — unlocks audio for autoplay policy.
   * Starts the single background track if sound is on.
   */
  unlock(): void {
    if (this.unlocked) {
      if (this.enabled && this.tabVisible) this.startBg();
      return;
    }
    this.unlocked = true;
    if (this.enabled && this.tabVisible) {
      this.startBg();
    }
  }

  /** Looping background music — only one HTMLAudioElement ever plays. */
  startBg(): void {
    if (!this.enabled || !this.tabVisible || !this.bg) return;

    // Already playing — do not restart / do not create another instance
    if (!this.bg.paused && !this.bg.ended) return;

    try {
      this.bg.volume = SOUND_SCENE_CONFIG.bgVolume;
      this.bg.loop = true;
      void this.bg.play().catch(() => undefined);
    } catch {
      /* ignore autoplay rejection */
    }
  }

  stopBg(): void {
    if (!this.bg) return;
    this.bg.pause();
  }

  /** UI button click SFX. */
  playClick(): void {
    this.playOneShot(this.click, SOUND_SCENE_CONFIG.clickVolume);
  }

  /** Turbo / ball-speed SFX. */
  playTurbo(): void {
    this.playOneShot(this.turbo, SOUND_SCENE_CONFIG.turboVolume);
  }

  /** Soft water-drop when ball hits a peg — pooled (iOS Safari safe). */
  playPegHit(): void {
    if (!this.enabled || !this.tabVisible || this.pegHitPool.length === 0) return;

    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    // iOS Chrome freezes if HTMLAudio seeks every peg hit under multi-ball.
    const minInterval = this.isIOS
      ? SOUND_SCENE_CONFIG.pegHitMinIntervalMs * 3
      : SOUND_SCENE_CONFIG.pegHitMinIntervalMs;
    if (now - this.lastPegHitAt < minInterval) {
      return;
    }
    this.lastPegHitAt = now;

    if (!this.unlocked) {
      this.unlocked = true;
      this.startBg();
    }

    const shot = this.pegHitPool[this.pegHitPoolIndex];
    this.pegHitPoolIndex = (this.pegHitPoolIndex + 1) % this.pegHitPool.length;

    try {
      if (this.isIOS) {
        // Never pause/seek on iOS — that stalls the game ticker.
        if (!shot.paused && !shot.ended) return;
        shot.volume = SOUND_SCENE_CONFIG.pegHitVolume;
        void shot.play().catch(() => undefined);
        return;
      }

      shot.pause();
      shot.currentTime = 0;
      shot.volume = SOUND_SCENE_CONFIG.pegHitVolume;
      void shot.play().catch(() => undefined);
    } catch {
      /* iOS can throw on seek — never let that reach the game ticker */
    }
  }

  /**
   * Pause audio when the game shell unmounts.
   * Does NOT destroy the singleton Audio elements (avoids orphan overlapping BGM).
   */
  destroy(): void {
    this.stopBg();
    this.unlocked = false;
  }

  private bindVisibility(): void {
    if (typeof document === 'undefined' || this.visibilityBound) return;
    document.addEventListener('visibilitychange', this.onVisibility);
    this.visibilityBound = true;
    this.tabVisible = !document.hidden;
  }

  private handleVisibilityChange(): void {
    this.tabVisible = typeof document === 'undefined' ? true : !document.hidden;

    if (!this.tabVisible) {
      this.bg?.pause();
      return;
    }

    if (this.enabled && this.unlocked) {
      this.startBg();
    }
  }

  private async loadAll(): Promise<void> {
    // Already have the singleton instances
    if (this.ready && this.bg && this.click && this.turbo && this.pegHit) {
      return;
    }

    // If a previous partial load left orphans, silence them first
    this.stopAndDispose(this.bg);
    this.stopAndDispose(this.click);
    this.stopAndDispose(this.turbo);
    this.stopAndDispose(this.pegHit);
    for (const shot of this.pegHitPool) {
      this.stopAndDispose(shot);
    }
    this.bg = null;
    this.click = null;
    this.turbo = null;
    this.pegHit = null;
    this.pegHitPool = [];
    this.pegHitPoolIndex = 0;

    const [bg, click, turbo, pegHit] = await Promise.all([
      this.loadAudio(SOUND_ASSETS.bg),
      this.loadAudio(SOUND_ASSETS.click),
      this.loadAudio(SOUND_ASSETS.turbo),
      this.loadAudio(SOUND_ASSETS.pegHit),
    ]);

    // Another concurrent load shouldn't overwrite — only first assignment wins
    if (this.bg) {
      this.stopAndDispose(bg);
      this.stopAndDispose(click);
      this.stopAndDispose(turbo);
      this.stopAndDispose(pegHit);
      return;
    }

    bg.loop = true;
    bg.volume = SOUND_SCENE_CONFIG.bgVolume;
    bg.preload = 'auto';

    this.bg = bg;
    this.click = click;
    this.turbo = turbo;
    this.pegHit = pegHit;

    const pool: HTMLAudioElement[] = [];
    for (let i = 0; i < SOUND_SCENE_CONFIG.pegHitPoolSize; i++) {
      const shot = pegHit.cloneNode(true) as HTMLAudioElement;
      shot.preload = 'auto';
      shot.volume = SOUND_SCENE_CONFIG.pegHitVolume;
      pool.push(shot);
    }
    this.pegHitPool = pool;
    this.ready = true;
  }

  private playOneShot(source: HTMLAudioElement | null, volume: number): void {
    if (!this.enabled || !this.tabVisible || !source) return;

    if (!this.unlocked) {
      this.unlocked = true;
      this.startBg();
    }

    if (this.activeOneShots >= SOUND_SCENE_CONFIG.maxOneShots) {
      // Reuse source directly instead of stacking more clones
      try {
        source.pause();
        source.currentTime = 0;
        source.volume = volume;
        void source.play().catch(() => undefined);
      } catch {
        /* ignore */
      }
      return;
    }

    const shot = source.cloneNode(true) as HTMLAudioElement;
    shot.volume = volume;
    try {
      shot.currentTime = 0;
    } catch {
      /* ignore */
    }
    this.activeOneShots += 1;

    const release = () => {
      this.activeOneShots = Math.max(0, this.activeOneShots - 1);
      shot.removeEventListener('ended', release);
      shot.removeEventListener('error', release);
      try {
        shot.src = '';
        shot.load();
      } catch {
        /* ignore */
      }
    };
    shot.addEventListener('ended', release, { once: true });
    shot.addEventListener('error', release, { once: true });

    void shot.play().catch(() => {
      release();
    });
  }

  private stopAndDispose(audio: HTMLAudioElement | null): void {
    if (!audio) return;
    try {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    } catch {
      /* ignore */
    }
  }

  private loadAudio(src: string): Promise<HTMLAudioElement> {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.preload = 'auto';
      const done = () => resolve(audio);
      audio.addEventListener('canplaythrough', done, { once: true });
      audio.addEventListener('error', done, { once: true });
      audio.src = src;
      audio.load();
    });
  }
}
