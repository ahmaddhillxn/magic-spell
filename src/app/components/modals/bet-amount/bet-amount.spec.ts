import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BetAmount } from './bet-amount';

describe('BetAmount', () => {
  let component: BetAmount;
  let fixture: ComponentFixture<BetAmount>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BetAmount]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BetAmount);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
