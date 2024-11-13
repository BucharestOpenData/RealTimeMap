import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BusPassengerService {
  private proxyUrl = '/api/passenger-data'; // Update this to your server's IP

  constructor(private http: HttpClient) {}

  getPassengerData(): Observable<any> {
    return this.http.get<any>(this.proxyUrl);
  }
}
