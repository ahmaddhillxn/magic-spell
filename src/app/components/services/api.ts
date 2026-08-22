import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Api {
  private readonly apiResultSubject = new BehaviorSubject<unknown>(null);
  readonly apiResult$ = this.apiResultSubject.asObservable();

  setApiResult(result: unknown): void {
    this.apiResultSubject.next(result);
  }

  getApiResult(): unknown {
    return this.apiResultSubject.getValue();
  }
}
