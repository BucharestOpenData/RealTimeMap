import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BusDataService {
  private apiUrl = '/api/busData'; // Updated to backend server URL

  constructor(private http: HttpClient) {}

  getBusData(): Observable<any> {
    return this.http.get<any>(this.apiUrl);
  }
}
