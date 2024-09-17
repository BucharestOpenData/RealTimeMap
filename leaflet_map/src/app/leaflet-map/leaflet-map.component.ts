import {
  Component,
  OnInit,
  Inject,
  PLATFORM_ID,
  OnDestroy,
  ViewChild,
  ElementRef,
  Input,
  Output,
  EventEmitter
} from '@angular/core';
import {isPlatformBrowser, NgClass, NgForOf, NgIf, NgOptimizedImage} from '@angular/common';
import { DataLoaderService } from '../services/data-loader.service';
import { GeoJSONLayerConfig } from '../interfaces/geojson-layer-config';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { BusDataService } from '../services/bus-data.service';
import { ExcelReaderService } from '../services/excel-reader.service';
import * as L from 'leaflet';
import { FormsModule } from '@angular/forms';
import {BusPassengerService} from "../services/bus-passenger.service";
import {MatSnackBar} from "@angular/material/snack-bar";
import {AuthService} from "../auth.service";
import Swal from 'sweetalert2';
import {catchError, throwError} from "rxjs"; // Import for nice popup alerts

@Component({
  selector: 'app-leaflet-map',
  templateUrl: './leaflet-map.component.html',
  standalone: true,
  imports: [
    HttpClientModule,
    NgForOf,
    NgIf,
    FormsModule,
    NgOptimizedImage,
    NgClass
  ],
  styleUrls: ['./leaflet-map.component.css']
})
export class LeafletMapComponent implements OnInit, OnDestroy {
  public loginData = {username: '', password: ''}; // Store login data
  private map: any;
  private layersControl: any = {};
  public layerConfigs: GeoJSONLayerConfig[] = [];
  private pointLayers: Set<string> = new Set();
  private readonly isBrowser: boolean;
  private autoSaveInterval: any;
  private busMarkers: any[] = [];
  private busDataInterval: any;
  public routeDetails: any[] = [];
  public filteredRouteDetails: any[] = [];
  public showMenu: boolean = false;
  public showGtfsMenu: boolean = false;
  public selectedRoute: number | null = null;
  public searchTerm: string = '';
  private routeMap: Map<number, string> = new Map();
  private routeGeoJsonData: any = {}; // Store pre-filtered GeoJSON data
  private stationsGeoJsonData: any = {}; // Store pre-filtered stations GeoJSON data
  private currentRouteLayer: any; // Store the current route layer
  private currentStationMarkers: any[] = []; // Store the current station markers
  public selectedRouteShortName: string | null = null;
  public showUploadMenu: boolean = false;
  uploadedGeoJsonLayers: any[] = [];
  public selectedRoutes: number[] = [];
  public selectedRouteShortNames: string[] = [];
  private routeLayers: Map<number, any> = new Map();
  private stationMarkers: Map<number, any[]> = new Map();
  private currentLocationMarker: L.Marker | null = null;
  private thorebData: any[] = []; // To store Thoreb ID data
  public uploadedGeoJsonFiles: {
    data: any;
    name: string, layer: any
  }[] = [];
  public uploadedGeoJsonLayer: any;
  protected isMobile: boolean | undefined;
  public guestSession = true;
  private stationBusMarkers: L.Marker[] = []; // To keep track of station-specific bus markers
  private shapes: any;
  @Input() setUserId(userId: string) { // Add this method
    this.userId = userId;
    this.loadMapData(); // Load map data when the user ID is set
  }

  customIcon = L.icon({
    iconUrl: 'assets/marker-icon.png',
    shadowUrl: 'assets/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  private iconMapping: { [key: string]: L.Icon } = {
    'Semaforizari.geojson': L.icon({
      iconUrl: 'assets/semaforizari_Bucuresti.png',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [1, -30],
      shadowUrl: 'assets/marker-shadow.png',
      shadowSize: [41, 41]
    }),
    'Semaforizari_IF.geojson': L.icon({
      iconUrl: 'assets/semaforizari_Ilfov.png',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [1, -30],
      shadowUrl: 'assets/marker-shadow.png',
      shadowSize: [41, 41]
    }),
    'Statii_Metrou.geojson': L.icon({
      iconUrl: 'assets/statie_metrou.png',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [1, -30],
      shadowUrl: 'assets/marker-shadow.png',
      shadowSize: [41, 41]
    }),
    'Statii_Tren_Metropolitan.geojson': L.icon({
      iconUrl: 'assets/statie_tren.png',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [1, -30],
      shadowUrl: 'assets/marker-shadow.png',
      shadowSize: [41, 41]
    }),
    'Substatii.geojson': L.icon({
      iconUrl: 'assets/substatie.png',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [1, -30],
      shadowUrl: 'assets/marker-shadow.png',
      shadowSize: [41, 41]
    }),
    'Lucrari.geojson': L.icon({
      iconUrl: 'assets/lucrari.png',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [1, -30],
      shadowUrl: 'assets/marker-shadow.png',
      shadowSize: [41, 41]
    }),
    'Autobaze.geojson': L.icon({
      iconUrl: 'assets/depou_bucuresti.png',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [1, -30],
      shadowUrl: 'assets/marker-shadow.png',
      shadowSize: [41, 41]
    }),
    'Autobaze_Ilfov.geojson': L.icon({
      iconUrl: 'assets/depou_Ilfov.png',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [1, -30],
      shadowUrl: 'assets/marker-shadow.png',
      shadowSize: [41, 41]
    }),
    'Accidente_2021_2022.geojson': L.icon({
      iconUrl: 'assets/accidente.png',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [1, -30],
      shadowUrl: 'assets/marker-shadow.png',
      shadowSize: [41, 41]
    })

  };
  private passengerData: any = {}; // Store passenger data
  private selectedRouteType: number | undefined;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private dataLoader: DataLoaderService,
    private http: HttpClient,
    private busDataService: BusDataService,
    private busPassengerService: BusPassengerService,
    private excelReaderService: ExcelReaderService,
    private snackBar: MatSnackBar, // Add this dependency
    private authService: AuthService, // Inject the AuthService


  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    this.isBrowser = isPlatformBrowser(platformId);
  }

  async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      const {default: L} = await import('leaflet');
      await import('@geoman-io/leaflet-geoman-free');
      this.initMap(L);

      this.autoSaveInterval = setInterval(() => {
        this.saveMapData();
      }, 300000);
      this.loadThorebData(); // Load Thoreb ID data when the component is initialized
      await this.loadRouteDetails();
      await this.loadRoutesGeoJSON(); // Load the GeoJSON data and pre-filter it
      await this.loadStationsGeoJSON(); // Load the stations GeoJSON data and pre-filter it
      this.loadBusData();
      this.busDataInterval = setInterval(() => this.loadBusData(), 7000);
      this.loadPassengerData(); // Load data initially
      setInterval(() => {
        this.loadPassengerData();
      }, 5000);
      this.loadMapData();
    }
    this.getUserLocationAndDisplayNearbyStations();
    this.addLoginButton();
    this.setupOverlayHandlers();
    this.checkGuestSession(); // Check and initialize guestSession
    this.addGtfsButton();


  }

  ngOnDestroy(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    if (this.busDataInterval) {
      clearInterval(this.busDataInterval);
    }
  }

  @ViewChild('fileInput') fileInput!: ElementRef;

  private async initMap(L: any): Promise<void> {
    if (this.isBrowser) {
      // Initialize the map
      this.map = L.map('map', {
        center: [44.4268, 26.1025],
        zoom: 13
      });

      // Define the default tile layer (OpenStreetMap)
      const defaultLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      });

      // Define the Carto Light layer
      const cartoLightLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
      });

      let trafficLayer: any;
      let trafficButtonEnabled = false;

      // Function to determine the traffic status based on speed
      function getTrafficStatus(speed_kph: number) {
        if (speed_kph < 10) {
          return 'Bumper to bumper traffic';
        } else if (speed_kph < 15) {
          return 'Heavy Traffic';
        } else if (speed_kph < 30) {
          return 'Moderate traffic';
        } else {
          return 'Moderate traffic';
        }
      }

// Function to determine the color based on the traffic status
      function getTrafficStatusColor(speed_kph: number) {
        if (speed_kph < 10) {
          return '#ff5252';  // Red color for severe traffic
        } else if (speed_kph < 15) {
          return '#ff5252';  // Red color for heavy traffic
        } else if (speed_kph < 30) {
          return 'orange';  // Orange for moderate traffic
        } else {
          return 'green';  // Green for free-flowing traffic
        }
      }

      let alertLayer: any;

// Fetch traffic data and create the traffic layer
      Promise.all([
        fetch('/api/trafficdata').then(response => response.json()),
        fetch('/api/alertdata').then(response => response.json())
      ])
        .then(([trafficData, alertData]) => {
          // Create traffic layer but do not add it to the map
          trafficLayer = L.geoJSON(trafficData, {
            style: function (feature: { properties: { road_line: number; type: string; speed_kph: number; }; }) {
              if (feature.properties.road_line === 1 || feature.properties.type === 'ROAD_CLOSED') {
                return {
                  color: '#ff0000',
                  weight: 5,
                  opacity: 1,
                  dashArray: '15, 15',
                  dashOffset: '0',
                  lineCap: 'butt'
                };
              } else {
                return {
                  color: getTrafficStatusColor(feature.properties.speed_kph),
                  weight: 5,
                  opacity: 0.7
                };
              }
            },
            onEachFeature: function (feature: { properties: { delay_s: number; speed_kph: number; street: any; length: any; }; }, layer: { bindPopup: (arg0: string) => void; }) {
              const delayMinutes = Math.abs(Number((feature.properties.delay_s / 60).toFixed(0)));
              const speed_kph = feature.properties.speed_kph.toFixed(1);
              const trafficStatus = getTrafficStatus(Number(speed_kph));
              const statusColor = getTrafficStatusColor(Number(speed_kph));

              const popupContent = `
          <div style="font-family: 'Gotham Rounded', 'Rubik', sans-serif; font-size: 14px; padding: 10px;">
            <strong style="color: ${statusColor};">
              ${trafficStatus}
            </strong><br>
            <strong>On:</strong> ${feature.properties.street} in București<br>
            <strong>Average speed:</strong> ${speed_kph} km/h<br>
            <strong>Driving time:</strong> ${delayMinutes} minutes<br>
            <strong>Length:</strong> ${feature.properties.length} meters
          </div>
        `;
              layer.bindPopup(popupContent);
            }
          });

          // Create alert layer but do not add it to the map
          const alertMarkers = alertData.features
            .filter((alert: { properties: { type: any; }; }) => {
              const type = alert.properties.type;
              return type !== 'JAM' && type !== 'ROAD_CLOSED';
            })
            .map((alert: { properties: { type: string; sub_type: string; city: string; street: string; time: any; }; geometry: { coordinates: [any, any]; }; }) => {
              let iconUrl = 'assets/default.png';
              if (alert.properties.type === 'ACCIDENT') {
                iconUrl = 'assets/accidente.png';
              } else if (alert.properties.type === 'HAZARD') {
                switch (alert.properties.sub_type) {
                  case 'HAZARD_ON_ROAD_POT_HOLE':
                    iconUrl = 'assets/hazard.png';
                    break;
                  case 'HAZARD_WEATHER_FLOOD':
                    iconUrl = 'assets/flood.png';
                    break;
                  default:
                    iconUrl = 'assets/lucrari.png';
                    break;
                }
              }

              const [lon, lat] = alert.geometry.coordinates;
              const alertIcon = L.icon({
                iconUrl,
                iconSize: [30, 30],   // Icon size
                iconAnchor: [15, 30], // Anchor point (centered horizontally, bottom of icon)
                popupAnchor: [0, -20] // Moves the popup 20px upwards (adjust this value as needed)
              });
              const marker = L.marker([lat, lon], { icon: alertIcon });

              const alertTitle = alert.properties.sub_type ? alert.properties.sub_type.replace(/_/g, ' ') : alert.properties.type.replace(/_/g, ' ');

              marker.bindPopup(`
          <div style="font-family: 'Gotham Rounded', 'Rubik', sans-serif; font-size: 14px;">
            <strong>${alertTitle}</strong><br>
            <strong>City:</strong> ${alert.properties.city || 'Unknown city'}<br>
            <strong>Street:</strong> ${alert.properties.street || 'Unknown street'}<br>
            <strong>Time:</strong> ${alert.properties.time}
          </div>
        `);
              return marker;
            });

          alertLayer = L.layerGroup(alertMarkers);
        })
        .catch(error => console.error('Error fetching data:', error));

// Traffic button control
      L.Control.TrafficButton = L.Control.extend({
        onAdd: function (map: { hasLayer: (arg0: any) => any; removeLayer: (arg0: any) => void; addLayer: (arg0: any) => void; }) {
          const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
          container.style.backgroundImage = 'url(assets/traffic.svg)';
          container.style.backgroundSize = '30px 30px';
          container.style.width = '30px';
          container.style.height = '30px';
          container.style.cursor = 'pointer';
          container.style.backgroundColor = 'white';

          let layersVisible = false; // Layers are initially off

          container.onclick = function () {
            if (layersVisible) {
              map.removeLayer(trafficLayer);
              map.removeLayer(alertLayer);
            } else {
              map.addLayer(trafficLayer);
              map.addLayer(alertLayer);
            }
            layersVisible = !layersVisible; // Toggle the state
          };

          return container;
        }
      });

      L.control.trafficButton = function (opts: any) {
        return new L.Control.TrafficButton(opts);
      };

      L.control.trafficButton({ position: 'topright' }).addTo(this.map);

// Do not add layers initially when the map loads


// Do not add the layers to the map initially




      // Add the Carto Light layer by default
      cartoLightLayer.addTo(this.map);
      this.enableMapRotation();

      // Create a custom icon for markers
      const customIcon = L.icon({
        iconUrl: 'assets/marker-icon.png',
        iconRetinaUrl: 'assets/marker-icon-2x.png',
        shadowUrl: 'assets/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      // Traffic toggle button control

      if (!this.isMobile) {
        // Add Leaflet.pm controls to the map
        (this.map as any).pm.addControls({
          position: 'topright',
          drawMarker: true,
          drawPolygon: true,
          drawPolyline: true,
          drawCircle: true,
          drawCircleMarker: true,
          drawRectangle: true,
          editMode: true,
          dragMode: true,
          cutPolygon: true,
          removalMode: true
        });

        // Handle creation of new layers
        this.map.on('pm:create', (e: any) => {
          const layer = e.layer;
          this.map.pm.addLayer(layer);
          this.saveMapData();
        });

        // Handle removal of layers
        this.map.on('pm:remove', (e: any) => {
          this.saveMapData();
        });

        // Handle the drawing start event to apply custom icon to markers
        this.map.on('pm:drawstart', (e: any) => {
          if (e.shape === 'Marker') {
            this.map.pm.setGlobalOptions({
              markerStyle: {
                icon: customIcon
              }
            });
          }
        });
      }


      // Custom toggle switch control
      L.Control.ToggleSwitch = L.Control.extend({
        onAdd: function (map: { removeLayer: (arg0: any) => void; }) {
          const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
          container.style.padding = '2px';
          container.style.display = 'flex'; // Use flexbox for horizontal alignment
          container.style.alignItems = 'center'; // Vertically center items
          const labelText = L.DomUtil.create('span', '', container);
          labelText.textContent = 'BaseMap: ';
          // Create the checkbox input
          const checkbox = L.DomUtil.create('input', '', container);
          checkbox.type = 'checkbox';
          checkbox.id = 'leaflet-toggle-switch';
          checkbox.style.display = 'none';
          checkbox.style.backgroundColor = '#ffffff';

          // Create the label that will act as the switch
          const label = L.DomUtil.create('label', 'switch', container);
          label.htmlFor = 'leaflet-toggle-switch';
          label.style.position = 'relative';
          label.style.display = 'inline-block';
          label.style.width = '34px';
          label.style.height = '20px';

          // Create the slider inside the label
          const slider = L.DomUtil.create('span', 'slider round', label);
          slider.style.position = 'absolute';
          slider.style.cursor = 'pointer';
          slider.style.top = '0';
          slider.style.left = '0';
          slider.style.right = '0';
          slider.style.bottom = '0';
          slider.style.backgroundColor = '#ccc';
          slider.style.transition = '.4s';
          slider.style.borderRadius = '20px';

          // Create the slider's 'before' pseudo-element as a span
          const sliderBefore = L.DomUtil.create('span', '', slider);
          sliderBefore.style.position = 'absolute';
          sliderBefore.style.height = '14px';
          sliderBefore.style.width = '14px';
          sliderBefore.style.left = '3px';
          sliderBefore.style.bottom = '3px';
          sliderBefore.style.backgroundColor = 'white';
          sliderBefore.style.transition = '.4s';
          sliderBefore.style.borderRadius = '50%';

          let isCartoLightActive = true;

          checkbox.onchange = function () {
            if (checkbox.checked) {
              map.removeLayer(cartoLightLayer);
              defaultLayer.addTo(map);
              slider.style.backgroundColor = '#4CAF50'; // Green background when checked
              sliderBefore.style.transform = 'translateX(14px)'; // Move the slider
            } else {
              map.removeLayer(defaultLayer);
              cartoLightLayer.addTo(map);
              slider.style.backgroundColor = '#ccc'; // Gray background when unchecked
              sliderBefore.style.transform = 'translateX(0)'; // Reset the slider
            }
            isCartoLightActive = !isCartoLightActive;
          };

          return container;
        },


      });

      // Add the toggle switch to the map
      L.control.toggleSwitch = function (opts: any) {
        return new L.Control.ToggleSwitch(opts);
      };

      L.control.toggleSwitch({position: 'topright'}).addTo(this.map);

      // Load GeoJSON layers or other custom layers
      await this.loadGeoJSONLayers();
    }
  }


  private getUserLocationAndDisplayNearbyStations(): void {
    if (this.isBrowser && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          // Set the map view to the current position
          this.map.setView([lat, lng], 15);

          // Remove the existing marker if it exists
          if (this.currentLocationMarker) {
            this.map.removeLayer(this.currentLocationMarker);
          }

          // Define the arrow icon with the specified size
          const arrowIcon = L.icon({
            iconUrl: 'assets/arrow.png', // Path to your arrow.png file
            iconSize: [25, 25],          // Size of the icon
            iconAnchor: [12.5, 12.5],    // Anchor point to center the icon
            popupAnchor: [0, -12.5]      // Adjust the popup anchor if needed (not used here)
          });

          // Add the new marker with the arrow icon at the current position
          this.currentLocationMarker = L.marker([lat, lng], {icon: arrowIcon}).addTo(this.map);

          // Now find the nearest bus stations
          this.displayNearestBusStations([lat, lng]);
        },
        (error) => {
          console.error('Geolocation error:', error);
        },
        {
          enableHighAccuracy: true,  // Enable high accuracy if available
          maximumAge: 0,             // Don't use cached positions
          timeout: Infinity          // Keep watching indefinitely
        }
      );
    } else {
      console.error('Geolocation is not supported by this browser.');
    }
  }

  private nearbyStationMarkers: L.Marker[] = []; // Store markers for nearby stations

  private displayNearestBusStations(userLocation: [number, number]): void {
    if (this.stationsGeoJsonData && this.isBrowser) {
      const maxDistance = 0.5; // Adjust as needed
      const nearbyStations: GeoJSON.Feature<GeoJSON.Point>[] = [];  // Explicitly define the type for Point features

      console.log('User location:', userLocation);

      for (const routeShortName in this.stationsGeoJsonData) {
        const stationFeatures = this.stationsGeoJsonData[routeShortName] || [];

        stationFeatures.forEach((feature: GeoJSON.Feature<GeoJSON.GeometryObject>) => {
          if (feature.geometry.type === 'Point') {
            const pointGeometry = feature.geometry as GeoJSON.Point;
            const stationCoords: [number, number] = [pointGeometry.coordinates[1], pointGeometry.coordinates[0]];
            const distance = this.calculateDistance(userLocation, stationCoords);

            console.log(`Distance to ${feature.properties?.["Statie"]}: ${distance} km`);

            if (distance <= maxDistance) {
              nearbyStations.push(feature as GeoJSON.Feature<GeoJSON.Point>);
              console.log(`Added station ${feature.properties?.["Statie"]} within ${maxDistance} km`);
            } else {
              console.log(`Station ${feature.properties?.["Statie"]} is too far (${distance} km)`);
            }
          }
        });
      }

      if (nearbyStations.length > 0) {
        console.log('Nearby stations:', nearbyStations);

        nearbyStations.forEach((feature: GeoJSON.Feature<GeoJSON.Point>) => {
          const stationCoords: [number, number] = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
          const stationIcon = L.icon({
            iconUrl: 'assets/statie_autobuz.png',
            iconSize: [30, 30], // Adjust size
            iconAnchor: [15, 30], // Adjust anchor point
            popupAnchor: [0, -30] // Adjust popup anchor
          });

          // Format Linii Comune without Linia/sens
          const liniiComuneFormatted = feature.properties?.["Linii Comune"]
            ? `<strong>Linii Comune:</strong> ${feature.properties["Linii Comune"].split(', ').map((line: string) => {
              return `<span style="background-color: ${this.determineBoxColor(line)}; color: white; padding: 2px 4px; border-radius: 3px;">${line}</span>`;
            }).join(', ')}<br>`
            : '';

          // Construct the popup content without Linia/sens
          const popupContent = `
                    <div>
                        <strong>Cod Statie:</strong> ${feature.properties?.["Cod Statie"] ?? 'N/A'}<br>
                        <strong>Statie:</strong> ${feature.properties?.["Statie"] ?? 'N/A'}<br>
                        ${liniiComuneFormatted}
                        <strong>Mod Transp:</strong> ${feature.properties?.["Mod Transp"] ?? 'N/A'}<br>
                        <strong>Linii :</strong><br>
                        <em>Loading arrival data...</em>
                    </div>
                `;

          const marker = L.marker(stationCoords, {icon: stationIcon})
            .bindPopup(popupContent)
            .addTo(this.map);

          this.currentStationMarkers.push(marker);
          this.nearbyStationMarkers.push(marker); // Store marker for removal later

          // Fetch and display the next arrival data
          this.loadArrivalData(marker, feature.properties, false); // Pass an argument to indicate whether to include Linia/sens
        });
      } else {
        console.warn('No nearby stations found.');
      }
    } else {
      console.warn('No stations data available or not in browser environment.');
    }
  }


// Utility function to calculate the distance between two coordinates
  private calculateDistance(coord1: [number, number], coord2: [number, number]): number {
    const [lat1, lon1] = coord1;
    const [lat2, lon2] = coord2;

    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const d = R * c; // in metres
    const distanceKm = d / 1000; // Convert to kilometers

    console.log(`Distance between ${coord1} and ${coord2}: ${distanceKm} km`); // Add this line

    return distanceKm;
  }

  private async loadRouteDetails() {
    try {
      const data = await this.excelReaderService.readExcelFromAssets('assets/route_data.xlsx');
      console.log('Excel Data:', data); // Debugging log

      data.forEach(route => {
        const rawRouteId = route.route_id;
        let routeId: number;

        // Check if the route_id starts with "PV" and handle it
        if (rawRouteId.startsWith('PV')) {
          // Extract the numeric portion after the underscore, ignoring any trailing characters
          const routeIdMatch = rawRouteId.match(/_(\d+)/);
          routeId = routeIdMatch ? parseInt(routeIdMatch[1]) : NaN;
        } else {
          // Directly convert route_id to a number for non-PV values
          routeId = parseInt(rawRouteId);
        }

        console.log('Processing route_id:', rawRouteId, 'Converted to:', routeId); // Debugging log

        if (!isNaN(routeId)) {
          this.routeMap.set(routeId, route.route_short_name.toString());
        } else {
          console.warn('Invalid route_id detected:', rawRouteId); // Warn about invalid route_id
        }
      });

      console.log('Route Map:', this.routeMap); // Debugging log

      this.routeDetails = data.map(route => {
        const rawRouteId = route.route_id;
        let routeId: number;

        // Apply the same logic to ensure consistency
        if (rawRouteId.startsWith('PV')) {
          const routeIdMatch = rawRouteId.match(/_(\d+)/);
          routeId = routeIdMatch ? parseInt(routeIdMatch[1]) : NaN;
        } else {
          routeId = parseInt(rawRouteId);
        }

        const shortName = route.route_short_name.toString();

        // Determine routeType based on shortName
        let routeType: number;
        const shortNameNum = parseInt(shortName);
        if (shortNameNum >= 1 && shortNameNum <= 55) {
          routeType = 0;
        } else if (shortNameNum >= 56 && shortNameNum <= 99) {
          routeType = 11;
        } else if (shortNameNum >= 100 && shortNameNum <= 999) {
          routeType = 3;
        } else {
          routeType = parseInt(route.route_type); // Fallback to the original route_type if it doesn't match the criteria
        }

        return {
          routeId: routeId,
          shortName: shortName,
          routeType: routeType // Set routeType based on the logic above
        };
      }).filter(route => !isNaN(route.routeId)); // Filter out any invalid route IDs

      // Sort the route details by shortName
      this.routeDetails.sort((a, b) => parseInt(a.shortName) - parseInt(b.shortName));
      this.filteredRouteDetails = this.routeDetails;
    } catch (error) {
      console.error('Error reading Excel file:', error);
    }
  }


  removeUploadedGeoJsonFromMap(index: number): void {
    if (this.uploadedGeoJsonLayers[index]) {
      this.map.removeLayer(this.uploadedGeoJsonLayers[index]);
      this.uploadedGeoJsonLayers.splice(index, 1);
      this.uploadedGeoJsonFiles.splice(index, 1);
    }
  }

  private async loadRoutesGeoJSON() {
    try {
      const geoJsonData = await this.dataLoader.loadGeoJSON('./data/layers/routes_iun2024.geojson');
      geoJsonData.features.forEach((feature: any) => {
        const routeName = feature.properties.route_name;
        if (!this.routeGeoJsonData[routeName]) {
          this.routeGeoJsonData[routeName] = [];
        }
        this.routeGeoJsonData[routeName].push(feature);
      });
      console.log('Loaded and filtered GeoJSON data:', this.routeGeoJsonData); // Debugging log
    } catch (error) {
      console.error('Error loading routes GeoJSON:', error);
    }
  }

  private async loadStationsGeoJSON() {
    try {
      const geoJsonData = await this.dataLoader.loadGeoJSON('./data/layers/Statii_Transport_Public_Suprafata.geojson');
      console.log('Raw GeoJSON Data:', geoJsonData); // Debugging log

      geoJsonData.features.forEach((feature: any) => {
        console.log('Processing feature:', feature); // Debugging log

        // Validate and sanitize the feature properties
        if (isNaN(feature.geometry.coordinates[0]) || isNaN(feature.geometry.coordinates[1])) {
          console.warn('Invalid coordinates:', feature.geometry.coordinates);
          return; // Skip invalid features
        }

        const line = feature.properties["Linia/sens"];
        if (!line) {
          console.warn('Invalid Linia/sens:', line);
          return; // Skip features without Linia/sens
        }

        // Check if the Route ID starts with "PV" and handle it
        let routeIdString = feature.properties["Route ID"];
        console.log('Original Route ID:', routeIdString); // Debugging log

        if (routeIdString.startsWith('PV')) {
          // Remove the "PV" prefix and the underscore, then parse the number
          routeIdString = routeIdString.split('_')[1];
        }

        console.log('Processed Route ID String:', routeIdString); // Debugging log

        const routeId = parseInt(routeIdString);
        console.log('Parsed Route ID:', routeId); // Debugging log

        if (isNaN(routeId)) {
          console.warn('Invalid Route ID after parsing:', routeIdString);
          return; // Skip features with invalid Route ID
        }

        // Use the full route short name (line) as the key in stationsGeoJsonData
        if (!this.stationsGeoJsonData[line]) {
          this.stationsGeoJsonData[line] = [];
        }

        // Store the feature with the cleaned route ID
        feature.properties["Route ID"] = routeId; // Update feature with cleaned Route ID
        this.stationsGeoJsonData[line].push(feature);
      });

      console.log('Loaded and filtered Stations GeoJSON data:', this.stationsGeoJsonData); // Debugging log
    } catch (error) {
      console.error('Error loading stations GeoJSON:', error);
    }
  }


  zoomToLocation(): void {
    if (this.isBrowser && navigator.geolocation) {
      let hasZoomed = false; // Flag to ensure we only zoom once

      navigator.geolocation.watchPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          // Set the map view to the current position only the first time
          if (!hasZoomed) {
            this.map.setView([lat, lng], 15); // Adjust the zoom level as needed
            hasZoomed = true; // Set the flag to true after the first zoom
          }

          // Remove the existing marker if it exists
          if (this.currentLocationMarker) {
            this.map.removeLayer(this.currentLocationMarker);
          }

          // Define the arrow icon with the specified size
          const arrowIcon = L.icon({
            iconUrl: 'assets/arrow.png', // Path to your arrow.png file
            iconSize: [25, 25],          // Size of the icon
            iconAnchor: [12.5, 12.5],    // Anchor point to center the icon
            popupAnchor: [0, -12.5]      // Adjust the popup anchor if needed (not used here)
          });

          // Add the new marker with the arrow icon at the current position
          this.currentLocationMarker = L.marker([lat, lng], {icon: arrowIcon}).addTo(this.map);
        },
        (error) => {
          console.error('Geolocation error:', error);
        },
        {
          enableHighAccuracy: true,  // Enable high accuracy if available
          maximumAge: 0,             // Don't use cached positions
          timeout: Infinity          // Keep watching indefinitely
        }
      );
    } else {
      console.error('Geolocation is not supported by this browser.');
    }
  }


  private loadRouteLayer(routeShortName: string, routeId: number, color: string) {
    if (this.routeGeoJsonData && this.isBrowser) {
      const routeFeatures = this.routeGeoJsonData[routeShortName] || [];

      let selectedLayer: L.Path | null = null;

      const routeLayer = L.geoJSON(routeFeatures, {
        style: {
          color: color,
          weight: 3,
          opacity: 1
        },
        onEachFeature: (feature, layer) => {
          // Add popup content

          // @ts-ignore
          this.addPopupContent(layer, routeShortName, '#3388ff', 1);
          // Cast the layer to L.Path to ensure we can call setStyle on it
          const pathLayer = layer as L.Path;

          // Add hover effect
          pathLayer.on("mouseover", () => {
            if (selectedLayer !== pathLayer) {
              pathLayer.setStyle({
                color: "purple",
              });
            }
          });

          // Revert hover effect
          pathLayer.on("mouseout", () => {
            if (selectedLayer !== pathLayer) {
              pathLayer.setStyle({
                color: color,
              });
            }
          });

          // Add click effect
          pathLayer.on("click", () => {
            if (selectedLayer && selectedLayer !== pathLayer) {
              selectedLayer.setStyle({
                color: color,
              });
            }

            pathLayer.setStyle({
              color: "yellow",
            });

            selectedLayer = pathLayer;
          });
        }
      }).addTo(this.map);

      this.routeLayers.set(routeId, routeLayer);
      this.loadStationMarkers(routeShortName, routeId);
      console.log("Route id is:", routeId);
    }
  }

  private loadStationMarkers(routeShortName: string, routeId: number) {
    console.log('Loading station markers for:', {routeShortName, routeId});
    if (this.stationsGeoJsonData && this.isBrowser) {
      console.log('Route Short Name:', routeShortName);
      console.log('GeoJSON Data:', this.stationsGeoJsonData[routeShortName]);

      const stationFeatures = this.stationsGeoJsonData[routeShortName] || [];
      const markers: any[] = [];

      // Determine if the device is mobile
      const isMobile = window.innerWidth <= 768;

      stationFeatures.forEach((feature: any) => {
        const {coordinates} = feature.geometry;
        const {properties} = feature;

        console.log('Route ID in properties:', properties["Route ID"]);
        console.log('Comparing with routeId:', routeId);

        if (parseInt(properties["Route ID"]) === routeId) {
          let iconUrl = 'assets/statie_autobuz.png';

          if (properties["Mod Transp"] === 'TRAM') {
            iconUrl = 'assets/statie_tramvai.png';
          } else if (properties["Mod Transp"] === 'Metrou') {
            iconUrl = 'assets/statie_metrou.png';
          }

          const stationIcon = L.icon({
            iconUrl,
            iconSize: isMobile ? [25, 25] : [30, 30], // Adjust size based on device
            iconAnchor: isMobile ? [15, 25] : [15, 30], // Adjust anchor point
            popupAnchor: isMobile ? [0, -20] : [0, -30] // Adjust popup anchor
          });

          const determineBoxColor = (routeShortName: string) => {
            if (routeShortName.startsWith('M')) {
              return 'black';
            } else if (routeShortName.startsWith('N')) {
              return 'darkblue';
            } else {
              const routeNumber = parseInt(routeShortName);
              if (routeNumber >= 1 && routeNumber <= 55) {
                return '#BE1622';
              } else if (routeNumber >= 56 && routeNumber <= 99) {
                return '#008D36';
              } else if (routeNumber >= 100 && routeNumber <= 400) {
                return '#1D71B8';
              } else if (routeNumber >= 400 && routeNumber <= 999) {
                return '#662483';
              }
            }
            return 'yellow'; // Fallback color
          };

          const formatLiniiComune = (liniiComune: string) => {
            return liniiComune.split(', ').map(line => {
              const boxColor = determineBoxColor(line);
              return `<span style="background-color: ${boxColor}; color: white; padding: 2px 4px; border-radius: 3px;">${line}</span>`;
            }).join(', ');
          };

          const liniiConexe = properties["Linii Comune"]
            ? `<strong>Linii Comune:</strong> <span style="color: black;">${formatLiniiComune(properties["Linii Comune"])}</span><br>`
            : '';

          const selectedRouteColor = determineBoxColor(routeShortName);
          const linieSens = `<strong>Linie/Sens:</strong> <span style="background-color: ${selectedRouteColor}; color: white; padding: 2px 4px; border-radius: 3px;">${routeShortName}</span><br>`;

          const artera = properties["Mod Transp"] !== 'Metrou'
            ? `<strong>Artera:</strong> ${properties["Artera"]}<br>`
            : '';

          // Set up the marker with a basic popup, and lazy-load the arrival data
          // @ts-ignore
          const marker = L.marker([coordinates[1], coordinates[0]], {icon: stationIcon})
            .bindPopup(`
                        <div>
                            <strong>Cod Statie:</strong> ${properties["Cod Statie"]}<br>
                            <strong>Statie:</strong> ${properties["Statie"]}<br>
                            ${linieSens}
                            ${liniiConexe}
                            ${artera}
                            <strong>Mod Transp:</strong> ${properties["Mod Transp"]}<br>
                            <em>Loading arrival data...</em>
                        </div>
                    `)
            .on('click', () => this.loadArrivalData(marker, properties, true));

          markers.push(marker);
          marker.addTo(this.map);
        }
      });

      if (markers.length > 0) {
        this.stationMarkers.set(routeId, markers);
      } else {
        console.warn(`No markers found for routeShortName: ${routeShortName} and routeId: ${routeId}`);
      }
    } else {
      console.warn('No station data available or not in browser environment.');
    }
  }

  private loadArrivalData(marker: L.Marker, properties: any, includeLiniaSens: boolean): void {
    const codStatie = properties["Cod Statie"];

    const updateArrivalData = () => {
      this.http.get(`/api/nextArrivals/${codStatie}`).subscribe(
        (response: any) => {
          if (response && Array.isArray(response.lines)) {
            let filteredArrivals = response.lines.filter((line: any) => {
              return line.arrivingTime !== undefined;
            });

            filteredArrivals = filteredArrivals.sort((a: any, b: any) => {
              return a.arrivingTime - b.arrivingTime;
            });

            const nextArrivals = filteredArrivals.map((line: any) => {
              let arrivingTimeText: string;
              const arrivingTimeInMinutes = Math.floor(line.arrivingTime / 60);

              if (arrivingTimeInMinutes === 0) {
                arrivingTimeText = '<span style="color: white; font-weight: bold;">În Stație</span>';
              } else if (arrivingTimeInMinutes < 1) {
                arrivingTimeText = '<span style="color: white; font-weight: bold;"> <1 min</span>';
              } else if (arrivingTimeInMinutes >= 60) {
                const hours = Math.floor(arrivingTimeInMinutes / 60);
                const minutes = arrivingTimeInMinutes % 60;
                arrivingTimeText = `<span style="color: white; font-weight: bold;">${hours} oră${hours > 1 ? ' și' : ''} ${minutes} min</span>`;
              } else {
                arrivingTimeText = `<span style="color: white; font-weight: bold;">${arrivingTimeInMinutes} min</span>`;
              }

              return `
                            <div style="background-color: ${line.color}; color: white; padding: 2px 4px; border-radius: 3px; margin-bottom: 2px;">
                                ${line.name} - ${line.directionName}
                                <span style="background-color: green; padding: 2px 4px; border-radius: 3px; margin-left: 5px;">
                                    ${arrivingTimeText}
                                </span>
                            </div>`;
            }).join('') || 'No arrivals';

            // If there are no valid arrivals, remove the marker and stop updating
            if (nextArrivals === 'No arrivals') {
              this.map.removeLayer(marker);
              return;
            }

            // Construct the popup content
            let popupContent = `
                        <div>
                            <strong>Cod Statie:</strong> ${properties["Cod Statie"]}<br>
                            <strong>Statie:</strong> ${properties["Statie"]}<br>
                    `;

            if (includeLiniaSens) {
              const linieSensColor = this.determineBoxColor(properties["Linia/sens"]);
              const linieSensFormatted = `<span style="background-color: ${linieSensColor}; color: white; padding: 2px 4px; border-radius: 3px;">${properties["Linia/sens"]}</span><br>`;
              popupContent += `<strong>Linia/sens:</strong> ${linieSensFormatted}`;
            }

            popupContent += `
                        <strong>Mod Transp:</strong> ${properties["Mod Transp"]}<br>
                        <strong>Linii (La ora):</strong><br>
                        ${nextArrivals}
                        </div>
                    `;

            // @ts-ignore
            marker.getPopup().setContent(popupContent).update();
          } else {
            // If there's no valid response, remove the marker
            this.map.removeLayer(marker);
            console.error('Expected an array of lines but received:', response);
          }
        },
        error => {
          // In case of an error, remove the marker and log the error
          this.map.removeLayer(marker);
          console.error('Error fetching next arrivals:', error);
        }
      );
    };

    updateArrivalData();
    const intervalId = setInterval(updateArrivalData, 5000);
    marker.on('popupclose', () => {
      clearInterval(intervalId);
    });
  }


  private determineBoxColor(routeShortName: string): string {
    if (routeShortName.startsWith('M')) {
      return 'black';
    } else if (routeShortName.startsWith('N')) {
      return 'darkblue';
    } else {
      const routeNumber = parseInt(routeShortName);
      if (routeNumber >= 1 && routeNumber <= 55) {
        return '#BE1622';
      } else if (routeNumber >= 56 && routeNumber <= 99) {
        return '#008D36';
      } else if (routeNumber >= 100 && routeNumber <= 400) {
        return '#1D71B8';
      } else if (routeNumber >= 400 && routeNumber <= 500) {
        return '#662483';
      }
    }
    return 'yellow'; // Fallback color
  }


  private addPopupContent(layer: any, properties: any, isMultiLineString: boolean) {
    const popupContent = document.createElement('div');

    // Display route information in the popup
    for (const key in properties) {
      if (properties.hasOwnProperty(key)) {
        const propertyDiv = document.createElement('div');
        propertyDiv.innerHTML = `<strong>${key}:</strong> ${properties[key]}`;
        popupContent.appendChild(propertyDiv);
      }
    }

    // Only add style controls for multilines or polylines
    if (isMultiLineString) {
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = '#3388ff';
      colorInput.onchange = (e) => this.changeLayerStyle(layer, 'color', (e.target as HTMLInputElement).value);

      const weightInput = document.createElement('input');
      weightInput.type = 'range';
      weightInput.min = '1';
      weightInput.max = '10';
      weightInput.step = '1';
      weightInput.value = '3';
      weightInput.oninput = (e) => this.changeLayerStyle(layer, 'weight', parseFloat((e.target as HTMLInputElement).value));

      const opacityInput = document.createElement('input');
      opacityInput.type = 'range';
      opacityInput.min = '0.1';
      opacityInput.max = '1';
      opacityInput.step = '0.1';
      opacityInput.value = '1';
      opacityInput.oninput = (e) => this.changeLayerStyle(layer, 'opacity', parseFloat((e.target as HTMLInputElement).value));

      // Dash pattern input
      const dashInput = document.createElement('input');
      dashInput.type = 'text';
      dashInput.placeholder = 'e.g., 10,5'; // Dash pattern: 10px line, 5px gap
      dashInput.oninput = (e) => this.changeLayerStyle(layer, 'dashArray', (e.target as HTMLInputElement).value);

      // Labels for inputs
      const labelColor = document.createElement('label');
      labelColor.innerText = 'Color: ';
      labelColor.appendChild(colorInput);

      const labelWeight = document.createElement('label');
      labelWeight.innerText = 'Weight: ';
      labelWeight.appendChild(weightInput);

      const labelOpacity = document.createElement('label');
      labelOpacity.innerText = 'Opacity: ';
      labelOpacity.appendChild(opacityInput);

      const labelDash = document.createElement('label');
      labelDash.innerText = 'Dash Pattern: ';
      labelDash.appendChild(dashInput);

      // Add inputs to the popup
      popupContent.appendChild(document.createElement('br'));
      popupContent.appendChild(labelColor);
      popupContent.appendChild(document.createElement('br'));
      popupContent.appendChild(labelWeight);
      popupContent.appendChild(document.createElement('br'));
      popupContent.appendChild(labelOpacity);
      popupContent.appendChild(document.createElement('br'));
      popupContent.appendChild(labelDash);
    }

    // Bind the popup content to the layer
    layer.bindPopup(popupContent);
  }

  private changeLayerStyle(layer: any, styleProperty: string, value: any) {
    const newStyle: any = {};
    newStyle[styleProperty] = value;
    layer.setStyle(newStyle);
  }
  private loadGtfsData() {
    if (this.isBrowser) {
      // Initialize filteredRouteDetails with all routes from routeMap
      this.filteredRouteDetails = Array.from(this.routeMap.entries()).map(([routeId, shortName]) => {
        return {
          routeId: routeId,
          shortName: shortName,
          routeType: this.routeDetails.find(r => r.routeId === routeId)?.routeType || null
        };
      });

      // Fetch bus data and update filteredRouteDetails accordingly
      this.busDataService.getBusData().subscribe(data => {
        const activeRoutes = new Set<number>();

        data.forEach((bus: any) => {
          const routeId = parseInt(bus.vehicle.trip.routeId);
          activeRoutes.add(routeId);
        });

        // Update routeTypes for active routes
        this.filteredRouteDetails = this.filteredRouteDetails.map(route => {
          if (activeRoutes.has(route.routeId)) {
            return {
              ...route,
              active: true
            };
          } else {
            return {
              ...route,
              active: false
            };
          }
        });

        this.filteredRouteDetails.sort((a, b) => parseInt(a.shortName) - parseInt(b.shortName));

      }, error => {
        console.error('Error fetching GTFS data:', error);
      });
    }
  }


  private loadPassengerData(): void {
    this.busPassengerService.getPassengerData().subscribe(data => {
      this.passengerData = data.reduce((acc: { [x: string]: any; }, passengerInfo: {
        vehicle: { vehicle: { id: { toString: () => string | number; }; }; passenger_info: any; };
      }) => {
        acc[passengerInfo.vehicle.vehicle.id.toString()] = passengerInfo.vehicle.passenger_info;
        return acc;
      }, {});
      console.log('Loaded passenger data:', this.passengerData);
    }, error => {
      console.error('Error fetching passenger data:', error);
    });
  }

  private loadBusData(): void {
    if (this.isBrowser) {
      this.busDataService.getBusData().subscribe(data => {
        this.updateBusMarkers(data);
      }, error => {
        console.error('Error fetching bus data:', error);
      });
    }
  }

  addGeoJsonLayer(geoJsonData: any): void {
    const layer = L.geoJSON(geoJsonData, {
      pointToLayer: (feature, latlng) => {
        const customIcon = L.icon({
          iconUrl: 'assets/marker-icon.png',
          shadowUrl: 'assets/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });
        return L.marker(latlng, {icon: customIcon});
      },
      onEachFeature: (feature, layer) => {
        let popupContent = '<div>';
        for (const key in feature.properties) {
          popupContent += `<strong>${key}:</strong> ${feature.properties[key]}<br>`;
        }
        if (feature.geometry.type === 'MultiLineString') {
          popupContent += '<br><label>Color: <input type="color" value="#3388ff" onchange="changeLayerStyle(layer, \'color\', this.value)"></label>';
          popupContent += '<br><label>Weight: <input type="range" min="1" max="10" step="1" value="3" oninput="changeLayerStyle(layer, \'weight\', this.value)"></label>';
          popupContent += '<br><label>Opacity: <input type="range" min="0.1" max="1" step="0.1" value="1" oninput="changeLayerStyle(layer, \'opacity\', this.value)"></label>';
        }
        popupContent += '</div>';
        layer.bindPopup(popupContent);
      }
    }).addTo(this.map);

    this.uploadedGeoJsonLayers.push(layer);
  }

  toggleUploadMenu() {
    this.showUploadMenu = !this.showUploadMenu;
  }

  // Add the new methods in LeafletMapComponent
  @Output() userIdEvent = new EventEmitter<unknown>();
  // @ts-ignore
  @Input() userId!: string | null;

  onFileUpload(event: any): void {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (e: any) => {
      const geoJsonData = JSON.parse(e.target.result);
      this.uploadedGeoJsonFiles.push({layer: undefined, name: file.name, data: geoJsonData});
    };

    reader.readAsText(file);
  }

  addUploadedGeoJsonToMap(fileData: any): void {
    const layer = L.geoJSON(fileData.data, {
      pointToLayer: (feature, latlng) => {
        const customIcon = L.icon({
          iconUrl: 'assets/marker-icon.png',
          shadowUrl: 'assets/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });
        return L.marker(latlng, {icon: customIcon});
      },
      onEachFeature: (feature, layer) => {
        this.addPopupContent(layer, feature.properties, feature.geometry.type === 'MultiLineString' || feature.geometry.type === 'LineString');
      }
    }).addTo(this.map);

    this.uploadedGeoJsonLayers.push(layer);
  }


  saveGeoJsonToDatabase(): void {
    const userId = this.userId; // Assume you have this.userId set after login
    if (!userId) {
      alert('Please log in first.');
      return;
    }

    const geoJsonData = this.uploadedGeoJsonFiles.map(file => file.data);
    this.http.post('/api/saveGeoJson', {userId, geoJsonData}).subscribe(
      (response: any) => {
        alert('GeoJSON data saved successfully.');
      },
      (error: any) => {
        console.error('Error saving GeoJSON data:', error);
      }
    );
  }


  triggerFileUpload(): void {
    const fileInput = document.getElementById('uploadGeoJSON') as HTMLInputElement;
    fileInput.click();
  }

  private updateBusMarkers(data: any, isStationSpecific: boolean = false): void {
    if (this.isBrowser) {
      console.log('Updating bus markers for selected routes:', this.selectedRoutes);

      const busIcon = L.icon({
        iconUrl: isStationSpecific ? 'assets/bus-rt.svg.png' : 'assets/Bus-logo.svg.png',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15]
      });

      const markersToUpdate = new Map<number, L.Marker[]>();

      // Check if the user is a guest
      const isGuest = localStorage.getItem('guestSession') === 'true';

      if (data && Array.isArray(data)) {
        data.forEach(bus => {
          const routeId = parseInt(bus.vehicle.trip.routeId);
          const routeShortName = this.routeMap.get(routeId) || 'Unknown';

          // Skip buses with an unknown routeShortName
          if (routeShortName === 'Unknown') {
            return; // Skip this iteration
          }

          if (this.selectedRoutes.includes(routeId) || isStationSpecific) {
            const position = bus.vehicle.position;
            const vehicleId = bus.vehicle.vehicle.id.toString();
            const thorebId = this.getThorebId(parseInt(vehicleId)); // Retrieve Thoreb ID
            const passengerData = this.passengerData[vehicleId];
            const passengerCount = passengerData ? passengerData.on_board : 'N/A';
            const directionId = bus.vehicle.trip.directionId;
            const capatName = this.getCapatName(routeId, directionId);
            let marker = this.busMarkers.find(m => m.options.routeId === routeId && m.options.vehicleId === vehicleId);
            if (!marker) {
              marker = L.marker([position.latitude, position.longitude], {icon: busIcon}).addTo(this.map);
              if (isStationSpecific) {
                this.stationBusMarkers.push(marker); // Keep track of station-specific markers
              } else {
                this.busMarkers.push(marker);
              }
            } else {
              marker.setLatLng([position.latitude, position.longitude]);
            }

            // Build the popup content, omitting IDs if the user is a guest
            let popupContent = `
            <div>
              ${!isGuest && thorebId ? `<strong>Thoreb ID:</strong> ${thorebId}<br>` : ''}
              ${!isGuest ? `<strong>Vehicle ID:</strong> ${vehicleId}<br>` : ''}
             ${!isGuest ? `<strong>License Plate:</strong> ${bus.vehicle.vehicle.licensePlate}<br>` : ''}
              ${!isGuest ? `<strong>Route ID:</strong>(${routeId})<br>` : ''}
              <strong>Linia: </strong>${routeShortName} <br>
              <strong>Direction:</strong> ${capatName}<br>
              <strong>Passenger Count:</strong> ${passengerCount}<br>
            </div>
          `;

            if (marker.getPopup() && marker.getPopup().isOpen()) {
              marker.getPopup().setContent(popupContent);
              marker.openPopup();
            } else {
              marker.bindPopup(popupContent);
            }

            let routeMarkers = markersToUpdate.get(routeId);
            if (!routeMarkers) {
              routeMarkers = [];
              markersToUpdate.set(routeId, routeMarkers);
            }
            routeMarkers.push(marker);

            // @ts-ignore
            marker.options.routeId = routeId;
            marker.options.vehicleId = vehicleId;
          }
        });
      }

      if (!isStationSpecific) {
        // Disable automatic zoom only if this is not a station-specific update
        this.map.options.zoomControl = false;
        this.map.options.doubleClickZoom = false;
        this.map.options.scrollWheelZoom = false;
      }

      // Remove markers that are no longer needed
      this.busMarkers = this.busMarkers.filter(marker => {
        const routeId = marker.options.routeId;
        const routeMarkers = markersToUpdate.get(routeId);
        return routeMarkers && routeMarkers.includes(marker);
      });
    }
  }


  private getCapatName(routeId: number, directionId: number): string {
    const routeIdStr = routeId.toString();

    // Iterate over each line in the stationsGeoJsonData
    for (const line in this.stationsGeoJsonData) {
      const features = this.stationsGeoJsonData[line];

      for (const feature of features) {
        const featureRouteId = parseInt(feature.properties["Route ID"]);
        const featureDirectionId = feature.properties["Directie"];

        if (featureRouteId === routeId && featureDirectionId === directionId) {
          console.log(`Match found for Route ID: ${routeIdStr} with Direction ID: ${directionId}`);
          return feature.properties["Capat"] || 'Unknown';
        }
      }
    }

    // If no matching Capat is found
    console.warn(`No matching Capat found for Route ID: ${routeIdStr} with Direction ID: ${directionId}.`);
    return 'Unknown';
  }


  private async loadGeoJSONLayers() {
    if (this.isBrowser) {
      try {
        this.layerConfigs = await this.dataLoader.loadCSV('/data/layers/conf.csv');
        this.layerConfigs = this.layerConfigs.filter(config => config.file && config.overlayName);
        console.log('Loaded layer configurations:', this.layerConfigs);

        const {default: L} = await import('leaflet');

        let selectedLayer: L.Path | null = null;

        for (const config of this.layerConfigs) {
          const geojson = await this.dataLoader.loadGeoJSON(`/data/layers/${config.file}`);

          const customIcon = this.iconMapping[config.file] || L.icon({
            iconUrl: 'assets/marker-icon.png',
            iconRetinaUrl: 'assets/marker-icon-2x.png',
            shadowUrl: 'assets/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });

          const layer = L.geoJSON(geojson, {
            pointToLayer: (feature, latlng) => L.marker(latlng, {icon: customIcon}),
            style: (feature) => {
              // @ts-ignore
              if (feature.geometry.type !== 'Point') {
                return {
                  color: config.strokeColor,
                  weight: config.strokeWeight,
                  fillColor: config.fillColor,
                  fillOpacity: config.opacity
                };
              }
              return {};
            },
            onEachFeature: (feature, featureLayer) => {
              // Cast featureLayer to L.Path to access setStyle method
              const pathLayer = featureLayer as L.Path;

              let popupContent = `<div class="popup-content-wrapper"><h3>${config.overlayName}</h3>`;
              const properties = Object.entries(feature.properties);
              properties.forEach(([key, value]) => {
                popupContent += `<div><strong>${key}</strong>: ${value}</div>`;
              });
              popupContent += `</div>`;
              pathLayer.bindPopup(popupContent);

              // Add event listeners for hover and click
              pathLayer.on("mouseover", () => {
                if (selectedLayer !== pathLayer) {
                  pathLayer.setStyle({
                    color: "purple",
                  });
                }
              });

              pathLayer.on("mouseout", () => {
                if (selectedLayer !== pathLayer) {
                  pathLayer.setStyle({
                    color: (pathLayer.options as any).originalColor,
                  });
                }
              });

              pathLayer.on("click", () => {
                if (selectedLayer && selectedLayer !== pathLayer) {
                  selectedLayer.setStyle({
                    color: (selectedLayer.options as any).originalColor,
                  });
                }

                pathLayer.setStyle({
                  color: "yellow",
                });

                selectedLayer = pathLayer;
              });

              // Store the original color in the options
              (pathLayer.options as any).originalColor = config.strokeColor;
            }
          });

          this.layersControl[config.overlayName] = layer;

          if (geojson.features.some((feature: any) => feature.geometry.type === 'Point')) {
            this.pointLayers.add(config.overlayName);
          }
        }

        console.log('Point layers:', this.pointLayers);
      } catch (error) {
        console.error('Error loading GeoJSON layers:', error);
      }
    }
  }


  toggleLayer(layerName: string, event: Event) {
    if (this.isBrowser) {
      const input = event.target as HTMLInputElement;

      // Check if the layer is already added, and remove it if it is
      if (this.map.hasLayer(this.layersControl[layerName])) {
        this.map.removeLayer(this.layersControl[layerName]);
      }

      if (input.checked) {
        // Add the layer to the map
        this.map.addLayer(this.layersControl[layerName]);
      }

      this.saveMapData();
    }
  }

  clearAllSelections() {
    // Remove all layers and markers from the map
    this.map.eachLayer((layer: any) => {
      if (layer instanceof L.GeoJSON || layer instanceof L.Marker) {
        this.map.removeLayer(layer);
      }
    });

    // Reset selections and markers
    this.selectedRoutes = [];
    this.selectedRouteShortNames = [];
    this.busMarkers = [];
    this.currentStationMarkers = [];
    this.currentRouteLayer = null;

    // Provide feedback to the user
    this.snackBar.open('All selections cleared.', 'Close', {
      duration: 3000
    });
  }


  changeLayerColor(layerName: string, event: Event) {
    if (this.isBrowser) {
      const input = event.target as HTMLInputElement;
      const newColor = input.value;
      const layer = this.layersControl[layerName];
      layer.eachLayer((layer: any) => {
        if (layer.feature.geometry.type !== 'Point') {
          layer.setStyle({color: newColor, fillColor: newColor});
        }
      });
      this.saveMapData();
    }
  }

  private enableMapRotation(): void {
    let startRotationAngle: number | null = null;
    let currentRotationAngle = 0;

    if (!this.isMobile) {
      return; // Only enable rotation on mobile devices
    }

    const getAngle = (p1: any, p2: any) => {
      return Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
    };

    const rotateMap = (angle: number) => {
      this.map.getContainer().style.transform = `rotate(${angle}deg)`;
    };

    this.map.on('touchstart', (e: any) => {
      if (e.touches.length === 2) {
        const p1 = this.map.mouseEventToContainerPoint(e.touches[0]);
        const p2 = this.map.mouseEventToContainerPoint(e.touches[1]);
        startRotationAngle = getAngle(p1, p2);
      }
    });

    this.map.on('touchmove', (e: any) => {
      if (e.touches.length === 2 && startRotationAngle !== null) {
        const p1 = this.map.mouseEventToContainerPoint(e.touches[0]);
        const p2 = this.map.mouseEventToContainerPoint(e.touches[1]);
        const newAngle = getAngle(p1, p2);
        const deltaAngle = newAngle - startRotationAngle;

        currentRotationAngle += deltaAngle;
        rotateMap(currentRotationAngle);

        startRotationAngle = newAngle;
      }
    });

    this.map.on('touchend', () => {
      startRotationAngle = null;
    });
  }


  changeLayerWeight(layerName: string, event: Event) {
    if (this.isBrowser) {
      const input = event.target as HTMLInputElement;
      let newWeight = Math.round(parseFloat(input.value));
      newWeight = Math.min(Math.max(newWeight, 1), 10);

      const layer = this.layersControl[layerName];
      layer.eachLayer((layer: any) => {
        if (layer.feature.geometry.type !== 'Point') {
          layer.setStyle({weight: newWeight});
        }
      });
      this.saveMapData();
    }
  }

  isPointLayer(config: GeoJSONLayerConfig): boolean {
    const isPoint = this.pointLayers.has(config.overlayName);
    // console.log(`Layer ${config.overlayName} is point: ${isPoint}`);
    return isPoint;
  }

  toggleMenu() {
    this.showMenu = !this.showMenu;
  }

  toggleGtfsMenu() {
    this.showGtfsMenu = !this.showGtfsMenu;
    if (this.showGtfsMenu) {
      this.loadGtfsData();
    }
  }

  filterRoutes() {
    const searchTerm = this.searchTerm.toLowerCase();
    this.filteredRouteDetails = this.routeDetails.filter(route =>
      route.shortName.toLowerCase().includes(searchTerm) && route.shortName !== 'Unknown'
    );
  }


  filterByType(routeType: number) {
    this.selectedRouteType = routeType;
    this.filteredRouteDetails = this.routeDetails.filter(route => route.routeType === routeType);
  }

  selectRoute(routeId: number) {
    const routeShortName = this.routeMap.get(routeId) || 'Unknown';
    const routeIndex = this.selectedRoutes.indexOf(routeId);
    const routeColors = ['blue', 'brown', 'black', 'red', '#4EFFEF']; // Define your colors here

    this.removeNearbyStationMarkers();


    if (this.isMobile) {
      this.showGtfsMenu = false; // Close the GTFS RealTime menu
      this.zoomToLocation(); // Zoom to the user's location
    }

    if (routeIndex > -1) {
      // Deselect the route
      this.selectedRoutes.splice(routeIndex, 1);
      this.selectedRouteShortNames.splice(routeIndex, 1);

      if (this.routeLayers.has(routeId)) {
        this.map.removeLayer(this.routeLayers.get(routeId));
        this.routeLayers.delete(routeId);
      }

      if (this.stationMarkers.has(routeId)) {
        // @ts-ignore
        this.stationMarkers.get(routeId).forEach((marker: any) => {
          this.map.removeLayer(marker);
        });
        this.stationMarkers.delete(routeId);
      }

      this.removeBusMarkers(routeId);
    } else {
      if (this.selectedRoutes.length < 5) {
        // Select the route
        this.selectedRoutes.push(routeId);
        this.selectedRouteShortNames.push(routeShortName);

        // Get the color based on the number of selected routes
        const color = routeColors[this.selectedRoutes.length - 1];

        // Pass the color to the loadRouteLayer function
        this.loadRouteLayer(routeShortName, routeId, color);
        this.loadBusData();
      } else {
        this.snackBar.open('You can only select up to 5 routes at a time', 'Close', {
          duration: 3000
        });
      }
    }

    // If no routes are selected, display the nearby station markers using displayNearestBusStations
    if (this.selectedRouteShortNames.length === 0) {
      // Get the user's current location
      navigator.geolocation.getCurrentPosition(position => {
        const userLocation: [number, number] = [position.coords.latitude, position.coords.longitude];
        this.displayNearestBusStations(userLocation);
      }, error => {
        console.error('Error getting user location:', error);
        // Fallback to a default location if needed
        const defaultLocation: [number, number] = [44.4268, 26.1025]; // Example: Bucharest coordinates
        this.displayNearestBusStations(defaultLocation);
      });
    }
  }

  private removeNearbyStationMarkers(): void {
    this.nearbyStationMarkers.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.nearbyStationMarkers = []; // Clear the array after removal
  }


  private removeBusMarkers(routeId: number): void {
    this.busMarkers = this.busMarkers.filter(marker => {
      if (marker.options.routeId === routeId) {
        this.map.removeLayer(marker);
        return false;
      }
      return true;

    });
  }

  saveMapData() {
    if (this.userId) {
      const mapData = this.getMapData();
      this.http.post('/api/saveMapData', {userId: this.userId, mapData})
        .subscribe(response => {
          console.log('Map data saved successfully');
        }, error => {
          console.error('Error saving map data:', error);
        });
    } else {
      console.log('Please log in first.');
    }
  }

  loadMapData() {
    if (this.userId) {
      console.log('Loading map data for userId:', this.userId); // Debug log
      this.http.get('/api/getMapData', {params: {userId: this.userId}})
        .subscribe((response: any) => {
          if (response.success) {
            console.log('Map data retrieved from backend:', response.mapData);
            this.setMapData(response.mapData);
          } else {
            console.error('No map data found for the user');
          }
        }, error => {
          console.error('Error retrieving map data:', error);
        });
    }
  }


  getMapData() {
    const mapData: any = {
      layers: []
    };

    this.map.eachLayer((layer: any) => {
      if (layer.toGeoJSON) {
        mapData.layers.push(layer.toGeoJSON());
      }
    });

    return mapData;
  }

  async setMapData(mapData: any) {
    const {default: L} = await import('leaflet');

    // Clear existing layers
    this.map.eachLayer((layer: any) => {
      if (layer.pm) {
        this.map.removeLayer(layer);
      }
    });

    const customIcon = L.icon({
      iconUrl: 'assets/marker-icon.png',
      iconRetinaUrl: 'assets/marker-icon-2x.png',
      shadowUrl: 'assets/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    console.log('Setting map data:', mapData);

    mapData.layers.forEach((geojson: any) => {
      const layer = L.geoJSON(geojson, {
        pointToLayer: (feature, latlng) => {
          return L.marker(latlng, {icon: customIcon});
        }
      }).addTo(this.map);

      // Add the layer to the map
      this.map.addLayer(layer);
    });

    console.log('Map data successfully added to map');
  }

  private loadThorebData() {
    this.http.get<any[]>('/api/dataset').subscribe(
      (data) => {
        this.thorebData = data;
      },
      (error) => {
        console.error('Error fetching Thoreb ID data:', error);
      }
    );
  }

  private getThorebId(vehicleId: number): string | null {
    const vehicle = this.thorebData.find((item: any) => item.vehicle.vehicle.id === vehicleId);
    return vehicle ? vehicle.vehicle.vehicle.th_id : null;
  }

  private addLoginButton(): void {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');

    // Set the initial icon based on guest session
    const isGuest = localStorage.getItem('guestSession') === 'true';
    const iconUrl = isGuest ? 'assets/login-icon.svg.png' : 'assets/logout-icon.svg.png';

    container.style.backgroundColor = 'white';
    container.style.backgroundImage = `url(${iconUrl})`;
    container.style.backgroundSize = '30px 30px';
    container.style.width = '30px';
    container.style.height = '30px';
    container.style.cursor = 'pointer';

    container.onclick = () => {
      const isGuest = localStorage.getItem('guestSession') === 'true';

      if (isGuest) {
        this.showLoginOverlay(); // If guest, show login overlay
      } else {
        this.logout(); // If logged in, log out
      }
    };

    const customControl = L.Control.extend({
      options: {
        position: 'topleft'
      },
      onAdd: function (map: L.Map) {
        return container;
      }
    });

    this.map.addControl(new customControl());
  }

  private setupOverlayHandlers(): void {
    const overlay = document.getElementById('loginOverlay');
    const closeOverlayBtn = document.getElementById('closeOverlay');

    if (overlay && closeOverlayBtn) {
      closeOverlayBtn.onclick = () => {
        this.hideLoginOverlay();
      };
    }
  }

  private showLoginOverlay(): void {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) {
      overlay.style.display = 'flex';
    }
  }

  private hideLoginOverlay(): void {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  public onLoginSubmit(): void {
    // Make sure username and password are entered
    if (!this.loginData.username || !this.loginData.password) {
      this.showAlert('Error', 'Username and password are required', 'error');
      return;
    }

    this.http.post('/api/login', this.loginData)
      .pipe(
        catchError((error) => {
          this.handleLoginError(error);
          return throwError(error);
        })
      )
      .subscribe((response: any) => {
        if (response.success) {
          this.showAlert('Success', 'Login successful!', 'success');
          this.hideLoginOverlay(); // Close the login overlay
          this.guestSession = false; // Set guestSession to false
          localStorage.setItem('guestSession', 'false'); // Update guestSession in localStorage
          localStorage.setItem('username', this.loginData.username); // Save username for later use

          // Update bus markers
          // @ts-ignore
          this.updateBusMarkers();

          // Change the login button to the logout icon
          this.updateLoginButtonIcon(true); // Pass 'true' to indicate logged in
        } else {
          this.showAlert('Error', 'Invalid username or password', 'error');
        }
      });


  }

  // Handle login errors
  private handleLoginError(error: any): void {
    console.error('Error details:', error); // Log full error details for inspection

    if (error.status === 400) {
      this.showAlert('Error', 'Invalid request. Please check the form data.', 'error');
    } else if (error.status === 401) {
      this.showAlert('Unauthorized', 'Incorrect username or password.', 'error');
    } else {
      this.showAlert('Error', 'An unexpected error occurred. Please try again later.', 'error');
    }
  }


  // Show alert using SweetAlert2
  private showAlert(title: string, text: string, icon: 'success' | 'error'): void {
    Swal.fire({
      title: title,
      text: text,
      icon: icon,
      confirmButtonText: 'OK'
    });
  }

  public logout(): void {
    const username = localStorage.getItem('username'); // Retrieve the logged-in username

    // Show a sweetalert popup with the waving emoji and the username
    Swal.fire({
      title: `👋 Goodbye, ${username}!`,
      text: 'You have successfully logged out.',
      icon: 'success',
      confirmButtonText: 'OK'
    }).then(() => {
      // After the popup is confirmed, proceed with logout actions

      // Set guestSession to true in localStorage
      localStorage.setItem('guestSession', 'true');
      this.guestSession = true; // Set guestSession to true in the component

      // Update the bus markers to reflect the guest state
      // @ts-ignore

      // Change the login button back to the login icon
      this.updateLoginButtonIcon(false); // Pass 'false' to indicate it's now logout state

      // Clear the username from localStorage
      localStorage.removeItem('username');
    });
  }

  private updateLoginButtonIcon(isLoggedIn: boolean): void {
    // Get the existing control and update the icon based on login/logout state
    const loginButton = document.querySelector('.leaflet-control-custom');

    if (loginButton) {
      const iconUrl = isLoggedIn ? 'assets/logout-icon.svg.png' : 'assets/login-icon.svg.png';

      // Update the icon in the button
      (loginButton as HTMLElement).style.backgroundImage = `url(${iconUrl})`;
    }
  }

  private checkGuestSession() {
    const storedSession = localStorage.getItem('guestSession');
    if (storedSession === null) {
      localStorage.setItem('guestSession', 'true'); // Initialize guestSession as true
      this.guestSession = true;
    } else {
      this.guestSession = storedSession === 'true'; // Set guestSession based on stored value
    }
  }

  private addGtfsButton(): void {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');

    container.style.backgroundColor = 'white';
    container.style.backgroundImage = 'url(assets/transit-hub.svg.png)';
    container.style.backgroundSize = '30px 30px';
    container.style.width = '30px';
    container.style.height = '30px';
    container.style.cursor = 'pointer';

    // Create a hidden file input element to trigger file uploads
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.zip';  // Allow only .zip files
    fileInput.style.display = 'none'; // Hidden input
    container.appendChild(fileInput);

    // When the button is clicked, trigger the file input dialog or show the GTFS menu if data exists
    container.onclick = () => {
      const isLoggedIn = localStorage.getItem('guestSession') !== 'true'; // Assuming 'guestSession' stores true for guest users

      // Check if user is logged in
      if (!isLoggedIn) {
        // If user is not logged in, show login prompt
        Swal.fire({
          title: '🔒 Please Log In',
          text: 'You need to log in to upload the GTFS file.',
          icon: 'warning',
          confirmButtonText: 'Log In'
        }).then((result) => {
          if (result.isConfirmed) {
            // Show the login overlay
            this.showLoginOverlay();
          }
        });
      } else {
        // If user is logged in, check if GTFS data is already loaded
        if (this.routes.length > 0 && this.stations.length > 0) {
          // If data is already loaded, show the GTFS selection menu again
          // @ts-ignore
          this.showGtfsSelectionMenu(this.routes, this.stations);
        } else {
          // If no data is loaded, trigger file input for GTFS file upload
          fileInput.click();
        }
      }
    };

    // Handle the file selection and upload
    fileInput.onchange = async (event: any) => {
      const file = event.target.files[0];
      if (file) {
        // Call the method to upload the GTFS file
        await this.uploadGtfsFile(file); // Assuming `uploadGtfsFile` is the method that handles file uploads
      }
    };

    // Add the GTFS button to the map
    const customControl = L.Control.extend({
      options: {
        position: 'topleft' // Place the button in the top-left corner
      },
      onAdd: function (map: L.Map) {
        return container;
      }
    });

    this.map.addControl(new customControl());
  }

  // Define component-level variables to store GTFS data
  private routes: any[] = [];
  private stations: any[] = [];

  private async uploadGtfsFile(file: File): Promise<void> {
    const formData = new FormData();
    formData.append('gtfs', file);

    try {
      // Show SweetAlert progress
      Swal.fire({
        title: 'Processing GTFS File...',
        html: 'Parsing <b></b> of files...',
        timerProgressBar: true,
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // Upload the file to the backend
      const response = await fetch('/api/upload-gtfs', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();

        // Log and store the shapes
        console.log('Received shapes from backend:', result.shapes);
        this.routes = result.routes;  // Store routes locally
        this.stations = result.stations;  // Store stations locally
        this.shapes = result.shapes;  // Store shapes locally

        // Ensure that the shapes are correctly stored
        console.log('Stored shapes in the component:', this.shapes);

        Swal.close();
        // @ts-ignore
        this.showGtfsSelectionMenu(this.routes, this.stations);
      } else {
        Swal.fire({
          title: '⚠️ Upload Failed',
          text: 'There was an issue uploading the GTFS file. Please try again.',
          icon: 'error',
          confirmButtonText: 'Retry'
        });
      }
    } catch (error) {
      Swal.fire({
        title: '❌ Error',
        text: 'An error occurred while uploading the GTFS file.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      console.error('Error uploading GTFS file:', error);
    }
  }

// Function to show a custom form using SweetAlert2
  // Function to show a custom form using SweetAlert2
  private showGtfsSelectionMenu(routes: any[], stations: any[], stopTimes: any[]): void {
    // Convert routes into HTML select options
    const routeOptions = routes.map(route => {
      return `<option value="${route.route_id}">${route.route_short_name || 'Unnamed Route'}</option>`;
    }).join('');

    Swal.fire({
      title: 'Select Route',
      html: `
    <label for="route-select">Select Route:</label>
    <select id="route-select" class="swal2-input">
      ${routeOptions}
    </select>
    `,
      confirmButtonText: 'Submit',
      showCancelButton: true,
      preConfirm: () => {
        const selectedRouteId = (document.getElementById('route-select') as HTMLSelectElement).value;

        if (!selectedRouteId) {
          Swal.showValidationMessage('Please select a route');
          return null;
        }
        return { selectedRouteId };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        const { selectedRouteId } = result.value;

        // Automatically show the stations and route for the selected route
        this.showStationsForRoute(selectedRouteId, stations);
        this.displaySelectedRoute(selectedRouteId, routes, this.shapes); // Pass the shapes for the route
      }
    });
  }
  private showStationsForRoute(routeId: string, stations: any[]): void {
    // Filter stations that match the selected route_id
    const stationsForRoute = stations.filter(station => station.route_id === routeId);

    // Display stations as markers on the map
    stationsForRoute.forEach(station => {
      const stationLatLng = [station.stop_lat, station.stop_lon];
      // @ts-ignore
      const stationMarker = L.marker(stationLatLng, {
        icon: L.icon({
          iconUrl: 'assets/statie_autobuz.png',
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          popupAnchor: [0, -30],
        })
      }).addTo(this.map);

      // Bind a popup to the station marker
      stationMarker.bindPopup(`
      <div>
        <strong>Station:</strong> ${station.stop_name}<br>
        <strong>Description:</strong> ${station.stop_desc || 'No description available'}
      </div>
    `).openPopup();
    });
  }

// Call this function after receiving stops data from the server

  private displaySelectedRoute(routeId: string, routes: any[], shapes: any[]): void {
    // Assign shapes to the class property to ensure it's available throughout the class
    this.shapes = shapes;

    // Get shapes for the selected route
    const routeShapes = this.shapes[routeId];

    // Add a check to confirm if shapes for the route exist
    if (!routeShapes || routeShapes.length === 0) {
      console.log(`No shape data found for route ${routeId}`);
      return;
    }

    // Map shape points into an array of LatLng for the polyline
    const polylinePoints = routeShapes.map((shape: { lat: any; lon: any; }) => [shape.lat, shape.lon]);

    // Create and add the polyline to the map
    const polyline = L.polyline(polylinePoints, { color: 'blue', weight: 3 }).addTo(this.map);

    // Add popup content with route details
    const properties = {
      route_id: routeId,
      name: routes.find((r: any) => r.route_id === routeId)?.route_short_name || 'Unnamed Route',
    };

    // Add customization popups for the polyline
    this.addPopupContent(polyline, properties, true);  // true for polyline/multi-line

    // Fit the map to the bounds of the polyline
    this.map.fitBounds(polyline.getBounds());
  }


}
