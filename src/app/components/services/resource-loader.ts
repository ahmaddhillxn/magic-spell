// src/app/services/resource-loader.service.ts

import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ResourceLoaderService {
  private urls: string[] = [];
  private cache = new Map<string, HTMLImageElement | HTMLAudioElement | HTMLVideoElement>();

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

  constructor() {
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
          const audio = new Audio();
          audio.oncanplaythrough = () => {
            this.cache.set(url, audio);
            update();
            resolve();
          };
          audio.onerror = () => {
            console.warn(`Audio failed: ${url}`);
            update();
            resolve();
          };
          audio.src = url;
          audio.load();
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
  }

  /** Call when Pixi board (pegs) is drawn — keeps loader up until pegs are visible. */
  markSceneReady(): void {
    this.sceneReady = true;
    this.maybeFinish();
  }

  private maybeFinish(): void {
    if (!this.assetsDone || !this.sceneReady || this._isLoaded()) return;
    setTimeout(() => this._isLoaded.set(true), 300);
  }

  get<T extends HTMLImageElement | HTMLAudioElement>(url: string): T | undefined {
    return this.cache.get(url) as T | undefined;
  }

  playSound(url: string, volume = 0.7) {
    const sound = this.get<HTMLAudioElement>(url);
    if (sound) {
      // clone -> allow multiple plays at once
      const clone = sound.cloneNode() as HTMLAudioElement;
      clone.volume = volume;
      clone.play().catch((e) => console.warn('Sound play failed', e));
      return;
    }

    // Fallback when audio was not pre-cached
    const fallback = new Audio(url);
    fallback.volume = volume;
    fallback.play().catch((e) => console.warn('Sound play failed', e));
  }

  clear() {
    this.cache.clear();
    this.urls = [];
    this.assetsDone = false;
    this.sceneReady = false;
    this._progress.set(0);
    this._displayProgress.set(0);
    this._isLoaded.set(false);
  }
}