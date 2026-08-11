import { TestBed } from '@angular/core/testing';

import { Toggle } from './toggle';

describe('Toggle', () => {
  let service: Toggle;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Toggle);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
