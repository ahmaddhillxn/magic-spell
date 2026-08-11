import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BetHistoryModal } from './bet-history-modal';

describe('BetHistoryModal', () => {
  let component: BetHistoryModal;
  let fixture: ComponentFixture<BetHistoryModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BetHistoryModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BetHistoryModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
