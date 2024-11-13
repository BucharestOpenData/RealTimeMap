import { Component, ViewChild } from '@angular/core';
import { LeafletMapComponent } from './leaflet-map/leaflet-map.component';
import {ToolbarComponent} from "./toolbar/toolbar.component";
import { AuthService } from './auth.service';
import {HttpClientModule} from '@angular/common/http';
import {BusDataService} from "./services/bus-data.service";
import {ExcelReaderService} from "./services/excel-reader.service";
import {BusPassengerService} from "./services/bus-passenger.service";
import {RouterOutlet} from "@angular/router";
import{routes} from "./app.routes";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [
    ToolbarComponent,
    LeafletMapComponent,
    HttpClientModule,
    LeafletMapComponent,
    RouterOutlet
  ],
  providers: [AuthService,BusDataService,ExcelReaderService,BusPassengerService],
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  @ViewChild(LeafletMapComponent) leafletMap: LeafletMapComponent | undefined;
  userId: string | null = null;

  onUserIdReceived(userId: string) {
    this.userId = userId;
  }
  startDrawing(shape: string) {
    // @ts-ignore
    this.leafletMap.startDrawing(shape);
  }

  stopDrawing() {
    // @ts-ignore
    this.leafletMap.stopDrawing();
  }
}
