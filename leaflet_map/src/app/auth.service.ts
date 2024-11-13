// auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private http: HttpClient) { }

  login(username: string, password: string): Observable<any> {
    return this.http.post('/api/login', { username, password });
  }
  private userId: string | null = null;

  setUserId(userId: string) {
    this.userId = userId;
    console.log('AuthService: setUserId', this.userId); // Debug statement
  }

  getUserId(): string | null {
    console.log('AuthService: getUserId', this.userId); // Debug statement
    return this.userId;
  }
}
