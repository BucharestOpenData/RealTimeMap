import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LeafletMapComponent } from './leaflet-map/leaflet-map.component';
import {ToolbarComponent} from "./toolbar/toolbar.component";
import{LeafletMapPageComponent} from "./leaflet-map-page-component/leaflet-map-page.component";
import {LeafletMapComponentPMUD} from "./leaflet-map-pmud/leaflet-map.component";
import {AuthGuard} from "./auth.guard";
import {DocsComponent} from "./docs/docs.component";

export const routes: Routes = [
  { path: '', component:LeafletMapPageComponent },
  { path: 'login', component: LeafletMapPageComponent },
  { path:'docs',component: DocsComponent }
  // Add more routes as needed
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
