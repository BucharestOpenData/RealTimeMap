import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RouteDirectionsComponent } from './route-directions.component';

describe('RouteDirectionsComponent', () => {
  let component: RouteDirectionsComponent;
  let fixture: ComponentFixture<RouteDirectionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouteDirectionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RouteDirectionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
