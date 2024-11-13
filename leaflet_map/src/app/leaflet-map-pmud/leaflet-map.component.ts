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
  EventEmitter, AfterViewInit
} from '@angular/core';
import {isPlatformBrowser, NgForOf, NgIf, NgOptimizedImage} from '@angular/common';
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
import {ToolbarComponent} from "../toolbar/toolbar.component";
@Component({
  selector: 'app-leaflet-map',
  templateUrl: './leaflet-map.component.html',
  standalone: true,
  imports: [
    HttpClientModule,
    NgForOf,
    NgIf,
    FormsModule,
    NgOptimizedImage
  ],
  styleUrls: ['./leaflet-map.component.css']
})
export class LeafletMapComponentPMUD implements OnInit, OnDestroy, AfterViewInit {
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
  public searchTerm: string = '';
  private routeMap: Map<number, string> = new Map();
  private routeGeoJsonData: any = {}; // Store pre-filtered GeoJSON data
  private stationsGeoJsonData: any = {}; // Store pre-filtered stations GeoJSON data
  public showUploadMenu: boolean = false;
  uploadedGeoJsonLayers: any[] = [];
  public selectedRoutes: number[] = [];
  public selectedRouteShortNames: string[] = [];
  private routeLayers: Map<number, any> = new Map();
  private stationMarkers: Map<number, any[]> = new Map();
  private currentLocationMarker: L.Marker | null = null;
  public uploadedGeoJsonFiles: {
    data: any;
    name: string, layer: any
  }[] = [];
  public uploadedGeoJsonLayer: any;
  protected isMobile: boolean | undefined;

  @Input() setUserId(userId: string) { // Add this method
    this.userId = userId;
  }
  @ViewChild('menuContainer') menuContainer!: ElementRef;
  @ViewChild('arrow') arrow!: ElementRef;
  @ViewChild(ToolbarComponent) toolbar: ToolbarComponent | undefined; // Add ViewChild for ToolbarComponent
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
    private authService: AuthService // Inject the AuthService


  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    this.isBrowser = isPlatformBrowser(platformId);
  }

  async ngOnInit(): Promise<void> {
    if (this.isMobile) {
      document.addEventListener('click', this.handleOutsideClick.bind(this));
    }
    if (this.isBrowser) {
      const {default: L} = await import('leaflet');
      await import('@geoman-io/leaflet-geoman-free');
      this.initMap(L);

      this.autoSaveInterval = setInterval(() => {
      }, 300000);

      await this.loadRoutesGeoJSON(); // Load the GeoJSON data and pre-filter it
    }
    console.log('Sidebar initial state:', this.isSidebarCollapsed);
  }
  ngAfterViewInit() {
    this.menuContainer.nativeElement.addEventListener('scroll', this.handleScroll.bind(this));
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
        zoom: 13,
        zoomControl:false
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

      // Define the OSM Traffic layer
      const trafficLayer = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      });

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
      L.Control.TrafficButton = L.Control.extend({
        onAdd: function(map: { hasLayer: (arg0: any) => any; removeLayer: (arg0: any) => void; addLayer: (arg0: any) => void; }) {
          const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');

          container.style.backgroundColor = 'white';
          container.style.backgroundImage = 'url(assets/traffic.svg)';
          container.style.backgroundSize = '30px 30px';
          container.style.width = '30px';
          container.style.height = '30px';
          container.style.cursor = 'pointer';

          container.onclick = function() {
            if (map.hasLayer(trafficLayer)) {
              map.removeLayer(trafficLayer);
            } else {
              map.addLayer(trafficLayer);
            }
          };

          return container;
        },

        onRemove: function(map: { removeLayer: (arg0: any) => void; }) {
          map.removeLayer(trafficLayer);
        }
      });
      L.Control.TrafficButtonWithLabel = L.Control.TrafficButton.extend({
        onAdd: function(map: any) {
          // Create a wrapper container for the label and the button
          const container = L.DomUtil.create('div', 'traffic-button-container');

          // Create the label element
          const label = L.DomUtil.create('span', 'traffic-button-label');
          label.textContent = 'Traffic Layer:';

          // Call the original onAdd to get the button element
          const button = L.Control.TrafficButton.prototype.onAdd.call(this, map);

          // Add the label and button to the container
          container.appendChild(label);
          container.appendChild(button);

          // Adjust container's position to align with PM controls
          container.style.marginTop = '10px'; // Adjust this value as needed
          container.style.display = 'flex';
          container.style.alignItems = 'center';
          container.style.justifyContent = 'flex-end'; // Align to the right side

          return container;
        }
      });

// Add the traffic button with label to the map
      L.control.trafficButtonwithLabel = function (opts: any) {
        return new L.Control.TrafficButtonWithLabel(opts);
      };

      L.control.trafficButtonwithLabel({ position: 'topright' }).addTo(this.map);


      if(!this.isMobile)
        {
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
          });

          // Handle removal of layers
          this.map.on('pm:remove', (e: any) => {
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
        onAdd: function(map: { removeLayer: (arg0: any) => void; }) {
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

          checkbox.onchange = function() {
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
      L.control.toggleSwitch = function(opts: any) {
        return new L.Control.ToggleSwitch(opts);
      };

      L.control.toggleSwitch({ position: 'topright' }).addTo(this.map);

      // Load GeoJSON layers or other custom layers
      await this.loadGeoJSONLayers();
    }
  }
  handleOutsideClick(event: Event) {
    const target = event.target as HTMLElement;
    const sidebar = document.querySelector('.sidebar-container');
    const toggleButton = document.querySelector('.toggle-sidebar-button');

    if (sidebar && toggleButton && !sidebar.contains(target) && !toggleButton.contains(target)) {
      this.isSidebarCollapsed = true; // Collapse sidebar on outside click
    }
  }
  handleScroll() {
    const containerScrollTop = this.menuContainer.nativeElement.scrollTop;
    const arrowOffsetTop = this.arrow.nativeElement.offsetTop;

    // Adjust these values based on your layout and desired behavior
    const containerHeight = this.menuContainer.nativeElement.clientHeight;
    const arrowHeight = this.arrow.nativeElement.clientHeight;
    const threshold = 20; // Pixels before the arrow starts following

    if (arrowOffsetTop - containerScrollTop < threshold) {
      this.arrow.nativeElement.style.top = `${containerScrollTop + threshold}px`;
    } else if (arrowOffsetTop + arrowHeight - containerScrollTop > containerHeight - threshold) {
      this.arrow.nativeElement.style.top = `${containerHeight - arrowHeight - threshold}px`;
    } else {
      // Reset to original position if within the visible area
      this.arrow.nativeElement.style.top = '';
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



  private addPopupContent(layer: any, properties: any, isMultiLineString: boolean) {
    const popupContent = document.createElement('div');

    for (const key in properties) {
      if (properties.hasOwnProperty(key)) {
        const propertyDiv = document.createElement('div');
        propertyDiv.innerHTML = `<strong>${key}:</strong> ${properties[key]}`;
        popupContent.appendChild(propertyDiv);
      }
    }

    if (isMultiLineString) {
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = '#3388ff';
      // @ts-ignore
      colorInput.onchange = (e) => this.changeLayerStyle(layer, 'color', e.target.value);

      const weightInput = document.createElement('input');
      weightInput.type = 'range';
      weightInput.min = '1';
      weightInput.max = '10';
      weightInput.step = '1';
      weightInput.value = '3';
      // @ts-ignore
      weightInput.oninput = (e) => this.changeLayerStyle(layer, 'weight', parseFloat(e.target.value));

      const opacityInput = document.createElement('input');
      opacityInput.type = 'range';
      opacityInput.min = '0.1';
      opacityInput.max = '1';
      opacityInput.step = '0.1';
      opacityInput.value = '1';
      // @ts-ignore
      opacityInput.oninput = (e) => this.changeLayerStyle(layer, 'opacity', parseFloat(e.target.value));

      const labelColor = document.createElement('label');
      labelColor.innerText = 'Color: ';
      labelColor.appendChild(colorInput);

      const labelWeight = document.createElement('label');
      labelWeight.innerText = 'Weight: ';
      labelWeight.appendChild(weightInput);

      const labelOpacity = document.createElement('label');
      labelOpacity.innerText = 'Opacity: ';
      labelOpacity.appendChild(opacityInput);

      popupContent.appendChild(document.createElement('br'));
      popupContent.appendChild(labelColor);
      popupContent.appendChild(document.createElement('br'));
      popupContent.appendChild(labelWeight);
      popupContent.appendChild(document.createElement('br'));
      popupContent.appendChild(labelOpacity);
    }

    layer.bindPopup(popupContent);
  }

  private changeLayerStyle(layer: any, styleProperty: string, value: any) {
    const newStyle = {};
    // @ts-ignore
    newStyle[styleProperty] = value;
    layer.setStyle(newStyle);
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
  private updateBusMarkers(data: any): void {
    if (this.isBrowser) {
      console.log('Updating bus markers for selected routes:', this.selectedRoutes);

      const busIcon = L.icon({
        iconUrl: 'assets/Bus-logo.svg.png',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15]
      });

      const markersToUpdate = new Map<number, L.Marker[]>();

      if (data && Array.isArray(data)) {
        data.forEach(bus => {
          const routeId = parseInt(bus.vehicle.trip.routeId);
          const routeShortName = this.routeMap.get(routeId) || 'Unknown';

          // Skip buses with an unknown routeShortName
          if (routeShortName === 'Unknown') {
            return; // Skip this iteration
          }

          if (this.selectedRoutes.includes(routeId)) {
            const position = bus.vehicle.position;
            const vehicleId = bus.vehicle.vehicle.id.toString();
            const passengerData = this.passengerData[vehicleId];
            const passengerCount = passengerData ? passengerData.on_board : 'N/A';

            // Determine the correct Capat based on directionId
            const directionId = bus.vehicle.trip.directionId;
            const capatName = this.getCapatName(routeId, directionId);

            let marker = this.busMarkers.find(m => m.options.routeId === routeId && m.options.vehicleId === vehicleId);
            if (!marker) {
              marker = L.marker([position.latitude, position.longitude], { icon: busIcon }).addTo(this.map);
              this.busMarkers.push(marker);
            } else {
              marker.setLatLng([position.latitude, position.longitude]);
            }

            let popupContent = `
            <div>
              <strong>Bus ID:</strong> ${bus.id}<br>
              <strong>Vehicle ID:</strong> ${vehicleId}<br>
              <strong>License Plate:</strong> ${bus.vehicle.vehicle.licensePlate}<br>
              <strong>Route ID:</strong>(${routeId})<br>
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

            // Store all markers for the selected routeId
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

      // Disable automatic zoom
      this.map.options.zoomControl = false;
      this.map.options.doubleClickZoom = false;
      this.map.options.scrollWheelZoom = false;

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
        this.layerConfigs = await this.dataLoader.loadCSV('/data/PMUDlayers/conf.csv');
        this.layerConfigs = this.layerConfigs.filter(config => config.file && config.overlayName);
        console.log('Loaded layer configurations:', this.layerConfigs);

        const { default: L } = await import('leaflet');

        let selectedLayer: L.Path | null = null;

        for (const config of this.layerConfigs) {
          const geojson = await this.dataLoader.loadGeoJSON(`/data/PMUDlayers/${config.file}`);

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
            pointToLayer: (feature, latlng) => L.marker(latlng, { icon: customIcon }),
            style: (feature) => {
              // @ts-ignore
              if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                // Use the strokeColor from config and other specified styles for polygons
                return {
                  color: config.strokeColor,
                  weight: 3,
                  opacity: 1,
                  lineCap: 'round',
                  lineJoin: 'round',
                  fillOpacity: 0.2,
                  fillRule: 'evenodd'
                };
              }
              // Use the configuration for other geometries
              return {
                color: config.strokeColor,
                weight: config.strokeWeight,
                fillColor: config.fillColor,
                fillOpacity: config.opacity
              };
            },
            onEachFeature: (feature, featureLayer) => {
              const pathLayer = featureLayer as L.Path;
              let popupContent = `<div class="popup-content-wrapper"><h3>${config.overlayName}</h3>`;
              const properties = feature.properties;

              if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                // Display all properties for Polygons
                for (const key in properties) {
                  if (properties.hasOwnProperty(key)) {
                    popupContent += `<div><strong>${key}:</strong> ${properties[key]}</div>`;
                  }
                }
              } else {
                // Only display 'Nume', 'Tip', and 'Cod_prj' for other geometries
                if (properties.Nume) {
                  popupContent += `<div><strong>Nume:</strong> ${properties.Nume}</div>`;
                }
                if (properties.Tip) {
                  popupContent += `<div><strong>Tip:</strong> ${properties.Tip}</div>`;
                }
                if (properties.Cod_prj) {
                  popupContent += `<div><strong>Cod Proiect:</strong> ${properties.Cod_prj}</div>`;
                }
              }

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
    }
  }
  isSidebarCollapsed = true; // Sidebar is initially collapsed


  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    this.showMenu = !this.isSidebarCollapsed; // Show the menu if the sidebar is expanded
  }

  isPointLayer(config: GeoJSONLayerConfig): boolean {
    const isPoint = this.pointLayers.has(config.overlayName);
    // console.log(`Layer ${config.overlayName} is point: ${isPoint}`);
    return isPoint;
  }



}
