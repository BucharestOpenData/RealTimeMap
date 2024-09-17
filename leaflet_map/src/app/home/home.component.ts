import * as L from 'leaflet';
import { Component, OnInit, HostListener } from '@angular/core';
import { Router, ActivatedRoute } from "@angular/router";
import { HttpClient } from '@angular/common/http';
import { NgIf, NgOptimizedImage } from "@angular/common";
import { FormsModule } from "@angular/forms";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  standalone: true,
  imports: [
    NgOptimizedImage,
    FormsModule,
    NgIf
  ],
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  map: L.Map | undefined;
  showLoginForm = false;
  username = '';
  password = '';
  returnUrl: string | undefined;

  constructor(private router: Router, private route: ActivatedRoute, private http: HttpClient) { }

  ngOnInit() {
    this.map = L.map('map', {
      center: [44.4268, 26.1025],
      zoom: 13,
      layers: [
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
        })
      ],
      scrollWheelZoom: false,
      dragging: false,
      zoomControl: false,
      touchZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false
    });

    this.map.on('dragstart', () => {
      // @ts-ignore
      this.map.stop();
    });

    // Check for returnUrl query parameter
    this.route.queryParams.subscribe(params => {
      this.returnUrl = params['returnUrl'];
      if (this.returnUrl) {
        this.showLoginForm = true; // Show the login form if redirected to home page from guard
      }
    });
  }

  navigateToPmud() {
    this.router.navigate(['/pmud']);
  }

}
