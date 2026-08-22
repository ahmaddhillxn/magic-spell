// src/app/services/resource-loader.service.ts

import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ResourceLoaderService {
  private readonly soundPoolSize = 6;
  private urls: string[] = [];
  private cache = new Map<string, HTMLImageElement | HTMLAudioElement | HTMLVideoElement>();
  private soundPools = new Map<string, HTMLAudioElement[]>();
  private audioUnlocked = false;
  private tabAudible = true;
  private audioContext: AudioContext | null = null;
  private bufferCache = new Map<string, AudioBuffer>();
  /** Separate elements for iOS delayed playback — never shared with immediate SFX pool. */
  private readonly delayedAudio = new Map<string, HTMLAudioElement>();
  private readonly loopSources = new Map<string, AudioBufferSourceNode>();
  private readonly scheduledSources: AudioBufferSourceNode[] = [];

  private _progress = signal(0);
  readonly progress = this._progress.asReadonly();

  private _displayProgress = signal(0);
  readonly displayProgress = this._displayProgress.asReadonly();

  readonly percent = computed(() => Math.round(this._displayProgress() * 100));

  private _isLoaded = signal(false);
  readonly isLoaded = this._isLoaded.asReadonly();

  /** DOM/image assets finished downloading */
  private assetsDone = false;
  /** Pixi board (pegs/bins) finished building */
  private sceneReady = false;
  private finishTimer: ReturnType<typeof setTimeout> | null = null;
  private finishRaf: number | null = null;

  constructor() {
    if (typeof document !== 'undefined') {
      this.tabAudible = !document.hidden;
      document.addEventListener('visibilitychange', () => {
        this.tabAudible = !document.hidden;
        if (document.hidden) this.pauseAllSounds();
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => this.pauseAllSounds());
    }

    const speed = 3; // little faster feel (was 2.5)
    let last = 0;

    const tick = (ts: number) => {
      if (!last) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;

      const target = this._progress();
      const current = this._displayProgress();

      if (Math.abs(target - current) > 0.001) {
        const step = Math.sign(target - current) * Math.min(Math.abs(target - current), speed * dt);
        this._displayProgress.set(current + step);
      } else {
        this._displayProgress.set(target);
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  registerAssets(urls: string[]) {
    this.urls = [...new Set(urls)]; // remove possible duplicates
  }

  async loadAll(): Promise<void> {
    if (!this.urls.length || this._isLoaded()) return;

    let loaded = 0;
    const total = this.urls.length;

    const update = () => {
      loaded++;
      this._progress.set(loaded / total);

      if (loaded >= total) {
        this.assetsDone = true;
        this.maybeFinish();
      }
    };

    const promises = this.urls.map((url) => {
      if (this.cache.has(url)) {
        update();
        return Promise.resolve();
      }

      // Image
      if (url.match(/\.(png|jpg|jpeg|webp|gif|avif)$/i)) {
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            this.cache.set(url, img);
            update();
            resolve();
          };
          img.onerror = () => {
            console.warn(`Image failed: ${url}`);
            update();
            resolve(); // continue anyway
          };
          img.src = url;
        });
      }

      // Audio
      if (url.match(/\.(mp3|wav|ogg|webm|m4a)$/i)) {
        return new Promise<void>((resolve) => {
          const audio = this.createAudio(url);
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            this.cache.set(url, audio);
            update();
            resolve();
          };
          audio.oncanplaythrough = finish;
          audio.onloadeddata = () => {
            if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) finish();
          };
          audio.onerror = () => {
            console.warn(`Audio failed: ${url}`);
            if (settled) return;
            settled = true;
            update();
            resolve();
          };
          void audio.load();
        });
      }

      // Spine / binary / other files → fetch into cache
      return fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          update();
        })
        .catch(() => {
          console.warn(`Asset failed: ${url}`);
          update();
        });
    });

    await Promise.all(promises);
    this.warmSoundPools();
    const audioUrls = this.urls.filter((url) => /\.(mp3|wav|ogg|webm|m4a)$/i.test(url));
    await Promise.all(audioUrls.map((url) => this.preloadBuffer(url)));
  }

  /** Call when Pixi board (pegs) is drawn — keeps loader up until pegs are visible. */
  markSceneReady(): void {
    this.sceneReady = true;
    this.maybeFinish();
  }

  private maybeFinish(): void {
    if (!this.assetsDone || !this.sceneReady || this._isLoaded()) return;
    this.waitForFullDisplayProgress();
  }

  private waitForFullDisplayProgress(): void {
    if (this.finishRaf !== null) {
      cancelAnimationFrame(this.finishRaf);
      this.finishRaf = null;
    }

    const check = (): void => {
      if (this._isLoaded()) return;

      this._progress.set(1);
      const current = this._displayProgress();

      if (current >= 0.999) {
        this._displayProgress.set(1);
        if (this.finishTimer !== null) clearTimeout(this.finishTimer);
        this.finishTimer = setTimeout(() => {
          this.finishTimer = null;
          this._isLoaded.set(true);
        }, 250);
        return;
      }

      this.finishRaf = requestAnimationFrame(check);
    };

    this.finishRaf = requestAnimationFrame(check);
  }

  get<T extends HTMLImageElement | HTMLAudioElement>(url: string): T | undefined {
    return this.cache.get(url) as T | undefined;
  }

  /** Call on every user gesture — keeps Safari AudioContext alive. */
  prepareAudio(): void {
    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    void ctx.resume().catch(() => {});

    try {
      const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      // Ignore ping failures.
    }
  }

  unlockAudio(): void {
    this.prepareAudio();
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;
    this.warmSoundPools();
    // iOS/Safari: mute-play SFX pools inside the user gesture — skip background music.
    for (const [url, pool] of this.soundPools.entries()) {
      if (this.isBackgroundSound(url)) continue;
      const audio =
        pool.find((item) => item.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) ?? pool[0];
      if (!audio) continue;

      const savedVolume = audio.volume;
      audio.volume = 0;
      void audio
        .play()
        .then(() => {
          audio.pause();
          try {
            audio.currentTime = 0;
          } catch {
            // Ignore seek errors.
          }
          audio.volume = savedVolume;
        })
        .catch(() => {
          audio.volume = savedVolume;
        });
    }
  }

  isTabAudible(): boolean {
    return this.tabAudible;
  }

  /** iOS Safari and mobile WebKit — HTML audio path is more reliable than Web Audio scheduling. */
  isMobileSafari(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isWebKitMobile =
      /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/i.test(ua) && /Mobile/i.test(ua);
    return isIOS || isWebKitMobile;
  }

  createAudio(url: string): HTMLAudioElement {
    const audio = new Audio();
    audio.src = url;
    audio.preload = 'auto';
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    return audio;
  }

  /**
   * iOS/Safari: mute-play a dedicated element during user gesture for delayed playback.
   */
  primeSound(url: string): void {
    this.primeAudioElement(this.getDelayedAudio(url));
  }

  /** Play a sound that was primed during the bet tap (Safari delayed path). */
  playPrimedSound(url: string, volume = 1): boolean {
    if (!this.tabAudible) return false;

    const audio = this.delayedAudio.get(url);
    if (!audio) return false;

    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // Ignore seek errors.
    }

    audio.volume = volume;
    void audio.play().catch((e) => console.warn(`Primed sound play failed (${url})`, e));
    return true;
  }

  private getDelayedAudio(url: string): HTMLAudioElement {
    const existing = this.delayedAudio.get(url);
    if (existing) return existing;

    const audio = this.createAudio(url);
    void audio.load();
    this.delayedAudio.set(url, audio);
    return audio;
  }

  private primeAudioElement(audio: HTMLAudioElement): void {
    const savedVolume = audio.volume;
    audio.volume = 0;
    void audio
      .play()
      .then(() => {
        audio.pause();
        try {
          audio.currentTime = 0;
        } catch {
          // Ignore seek errors.
        }
        audio.volume = savedVolume;
      })
      .catch(() => {
        audio.volume = savedVolume;
      });
  }

  /** Immediate Web Audio one-shot. */
  playDecodedSound(url: string, volume = 1): boolean {
    if (!this.tabAudible) return false;
    return this.scheduleDecodedSound(url, volume, 0);
  }

  /**
   * Schedule one-shot SFX on the Web Audio clock (Safari-safe when called inside user gesture).
   */
  scheduleDecodedSound(url: string, volume: number, delaySec: number): boolean {
    if (!this.tabAudible) return false;

    const ctx = this.ensureAudioContext();
    const buffer = this.bufferCache.get(url);
    if (!ctx || !buffer) {
      void this.preloadBuffer(url);
      return false;
    }

    // Must schedule synchronously inside the user gesture — Safari ignores deferred starts.
    void ctx.resume().catch(() => {});

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gainNode = ctx.createGain();
      gainNode.gain.value = volume;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      const when = ctx.currentTime + Math.max(0, delaySec);
      source.start(when);
      source.onended = () => {
        const idx = this.scheduledSources.indexOf(source);
        if (idx >= 0) this.scheduledSources.splice(idx, 1);
      };
      this.scheduledSources.push(source);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Loop a decoded clip between startDelaySec and startDelaySec + durationSec (Safari-safe scheduling).
   */
  scheduleDecodedLoop(
    url: string,
    volume: number,
    startDelaySec: number,
    durationSec: number,
  ): boolean {
    if (!this.tabAudible) return false;

    const ctx = this.ensureAudioContext();
    const buffer = this.bufferCache.get(url);
    if (!ctx || !buffer) {
      void this.preloadBuffer(url);
      return false;
    }

    void ctx.resume().catch(() => {});

    try {
      this.stopDecodedLoop(url);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gainNode = ctx.createGain();
      gainNode.gain.value = volume;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      const when = ctx.currentTime + Math.max(0, startDelaySec);
      source.start(when);
      source.stop(when + Math.max(0.05, durationSec));
      source.onended = () => {
        if (this.loopSources.get(url) === source) {
          this.loopSources.delete(url);
        }
      };
      this.loopSources.set(url, source);
      return true;
    } catch {
      return false;
    }
  }

  stopDecodedLoop(url: string): void {
    const source = this.loopSources.get(url);
    if (!source) return;
    try {
      source.stop();
    } catch {
      // Already stopped.
    }
    this.loopSources.delete(url);
  }

  cancelScheduledAudio(): void {
    for (const source of this.scheduledSources) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }
    this.scheduledSources.length = 0;
    for (const url of [...this.loopSources.keys()]) {
      this.stopDecodedLoop(url);
    }
  }

  playSound(url: string, volume = 0.7, gain = 1): void {
    if (!this.tabAudible) return;

    const useWebAudioBoost = gain > 1.01 && !this.isMobileSafari();
    if (useWebAudioBoost) {
      const played = this.playBufferedSound(url, volume, gain);
      if (played) return;
      void this.preloadBuffer(url);
    }

    const pool = this.getSoundPool(url);
    const audio =
      pool.find(
        (item) =>
          (item.paused || item.ended) && item.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA,
      ) ??
      pool.find((item) => item.paused || item.ended) ??
      pool.reduce((oldest, item) => (item.currentTime < oldest.currentTime ? item : oldest));

    const play = (): void => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // Ignore seek errors on not-yet-ready audio.
      }

      audio.volume = volume;
      void audio.play().catch((e) => console.warn(`Sound play failed (${url})`, e));
    };

    // Call play synchronously in the click/pointer handler — required on iOS/Safari.
    play();

    if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    const onReady = (): void => {
      audio.removeEventListener('canplaythrough', onReady);
      audio.removeEventListener('loadeddata', onReady);
      if (audio.paused) play();
    };

    audio.addEventListener('canplaythrough', onReady, { once: true });
    audio.addEventListener('loadeddata', onReady, { once: true });
    void audio.load();
  }

  pauseAllSounds(): void {
    this.cancelScheduledAudio();
    for (const [url, pool] of this.soundPools.entries()) {
      if (this.isBackgroundSound(url)) continue;
      for (const audio of pool) {
        audio.pause();
        try {
          audio.currentTime = 0;
        } catch {
          // Ignore seek errors.
        }
      }
    }
  }

  stopSound(url: string): void {
    const pool = this.soundPools.get(url);
    if (!pool) return;

    for (const audio of pool) {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        // Ignore seek errors.
      }
    }
  }

  private warmSoundPools(): void {
    for (const url of this.urls) {
      if (!/\.(mp3|wav|ogg|webm|m4a)$/i.test(url)) continue;
      if (this.isBackgroundSound(url)) continue;
      this.getSoundPool(url);
      if (/secondLevelButtonsSound/i.test(url)) {
        void this.preloadBuffer(url);
      }
    }
  }

  private isBackgroundSound(url: string): boolean {
    return /backgroundSound/i.test(url);
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioContext) {
      const Ctx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.audioContext = new Ctx();
    }
    return this.audioContext;
  }

  private preloadBuffer(url: string): Promise<void> {
    if (this.bufferCache.has(url)) return Promise.resolve();

    const ctx = this.ensureAudioContext();
    if (!ctx) return Promise.resolve();

    return fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        this.bufferCache.set(url, buffer);
      })
      .catch(() => {
        // Fall back to HTMLAudio playback.
      });
  }

  private playBufferedSound(url: string, volume: number, gain: number): boolean {
    const ctx = this.ensureAudioContext();
    const buffer = this.bufferCache.get(url);
    if (!ctx || !buffer) return false;

    void ctx.resume().catch(() => {});

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gainNode = ctx.createGain();
      gainNode.gain.value = volume * gain;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
      return true;
    } catch {
      return false;
    }
  }

  private getSoundPool(url: string): HTMLAudioElement[] {
    const existing = this.soundPools.get(url);
    if (existing) return existing;

    const pool: HTMLAudioElement[] = [];
    const cached = this.cache.get(url);
    if (cached instanceof HTMLAudioElement) {
      pool.push(cached);
    }

    while (pool.length < this.soundPoolSize) {
      const audio = this.createAudio(url);
      void audio.load();
      pool.push(audio);
    }

    this.soundPools.set(url, pool);
    return pool;
  }

  clear() {
    if (this.finishTimer !== null) {
      clearTimeout(this.finishTimer);
      this.finishTimer = null;
    }
    if (this.finishRaf !== null) {
      cancelAnimationFrame(this.finishRaf);
      this.finishRaf = null;
    }
    this.bufferCache.clear();
    this.delayedAudio.clear();
    this.cancelScheduledAudio();
    this.audioContext?.close().catch(() => {});
    this.audioContext = null;
    this.cache.clear();
    this.soundPools.clear();
    this.audioUnlocked = false;
    this.urls = [];
    this.assetsDone = false;
    this.sceneReady = false;
    this._progress.set(0);
    this._displayProgress.set(0);
    this._isLoaded.set(false);
  }
}