import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AutoplayModal } from './autoplay-modal';

describe('AutoplayModal', () => {
  let component: AutoplayModal;
  let fixture: ComponentFixture<AutoplayModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutoplayModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AutoplayModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
