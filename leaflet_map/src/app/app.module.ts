import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { AppComponent } from './app.component';
import { ToolbarComponent } from './toolbar/toolbar.component';
import { LeafletMapComponent } from './leaflet-map/leaflet-map.component';
import { AuthService } from './auth.service';
import { BusDataService } from './services/bus-data.service';
import {ExcelReaderService} from "./services/excel-reader.service";
import {BusPassengerService} from "./services/bus-passenger.service";
import {AppRoutingModule} from "./app.routes";

@NgModule({
  declarations: [

  ],
  imports: [
    BrowserModule,
    ReactiveFormsModule,
    HttpClientModule, // Ensure this is imported
    BrowserAnimationsModule,
    MatSnackBarModule,
    LeafletMapComponent,
    ToolbarComponent,
    AppComponent,
    AppRoutingModule
  ],
  exports:[
    ToolbarComponent,
    LeafletMapComponent
  ],
  providers: [AuthService, BusDataService,ExcelReaderService,BusPassengerService],
  bootstrap: [AppComponent]
})
export class AppModule { }
