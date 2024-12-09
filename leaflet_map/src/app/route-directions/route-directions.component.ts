import { Component, NgModule } from '@angular/core';
import {
  DatePipe, DecimalPipe,
  isPlatformBrowser,
  NgClass,
  NgForOf,
  NgIf,
  NgOptimizedImage, NgStyle,

} from "@angular/common";
import {
  RouteResponse,
  RouteLeg,
  Stop
} from '../types/route.types';
import { RouteDataService } from "../services/route-data.service";
import { FormsModule, NgModel } from "@angular/forms";
import { HttpClient, HttpClientModule, HttpParams } from "@angular/common/http";
import { LeafletMapComponent } from '../leaflet-map/leaflet-map.component';

import { Router } from '@angular/router';
import {RouterModule} from '@angular/router';

@Component({
  selector: 'app-route-directions',
  standalone: true,
  imports: [
    LeafletMapComponent,
    HttpClientModule,
    NgForOf,
    NgIf,
    NgOptimizedImage,
    NgClass,
    DatePipe,
    DecimalPipe,
    NgStyle,
    FormsModule,
    RouterModule
  ],
  templateUrl: './route-directions.component.html',
  styleUrl: './route-directions.component.css'
})

export class RouteDirectionsComponent {


  public placeStart: string = "";
  public placesFound: any[] = [];
  public clickedOnFrom = false;
  public isOnEnd = false;
  public placeEnd: string = "";
  public placeStartCoord = { latlng: { lat: null, lng: null } };
  public placeEndCoord = { latlng: { lat: null, lng: null } };
  public currentLocation = { latlng: { lat: null, lng: null } };

  constructor(
    private http: HttpClient,
    private routeDataService: RouteDataService,
    private router: Router
  ) {
  }

  getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (position) {
              console.log(
                'Latitude: ' +
                position.coords.latitude +
                'Longitude: ' +
                position.coords.longitude
              );
              let lat = position.coords.latitude;
              let lng = position.coords.longitude;
              //@ts-ignore
              this.currentLocation.latlng.lat = lat;
              //@ts-ignore
              this.currentLocation.latlng.lng = lng;
              const location = {
                lat,
                lng,
              };
              resolve(location);
            }
          },
          (error) => console.log(error)
        );
      } else {
        reject('Geolocation is not supported by this browser.');
      }
    });
  }


  public getPlace(place, type = "START") {
    console.log((this.placesFound.length > 0 || this.clickedOnFrom) && !this.isOnEnd);
    console.log(this.placesFound.length > 0 && this.isOnEnd);
    if (place.length > 2 && place !== "Locația curentă") {
      this.clickedOnFrom = false;
      let viewbox = "25.824423,44.234494,26.458471,44.768927";
      let params = {
        "viewbox": viewbox,
        "bounded": "1",
        "format": "json",
        "q": place
      };
      //@ts-ignore
      this.http.get(`/api/searchPlace`, { params: params }).subscribe(data => {
        console.log(data);
        //@ts-ignore
        this.placesFound = data;
      });
    } else {
      this.placesFound = [];
      if (type === "START") {
        this.clickedOnFrom = true;
        this.isOnEnd = false;
      } else {
        this.isOnEnd = true;
        this.clickedOnFrom = false;
      }
    }
  }


  public getCurrentLocationPlace() {
    this.getCurrentLocation();
    this.placeStartCoord = this.currentLocation;
    this.placeStart = "Locația curentă";
    this.clickedOnFrom = false;
    this.placesFound = [];
  }


  public getPlaceCoord(lat, lon, name, type) {
    switch (type) {
      case "END":
        this.placeEndCoord = { latlng: { lat: lat, lng: lon } };
        this.placeEnd = name;
        this.clickedOnFrom = false;
        this.placesFound = [];
        break;
      case "START":
        this.placeStartCoord = { latlng: { lat: lat, lng: lon } };
        this.placeStart = name;
        this.clickedOnFrom = false;
        this.placesFound = [];
        break;
    }
  }
}
