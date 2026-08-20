import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { GameWrapper } from './components/game-wrapper/game-wrapper';
import { LoadingComponent } from './components/loading/loading.component';
import { ResourceLoaderService } from './components/services/resource-loader';
import { GAME_ASSETS } from './components/game-assets';

@Component({
  selector: 'app-root',
  imports: [GameWrapper, LoadingComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('magic-spell');
  private lastWidth = 0;
  private lastHeight = 0;
  private resizeTimeout: ReturnType<typeof setTimeout> | undefined;

  private readonly onResize = () => this.handleResize();
  private readonly onOrientation = () => this.handleOrientationChange();

  constructor(public loader: ResourceLoaderService) {}

  ngOnInit(): void {
    document.documentElement.classList.add('magicSpell');
    this.updateViewportUnits();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onOrientation);
    void this.startPreload();
  }

  ngOnDestroy(): void {
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onOrientation);
  }

  private handleResize(): void {
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => this.updateViewportUnits(), 50);
  }

  private handleOrientationChange(): void {
    setTimeout(() => this.updateViewportUnits(), 150);
  }

  updateViewportUnits(): void {
    const rawWidth = window.innerWidth;
    const rawHeight = window.innerHeight;
    const screenWidth = window.screen?.width ?? rawWidth;
    const screenHeight = window.screen?.height ?? rawHeight;

    const vw = Math.max(1, Math.min(rawWidth, screenWidth));
    const vh = Math.max(1, Math.min(rawHeight, screenHeight));

    if (Math.abs(vw - this.lastWidth) < 1 && Math.abs(vh - this.lastHeight) < 1) {
      return;
    }

    this.lastWidth = vw;
    this.lastHeight = vh;

    this.setVH(vh);
    this.setRootFontSize(vw, vh);
  }

  setVH(vh: number): void {
    document.documentElement.style.setProperty('--vh', `${(vh * 0.01).toFixed(2)}px`);
  }

  setRootFontSize(vw: number, vh: number): void {
    const isPortrait = vh > vw;
    // Magic Spell / Vimplay design: 128rem × 72rem == 1280×720 → 1rem = 10px at ref
    const refWidth = isPortrait ? 320 : 1280;
    const refHeight = isPortrait ? 560 : 720;
    const aspectRatio = refHeight / refWidth;
    const maxFontSize = isPortrait ? 20 : 20;
    const baseMultiplier = 10;
    const currentAspectRatio = vh / vw;

    let fontSize =
      currentAspectRatio < aspectRatio
        ? (vh / refHeight) * baseMultiplier
        : (vw / refWidth) * baseMultiplier;

    fontSize = Math.min(Math.max(fontSize, 4), maxFontSize);
    document.documentElement.style.fontSize = `${fontSize.toFixed(4)}px`;
    document.documentElement.classList.toggle('is-portrait', isPortrait);
  }

  private async startPreload(): Promise<void> {
    this.loader.clear();
    this.loader.registerAssets(this.collectAssetUrls(GAME_ASSETS));
    await this.loader.loadAll();
  }

  private collectAssetUrls(input: unknown): string[] {
    const urls: string[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === 'string') {
        urls.push(value);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (value && typeof value === 'object') {
        Object.values(value).forEach(walk);
      }
    };
    walk(input);
    return [...new Set(urls)];
  }
}
