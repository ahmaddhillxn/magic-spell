import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameWrapper } from './game-wrapper';

describe('GameWrapper', () => {
  let component: GameWrapper;
  let fixture: ComponentFixture<GameWrapper>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameWrapper]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GameWrapper);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
