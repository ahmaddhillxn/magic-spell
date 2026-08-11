import { TestBed } from '@angular/core/testing';

import { BetHistoryService } from './history';

describe('BetHistoryService', () => {
  let service: BetHistoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BetHistoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
