import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const isLoggedIn = !!localStorage.getItem('userToken');
    const isGuest = !!localStorage.getItem('guestSession');

    if (!isLoggedIn && !isGuest) {
      // Redirect to home page and show login form if not logged in and not a guest
      this.router.navigate(['/'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    return true; // Allow access if logged in or a guest
  }
}
