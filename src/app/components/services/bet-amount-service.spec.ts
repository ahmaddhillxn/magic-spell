import { TestBed } from '@angular/core/testing';

import { BetAmountService } from './bet-amount-service';

describe('BetAmountService', () => {
  let service: BetAmountService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BetAmountService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
