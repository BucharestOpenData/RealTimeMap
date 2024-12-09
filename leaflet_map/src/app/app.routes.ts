import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LeafletMapComponent } from './leaflet-map/leaflet-map.component';
import {ToolbarComponent} from "./toolbar/toolbar.component";
import{LeafletMapPageComponent} from "./leaflet-map-page-component/leaflet-map-page.component";
import {LeafletMapComponentPMUD} from "./leaflet-map-pmud/leaflet-map.component";
import {AuthGuard} from "./auth.guard";
import {DocsComponent} from "./docs/docs.component";
import { RouteDirectionsComponent } from './route-directions/route-directions.component';

export const routes: Routes = [
  { path: ':placeStartCoordLat/:placeStartCoordLng/:placeEndCoordLat/:placeEndCoordLng/:placeStart/:placeEnd', component:LeafletMapPageComponent },
  { path: '', component:LeafletMapPageComponent },
  { path: 'login', component: LeafletMapPageComponent },
  { path:'docs',component: DocsComponent },
  { path: 'route', component : RouteDirectionsComponent}
  // Add more routes as needed
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
