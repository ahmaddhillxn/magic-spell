import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CONFIG } from '../../../config';

export interface GameConfigResponse {
  status?: string;
  message?: string;
  data?: {
    currency?: string | null;
    stakeSettings?: {
      minBet?: number | null;
      maxBet?: number | null;
      stakes?: Array<number | null> | null;
    } | null;
  } | null;
}
@Injectable({
  providedIn: 'root',
})
export class Api {
  // private readonly clientSeed = 'your-client-seed'; // Ya database se fetch karein

  private apiResultSubject = new BehaviorSubject<any>(null);
  apiResult$ = this.apiResultSubject.asObservable();

  constructor(private http: HttpClient) {}

  frogPlay(payload: Record<string, unknown>): Observable<any> {
    return this.http.post(CONFIG.playUrl, payload);
  }

  frogGo(payload: Record<string, unknown>): Observable<any> {
    return this.http.post(CONFIG.goUrl, payload);
  }

  frogCashout(payload: Record<string, unknown>): Observable<any> {
    return this.http.post(CONFIG.cashoutUrl, payload);
  }

  frogGetCurrentRound(payload: Record<string, unknown> = {}): Observable<any> {
    return this.http.post(CONFIG.currentRoundUrl, payload);
  }

  frogGetConfig(payload: Record<string, unknown> = {}): Observable<any> {
    return this.http.post(CONFIG.gameConfigUrl, payload);
  }

  setApiResult(result: any) {
    this.apiResultSubject.next(result);
  }

  getApiResult() {
    return this.apiResultSubject.getValue();
  }

  getGameConfig(): Observable<GameConfigResponse> {
    return this.http.post<GameConfigResponse>(CONFIG.gameConfigUrl, {});
  }

  generateClientSeed(): string {
    return Math.random().toString(36).substring(2) + Date.now();
  }
}
