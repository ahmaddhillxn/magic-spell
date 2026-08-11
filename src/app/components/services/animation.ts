import { EventEmitter, Injectable } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Animation {
  private spinResultSource = new Subject<any>();
  private autoPlaySpinTrigger = new Subject<void>();
  private spinHistorySubject = new BehaviorSubject<any[]>([]);
  private winHistorySubject = new BehaviorSubject<any[]>([]);
  
  // Animation event emitters
  jumpAnimation = new EventEmitter<void>();
  winAnimation = new EventEmitter<void>();
  loseAnimation = new EventEmitter<void>();
  idleAnimation = new EventEmitter<void>();

  // Event emitter for animation completion
  animationComplete = new EventEmitter<string>();
  
  // Auto Play Variables
  private autoPlayActive = new BehaviorSubject<boolean>(false);
  private remainingRounds = new BehaviorSubject<number>(0);
  private totalRounds = new BehaviorSubject<number>(0);

  private frogCanvas: any;
  private frogScene: any;

  // Public Observables
  spinResult$ = this.spinResultSource.asObservable();
  autoPlaySpin$ = this.autoPlaySpinTrigger.asObservable();
  autoPlayActive$ = this.autoPlayActive.asObservable();
  remainingRounds$ = this.remainingRounds.asObservable();
  totalRounds$ = this.totalRounds.asObservable();
  spinHistory$ = this.spinHistorySubject.asObservable();
  winHistory$ = this.winHistorySubject.asObservable();

  constructor() {
    // console.log('Animation service initialized');
  }
  // Animation.service.ts

  private idleAnimations = [
    'Frog_idle',
    'Idle',
    'idle',
    'frog_idle',
  ];

  private idleIndex = 0;
  private idleLoopActive = false;
  private idleAnimationCompletionSub?: Subscription;
  private lastIdleAnimation?: string;

  startIdleLoop() {
    if (this.idleLoopActive) return;

    // console.log('🔁 Idle loop started');
    this.idleLoopActive = true;
    this.idleIndex = 0;

    this.setupIdleCompletionSubscription();
    this.playNextIdle();
  }

  stopIdleLoop() {
    // console.log('⛔ Idle loop stopped');
    this.idleLoopActive = false;
    this.lastIdleAnimation = undefined;
    this.idleAnimationCompletionSub?.unsubscribe();
    this.idleAnimationCompletionSub = undefined;
  }

  private playNextIdle() {
    if (!this.idleLoopActive) return;

    const anim = this.idleAnimations[this.idleIndex];
    // console.log('😴 Playing idle:', anim);

    this.lastIdleAnimation = anim;
    this.playAnimation(anim, false);

    this.idleIndex = (this.idleIndex + 1) % this.idleAnimations.length;
  }

  private setupIdleCompletionSubscription() {
    if (this.idleAnimationCompletionSub) return;

    this.idleAnimationCompletionSub = this.animationComplete.subscribe((completedAnim) => {
      if (!this.idleLoopActive) return;
      if (!completedAnim || completedAnim !== this.lastIdleAnimation) return;

      setTimeout(() => {
        if (this.idleLoopActive) {
          this.playNextIdle();
        }
      }, 200);
    });
  }
  setFrogScene(scene: any) {
    this.frogScene = scene;
    // console.log('✅ FrogScene set in Animation service', scene);
  }

  setFrogCanvas(canvas: any) {
    this.frogCanvas = canvas;
    // console.log('✅ FrogCanvas set in Animation service', canvas);
  }

  // Backward compatibility
  setChickenScene(scene: any) {
    this.setFrogScene(scene);
  }

  // Available animations get karne ka method
  getAvailableAnimations(): string[] {
    if (this.frogScene && typeof this.frogScene.getAvailableAnimations === 'function') {
      return this.frogScene.getAvailableAnimations();
    } 
    if (this.frogCanvas && typeof this.frogCanvas.getAvailableAnimations === 'function') {
      return this.frogCanvas.getAvailableAnimations();
    }
    console.warn('⚠️ No animation source available');
    return [];
  }

  // Generic animation play karne ka method
  playAnimation(animationName: string, loop: boolean = false): string | null {
    console.log(`🎬 Animation service: Playing animation: ${animationName}, Loop: ${loop}`);
    
    if (this.frogCanvas && typeof this.frogCanvas.playAnimation === 'function') {
      return this.frogCanvas.playAnimation(animationName, loop);
    }
    
    if (this.frogScene && typeof this.frogScene.playAnimation === 'function') {
      this.frogScene.playAnimation(animationName, loop);
      return animationName;
    }
    
    console.error(`❌ Cannot play animation: ${animationName} - No animation source available`);
    return null;
  }

  // Individual animation methods
 


  

 
  // Lose animations
  
  getSpinHistory() {
    return this.spinHistorySubject.asObservable();
  }

  setSpinHistory(history: any) {
    const currentHistory = this.spinHistorySubject.value;
    const newHistory = [history, ...currentHistory.slice(0, 49)];
    this.spinHistorySubject.next(newHistory);
  }

  getWinHistory() {
    return this.winHistorySubject.asObservable();
  }

  setWinHistory(win: any) {
    const currentWins = this.winHistorySubject.value;
    const newWins = [win, ...currentWins.slice(0, 49)];
    this.winHistorySubject.next(newWins);
  }

  updateRemainingRounds(count: number) {
    this.remainingRounds.next(count);
  }

  triggerAutoPlaySpin() {
    this.autoPlaySpinTrigger.next();
  }

  emitSpinResult(result: any) {
    // console.log('🎯 Spin result emitted:', result);
    this.spinResultSource.next(result);
  }

  reset() {
    // console.log('🔄 Animation service reset');
    this.frogCanvas = null;
    this.frogScene = null;
  }

  isReady(): boolean {
    return !!this.frogCanvas || !!this.frogScene;
  }
}
