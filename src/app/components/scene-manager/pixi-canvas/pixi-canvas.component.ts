import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { Application } from 'pixi.js';
import { ResourceLoaderService } from '../../components/services/resource-loader';
import {
  BoardScene,
  BOARD_FX_PAD_X,
  BOARD_FX_PAD_Y,
  BOARD_HEIGHT,
  BOARD_WIDTH,
} from '../board-scene';

@Component({
  selector: 'app-pixi-canvas',
  template: `<div #host class="pixi-host"></div>`,
  styleUrl: './pixi-canvas.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class PixiCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

  private app?: Application;
  private boardScene?: BoardScene;
  private resizeObserver?: ResizeObserver;
  private ballLandedHandler: ((value: number) => void) | null = null;
  private pegHitHandler: (() => void) | null = null;

  constructor(private readonly loader: ResourceLoaderService) {}

  async ngAfterViewInit(): Promise<void> {
    const host = this.hostRef.nativeElement;
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    const isIOS =
      /iP(ad|hone|od)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const dpr = window.devicePixelRatio || 1;
    // Safari + many balls: keep pixel work low so drops stay smooth
    const resolution = isIOS ? 1 : Math.min(dpr, isCoarse ? 1.25 : 2);

    try {
      const app = new Application();
      await app.init({
        // Larger than the playfield so edge fireworks aren't clipped by the bitmap
        width: BOARD_WIDTH + BOARD_FX_PAD_X * 2,
        height: BOARD_HEIGHT + BOARD_FX_PAD_Y,
        backgroundAlpha: 0,
        resolution,
        autoDensity: true,
        antialias: !isCoarse && !isIOS,
        powerPreference: 'high-performance',
        multiView: false,
        hello: false,
      });

      // Keep board coords (0..BOARD_*) — FX can draw into the padded margins
      app.stage.position.set(BOARD_FX_PAD_X, BOARD_FX_PAD_Y);

      app.ticker.maxFPS = isIOS ? 30 : 60;
      app.ticker.minFPS = isIOS || isCoarse ? 20 : 30;

      const canvas = app.canvas as HTMLCanvasElement;
      canvas.style.touchAction = 'manipulation';
      canvas.style.webkitUserSelect = 'none';
      canvas.style.userSelect = 'none';

      host.appendChild(canvas);
      this.app = app;

      this.boardScene = new BoardScene(app);
      await this.boardScene.init();
      this.boardScene.setOnBallLanded(this.ballLandedHandler);
      this.boardScene.setOnPegHit(this.pegHitHandler);

      this.resizeObserver = new ResizeObserver(() => this.resizeCanvas(host, app));
      this.resizeObserver.observe(host);
      this.resizeCanvas(host, app);
    } finally {
      this.loader.markSceneReady();
    }
  }

  /** Drop a ball that lands in the given multiplier slot. */
  dropToMultiplier(value: number): void {
    this.boardScene?.dropToMultiplier(value);
  }

  /** Drop a ball into a random multiplier slot. */
  dropRandom(): void {
    this.boardScene?.dropRandom();
  }

  /** Scale ball simulation speed (1 = normal). */
  setBallSpeed(scale: number): void {
    this.boardScene?.setSpeedScale(scale);
  }

  /** Spine / UI: called once when a ball settles in a multiplier bin. */
  setOnBallLanded(handler: ((value: number) => void) | null): void {
    this.ballLandedHandler = handler;
    this.boardScene?.setOnBallLanded(handler);
  }

  /** SFX: called when a ball contacts a peg. */
  setOnPegHit(handler: (() => void) | null): void {
    this.pegHitHandler = handler;
    this.boardScene?.setOnPegHit(handler);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;

    const boardScene = this.boardScene;
    const app = this.app;
    this.boardScene = undefined;
    this.app = undefined;

    try {
      boardScene?.destroy();
    } catch {
      /* ignore HMR teardown races */
    }

    try {
      app?.destroy(true, { children: true });
    } catch {
      /* Pixi TexturePool can throw while recycling canvas text textures */
    }
  }

  private resizeCanvas(host: HTMLDivElement, app: Application): void {
    const { width, height } = host.getBoundingClientRect();
    if (width === 0 || height === 0) {
      return;
    }

    const renderW = BOARD_WIDTH + BOARD_FX_PAD_X * 2;
    const renderH = BOARD_HEIGHT + BOARD_FX_PAD_Y;
    app.renderer.resize(renderW, renderH);
    app.stage.position.set(BOARD_FX_PAD_X, BOARD_FX_PAD_Y);

    // Scale canvas to host board area, then extend into padded margins
    const scaleX = width / BOARD_WIDTH;
    const scaleY = height / BOARD_HEIGHT;
    const canvas = app.canvas as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.width = `${renderW * scaleX}px`;
    canvas.style.height = `${renderH * scaleY}px`;
    canvas.style.left = `${-BOARD_FX_PAD_X * scaleX}px`;
    canvas.style.top = `${-BOARD_FX_PAD_Y * scaleY}px`;
  }
}
