import { ComponentFixture, TestBed } from '@angular/core/testing';

import {LeafletMapComponentPMUD } from './leaflet-map.component';

describe('LeafletMapComponent', () => {
  let component: LeafletMapComponentPMUD  ;
  let fixture: ComponentFixture<LeafletMapComponentPMUD>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeafletMapComponentPMUD]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeafletMapComponentPMUD);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
