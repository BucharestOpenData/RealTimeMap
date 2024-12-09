import { Component, Injectable, NgModule } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';


@Injectable({
  providedIn: 'root',
})

export class RouteDataService {
  private apiUrl = '/api/Route'; // Updated to backend server URL

  constructor(private http: HttpClient) { }

  sendRouteData(coordinates: any[]): Observable<any> {
    const currentDateAndTime = new Date();
    let dateString = new Date(currentDateAndTime.getTime() - (currentDateAndTime.getTimezoneOffset() * 60000)).toISOString().split("T")[0];
    let params = new HttpParams().set('point', coordinates[0])
      .set('point', coordinates[1])
      .set('pt.earliest_departure_time', dateString)
      .set('pt.arrive_by', 'false')
      .set('locale', 'ro')
      .set('profile', 'pt')
      .set('pt.profile', 'false')
      .set('pt.access_profile', 'foot')
      .set('pt.beta_access_time', '1')
      .set('pt.egress_profile', 'foot')
      .set('pt.beta_egress_time', '1')
      .set('pt.profile_duration', '120M')
      .set('pt.ignore_transfers', 'false');
      console.log(this.http.get<any>(this.apiUrl, { params }));
    return this.http.get<any>(this.apiUrl, { params });
  }
}
