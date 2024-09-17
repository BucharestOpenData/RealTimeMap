import { Component } from '@angular/core';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { LeafletMapComponent } from '../leaflet-map/leaflet-map.component';

@Component({
  selector: 'app-leaflet-map-page',
  templateUrl: './leaflet-map-page.component.html',
  standalone: true,
  imports: [
    LeafletMapComponent,
    ToolbarComponent
  ],
  styleUrls: ['./leaflet-map-page.component.css']
})
export class LeafletMapPageComponent {
}

export class LeafletMapPageComponentComponent {
}
