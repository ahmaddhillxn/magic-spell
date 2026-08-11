import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GuidenessModal } from './guideness-modal';

describe('GuidenessModal', () => {
  let component: GuidenessModal;
  let fixture: ComponentFixture<GuidenessModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuidenessModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GuidenessModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
