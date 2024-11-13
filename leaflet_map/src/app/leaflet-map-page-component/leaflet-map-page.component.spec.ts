import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeafletMapPageComponentComponent } from './leaflet-map-page.component';

describe('LeafletMapPageComponentComponent', () => {
  let component: LeafletMapPageComponentComponent;
  let fixture: ComponentFixture<LeafletMapPageComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeafletMapPageComponentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeafletMapPageComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
