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
  EventEmitter,
} from "@angular/core";
import {
  isPlatformBrowser,
  NgClass,
  NgForOf,
  NgIf,
  NgOptimizedImage,
} from "@angular/common";
import { DataLoaderService } from "../services/data-loader.service";
import { GeoJSONLayerConfig } from "../interfaces/geojson-layer-config";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { BusDataService } from "../services/bus-data.service";
import { ExcelReaderService } from "../services/excel-reader.service";
import * as L from "leaflet";
import { FormsModule } from "@angular/forms";
import { BusPassengerService } from "../services/bus-passenger.service";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "../auth.service";
import Swal from "sweetalert2";
import { Renderer2 } from "@angular/core";
import { catchError, throwError } from "rxjs"; // Import for nice popup alerts
import "leaflet.locatecontrol"; // Import plugin


@Component({
  selector: "app-leaflet-map",
  templateUrl: "./leaflet-map.component.html",
  standalone: true,
  imports: [
    HttpClientModule,
    NgForOf,
    NgIf,
    FormsModule,
    NgOptimizedImage,
    NgClass,
  ],
  styleUrls: ["./leaflet-map.component.css"],
})
export class LeafletMapComponent implements OnInit, OnDestroy {
  private excluded_features_from_layer = [
    {
      layer_name: "Accidente_2021_2022",
      excluded_properties: ["id"],
      exclude_all: false,
    },
    {
      layer_name: "Autobaze",
      excluded_properties: ["id"],
      exclude_all: false,
    },
    {
      layer_name: "Autobaze_Ilfov",
      excluded_properties: ["id"],
      exclude_all: false,
    },
    {
      layer_name: "Depouri",
      excluded_properties: ["id"],
      exclude_all: false,
    },
    {
      layer_name: "Semaforizari",
      excluded_properties: [],
      exclude_all: true,
    },
    {
      layer_name: "Semaforizari_IF",
      excluded_properties: [],
      exclude_all: true,
    },
    {
      layer_name: "Statii_Metrou",
      excluded_properties: ["id"],
      exclude_all: false,
    },
    {
      layer_name: "Statii_Tren_Metropolitan",
      excluded_properties: ["id"],
      exclude_all: false,
    },
    {
      layer_name: "Strapungere_Ciurel",
      excluded_properties: ["fid"],
      exclude_all: false,
    },
    {
      layer_name: "retea_tramvai_detaliat",
      excluded_properties: [
        "full_id",
        "osm_id",
        "osm_type",
        "frequency",
        "electrifie",
      ],
      exclude_all: false,
    },
    {
      layer_name: "retea_tramvai",
      excluded_properties: [
        "fid",
        "id",
        "Id rută",
        "Parc Maxim (veh)",
        "Interval succedare (min)",
      ],
      exclude_all: false,
    },
    {
      layer_name: "retea_troleibuze",
      excluded_properties: [
        "Name",
        "description",
        "timestamp",
        "begin",
        "end",
        "altitudeMode",
        "tessellate",
        "extrude",
        "visibility",
        "drawOrder",
        "icon",
        "route_id",
        "Tip",
      ],
      exclude_all: false,
    },
    {
      layer_name: "routes_iun2024",
      excluded_properties: ["route_id"],
      exclude_all: false,
    },
  ];
  private nightRoutesTerminals: any[] = [];
  private nightBusStationMarkers: any[] = [];
  private lastBusPositions: any[] = [];
  private currentLocation = { latlng: { lat: null, lng: null } };
  private lc;
  private firstLoad = false;
  private nearbyStations: GeoJSON.Feature<GeoJSON.Point>[] = [];
  private oldNearbyStations: GeoJSON.Feature<GeoJSON.Point>[] = [];
  private nightBusRoutesLoaded = false;
  private hasZoomed = false; // Flag to ensure we only zoom once
  private deviceOrientationEvent: any;
  private nightRoutesGroup = new L.FeatureGroup();
  private selectedRoutesGroup = new L.FeatureGroup();
  private selectedRoutesGroupLayers: any[] = [];
  private startAngle: number = 0; // To track the initial angle
  private currentRotation: number = 0; // To track the current rotation applied
  private isRotating = false; // Flag to track if we are in the middle of a rotation
  public loginData = { username: "", password: "" }; // Store login data
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
  public searchTerm: string = "";
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
  private tData: any[] = [];
  public uploadedGeoJsonFiles: {
    data: any;
    name: string;
    layer: any;
  }[] = [];
  public uploadedGeoJsonLayer: any;
  protected isMobile: boolean | undefined;
  public guestSession = true;
  private stationBusMarkers: L.Marker[] = []; // To keep track of station-specific bus markers
  private shapes: any;
  @Input() setUserId(userId: string) {
    // Add this method
    this.userId = userId;
    this.loadMapData(); // Load map data when the user ID is set
  }

  customIcon = L.icon({
    iconUrl: "assets/marker-icon.png",
    shadowUrl: "assets/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
  private iconMapping: { [key: string]: L.Icon } = {
    "Semaforizari.geojson": L.icon({
      iconUrl: "assets/semaforizari_Bucuresti.png",
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [1, -30],
      shadowUrl: "assets/marker-shadow.png",
      shadowSize: [41, 41],
    }),
    "Semaforizari_IF.geojson": L.icon({
      iconUrl: "assets/semaforizari_Ilfov.png",
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [1, -30],
      shadowUrl: "assets/marker-shadow.png",
      shadowSize: [41, 41],
    }),
    "Statii_Metrou.geojson": L.icon({
      iconUrl: "assets/statie_metrou.png",
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [1, -30],
      shadowUrl: "assets/marker-shadow.png",
      shadowSize: [41, 41],
    }),
    "Statii_Tren_Metropolitan.geojson": L.icon({
      iconUrl: "assets/statie_tren.png",
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [1, -30],
      shadowUrl: "assets/marker-shadow.png",
      shadowSize: [41, 41],
    }),
    "Autobaze.geojson": L.icon({
      iconUrl: "assets/depou_bucuresti.png",
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [1, -30],
      shadowUrl: "assets/marker-shadow.png",
      shadowSize: [41, 41],
    }),
    "Depouri.geojson": L.icon({
      iconUrl: "assets/depouri_tramvai.png",
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [1, -30],
      shadowUrl: "assets/marker-shadow.png",
      shadowSize: [41, 41],
    }),
    "Autobaze_Ilfov.geojson": L.icon({
      iconUrl: "assets/depou_Ilfov.png",
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [1, -30],
      shadowUrl: "assets/marker-shadow.png",
      shadowSize: [41, 41],
    }),
    "ParkRide.geojson": L.icon({
      iconUrl: "assets/pr_mic.png",
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [1, -30],
      shadowUrl: "assets/marker-shadow.png",
      shadowSize: [41, 41],
    }),
    "Accidente_2021_2022.geojson": L.icon({
      iconUrl: "assets/accidente.png",
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [1, -30],
      shadowUrl: "assets/marker-shadow.png",
      shadowSize: [41, 41],
    }),
  };
  private passengerData: any = []; // Store passenger data
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
    private renderer: Renderer2
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );
    }
    this.isBrowser = isPlatformBrowser(platformId);
  }

  async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      const { default: L } = await import("leaflet");
      await import("@geoman-io/leaflet-geoman-free");
      this.initMap(L);

      this.autoSaveInterval = setInterval(() => {
        this.saveMapData();
      }, 300000);
      this.loadTData();
      await this.loadRouteDetails();
      await this.loadRoutesGeoJSON(); // Load the GeoJSON data and pre-filter it
      await this.loadStationsGeoJSON(); // Load the stations GeoJSON data and pre-filter it
      //this.loadBusData();
      this.addLogoToMap();
      this.busDataInterval = setInterval(() => this.loadBusData(), 4000);
      this.loadPassengerData(); // Load data initially
      setInterval(() => {
        this.loadPassengerData();
      }, 5000);
      this.loadMapData();
    }
    //@ts-ignore
    this.lc = L.control.locate({
      setView: false,
      showCompass: true,
      drawCircle: true,
      drawMarker: true,
      locateOptions: { watch: true, enableHighAccuracy: true },
      showPopup: false,
      strings: { title: "Activați locația si direcția." }
    }).addTo(this.map);

    this.lc.start();

    this.map.on("locationfound", this.updateNearestBusStations, this);
    //this.addTouchRotate();
    //this.getUserLocationAndDisplayNearbyStations();
    //this.addLoginButton();
    //this.setupOverlayHandlers();
    this.checkGuestSession(); // Check and initialize guestSession
    //this.addGtfsButton();
    this.loadNightBus();
  }

  ngOnDestroy(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    if (this.busDataInterval) {
      clearInterval(this.busDataInterval);
    }
  }

  //@ViewChild("fileInput") fileInput!: ElementRef;

  addLogoToMap(): void {
    const mapContainer = document.getElementById("map");
    if (mapContainer) {
      // Create the image element
      const logoImg = this.renderer.createElement("img");
      this.renderer.setAttribute(logoImg, "src", "assets/TPBI.png");
      this.renderer.setAttribute(logoImg, "alt", "TPBI Logo");
      this.renderer.addClass(logoImg, "logo-top-right");

      // Append the logo to the map container
      this.renderer.appendChild(mapContainer, logoImg);
    }
  }
  private async initMap(L: any): Promise<void> {
    if (this.isBrowser) {
      // Initialize the map
      this.map = L.map("map", {
        preferCanvas: true,
        tap: false,
        zoomAnimation: true,
        center: [44.4268, 26.1025],
        zoom: 13,
        rotate: true,
        rotateControl: {
          closeOnZeroBearing: false,
        },
        shiftKeyRotate: true,
        renderer: L.canvas({ tolerance: 15 }),
        touchZoom: true,
        trackResize: true,
        updateWhenZooming: true
      });

      // this.map.locate({
      //   watch:true,
      //   enableHighAccuracy : true
      // });
      //this.map.on('locationfound',this.getUserLocationAndDisplayNearbyStations(false, this.map.getZoom(), true));

      //this.getUserLocationAndDisplayNearbyStations();
      // Define the default tile layer (OpenStreetMap)
      const defaultLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          rotate: true, // Enable rotation on this tile layer
        }
      );

      // Define the Carto Light layer
      const cartoLightLayer = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
          rotate: true, // Enable rotation on this tile layer
        }
      );

      let trafficLayer: any;
      // Function to determine the traffic status based on speed
      function getTrafficStatus(speed_kph: number) {
        if (speed_kph < 10) {
          return "Bumper to bumper traffic";
        } else if (speed_kph < 15) {
          return "Heavy Traffic";
        } else if (speed_kph < 30) {
          return "Moderate traffic";
        } else {
          return "Moderate traffic";
        }
      }

      // Function to determine the color based on the traffic status
      function getTrafficStatusColor(speed_kph: number) {
        if (speed_kph < 10) {
          return "#ff5252"; // Red color for severe traffic
        } else if (speed_kph < 15) {
          return "#ff5252"; // Red color for heavy traffic
        } else if (speed_kph < 30) {
          return "orange"; // Orange for moderate traffic
        } else {
          return "green"; // Green for free-flowing traffic
        }
      }

      let alertLayer: any;

      // Fetch traffic data and create the traffic layer
      Promise.all([
        fetch("/api/trafficdata").then((response) => response.json()),
        fetch("/api/alertdata").then((response) => response.json()),
      ])
        .then(([trafficData, alertData]) => {
          // Create traffic layer but do not add it to the map
          trafficLayer = L.geoJSON(trafficData, {
            style: function (feature: {
              properties: {
                road_line: number;
                type: string;
                speed_kph: number;
              };
            }) {
              if (
                feature.properties.road_line === 1 ||
                feature.properties.type === "ROAD_CLOSED"
              ) {
                return {
                  color: "#ff0000",
                  weight: 5,
                  opacity: 1,
                  dashArray: "15, 15",
                  dashOffset: "0",
                  lineCap: "butt",
                };
              } else {
                return {
                  color: getTrafficStatusColor(feature.properties.speed_kph),
                  weight: 5,
                  opacity: 0.7,
                };
              }
            },
            onEachFeature: function (
              feature: {
                properties: {
                  delay_s: number;
                  speed_kph: number;
                  street: any;
                  length: any;
                };
              },
              layer: { bindPopup: (arg0: string) => void }
            ) {
              const delayMinutes = Math.abs(
                Number((feature.properties.delay_s / 60).toFixed(0))
              );
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
            },
          });

          // Create alert layer but do not add it to the map
          const alertMarkers = alertData.features
            .filter((alert: { properties: { type: any } }) => {
              const type = alert.properties.type;
              return type !== "JAM" && type !== "ROAD_CLOSED";
            })
            .map(
              (alert: {
                properties: {
                  type: string;
                  sub_type: string;
                  city: string;
                  street: string;
                  time: any;
                };
                geometry: { coordinates: [any, any] };
              }) => {
                let iconUrl = "assets/default.png";
                if (alert.properties.type === "ACCIDENT") {
                  iconUrl = "assets/accidente.png";
                } else if (alert.properties.type === "HAZARD") {
                  switch (alert.properties.sub_type) {
                    case "HAZARD_ON_ROAD_POT_HOLE":
                      iconUrl = "assets/hazard.png";
                      break;
                    case "HAZARD_WEATHER_FLOOD":
                      iconUrl = "assets/flood.png";
                      break;
                    default:
                      iconUrl = "assets/lucrari.png";
                      break;
                  }
                }

                const [lon, lat] = alert.geometry.coordinates;
                const alertIcon = L.icon({
                  iconUrl,
                  iconSize: [30, 30], // Icon size
                  iconAnchor: [15, 30], // Anchor point (centered horizontally, bottom of icon)
                  popupAnchor: [0, -20], // Moves the popup 20px upwards (adjust this value as needed)
                });
                const marker = L.marker([lat, lon], { icon: alertIcon });

                const alertTitle = alert.properties.sub_type
                  ? alert.properties.sub_type.replace(/_/g, " ")
                  : alert.properties.type.replace(/_/g, " ");

                marker.bindPopup(`
          <div style="font-family: 'Gotham Rounded', 'Rubik', sans-serif; font-size: 14px;">
            <strong>${alertTitle}</strong><br>
            <strong>City:</strong> ${alert.properties.city || "Unknown city"
                  }<br>
            <strong>Street:</strong> ${alert.properties.street || "Unknown street"
                  }<br>
            <strong>Time:</strong> ${alert.properties.time}
          </div>
        `);
                return marker;
              }
            );

          alertLayer = L.layerGroup(alertMarkers);
        })
        .catch((error) => console.error("Error fetching data:", error));

      // Traffic button control
      L.Control.TrafficButton = L.Control.extend({
        onmouseover: function (map: {
          hasLayer: (arg0: any) => any;
          removeLayer: (arg0: any) => void;
          addLayer: (arg0: any) => void;
        }) {
          this.map.dragging.disable();
          this.map.doubleClickZoom.disable();
        },
        onmouseout: function (map: {
          hasLayer: (arg0: any) => any;
          removeLayer: (arg0: any) => void;
          addLayer: (arg0: any) => void;
        }) {
          this.map.dragging.enable();
          this.map.doubleClickZoom.enable();
        },
        onAdd: function (map: {
          hasLayer: (arg0: any) => any;
          removeLayer: (arg0: any) => void;
          addLayer: (arg0: any) => void;
        }) {
          const container = L.DomUtil.create(
            "div",
            "leaflet-bar leaflet-control leaflet-control-custom"
          );
          container.style.backgroundImage = "url(assets/traffic.svg)";
          container.style.backgroundSize = "30px 30px";
          container.style.width = "30px";
          container.style.height = "30px";
          container.style.cursor = "pointer";
          container.style.backgroundColor = "white";

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

          // Disable click propagation and scroll propagation
          L.DomEvent.disableClickPropagation(container);
          L.DomEvent.disableScrollPropagation(container);

          return container;
        },
      });

      L.control.trafficButton = function (opts: any) {
        return new L.Control.TrafficButton(opts);
      };
      L.control.trafficButton({ position: "topright" }).addTo(this.map);

      // Do not add layers initially when the map loads

      // Do not add the layers to the map initially

      // Add the Carto Light layer by default
      cartoLightLayer.addTo(this.map);

      // Create a custom icon for markers
      const customIcon = L.icon({
        iconUrl: "assets/marker-icon.png",
        iconRetinaUrl: "assets/marker-icon-2x.png",
        shadowUrl: "assets/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      // Traffic toggle button control

      if (!this.isMobile) {
        // Add Leaflet.pm controls to the map
        (this.map as any).pm.addControls({
          position: "topright",
          drawMarker: true,
          drawPolygon: true,
          drawPolyline: true,
          drawCircle: true,
          drawCircleMarker: true,
          drawRectangle: true,
          editMode: true,
          dragMode: true,
          cutPolygon: true,
          removalMode: true,
        });

        // Handle creation of new layers
        this.map.on("pm:create", (e: any) => {
          const layer = e.layer;
          this.map.pm.addLayer(layer);
          this.saveMapData();
        });

        // Handle removal of layers
        this.map.on("pm:remove", (e: any) => {
          this.saveMapData();
        });

        // Handle the drawing start event to apply custom icon to markers
        this.map.on("pm:drawstart", (e: any) => {
          if (e.shape === "Marker") {
            this.map.pm.setGlobalOptions({
              markerStyle: {
                icon: customIcon,
              },
            });
          }
        });
      }

      // Custom toggle switch control
      L.Control.ToggleSwitch = L.Control.extend({
        onAdd: function (map: { removeLayer: (arg0: any) => void }) {
          const container = L.DomUtil.create(
            "div",
            "leaflet-bar leaflet-control leaflet-control-custom"
          );
          container.style.padding = "2px";
          container.style.display = "flex"; // Use flexbox for horizontal alignment
          container.style.alignItems = "center"; // Vertically center items
          const labelText = L.DomUtil.create("span", "", container);
          labelText.textContent = "BaseMap: ";
          // Create the checkbox input
          const checkbox = L.DomUtil.create("input", "", container);
          checkbox.type = "checkbox";
          checkbox.id = "leaflet-toggle-switch";
          checkbox.style.display = "none";
          checkbox.style.backgroundColor = "#ffffff";

          // Create the label that will act as the switch
          const label = L.DomUtil.create("label", "switch", container);
          label.htmlFor = "leaflet-toggle-switch";
          label.style.position = "relative";
          label.style.display = "inline-block";
          label.style.width = "34px";
          label.style.height = "20px";

          // Create the slider inside the label
          const slider = L.DomUtil.create("span", "slider round", label);
          slider.style.position = "absolute";
          slider.style.cursor = "pointer";
          slider.style.top = "0";
          slider.style.left = "0";
          slider.style.right = "0";
          slider.style.bottom = "0";
          slider.style.backgroundColor = "#ccc";
          slider.style.transition = ".4s";
          slider.style.borderRadius = "20px";

          // Create the slider's 'before' pseudo-element as a span
          const sliderBefore = L.DomUtil.create("span", "", slider);
          sliderBefore.style.position = "absolute";
          sliderBefore.style.height = "14px";
          sliderBefore.style.width = "14px";
          sliderBefore.style.left = "3px";
          sliderBefore.style.bottom = "3px";
          sliderBefore.style.backgroundColor = "white";
          sliderBefore.style.transition = ".4s";
          sliderBefore.style.borderRadius = "50%";

          let isCartoLightActive = true;

          checkbox.onchange = function () {
            if (checkbox.checked) {
              map.removeLayer(cartoLightLayer);
              defaultLayer.addTo(map);
              slider.style.backgroundColor = "#4CAF50"; // Green background when checked
              sliderBefore.style.transform = "translateX(14px)"; // Move the slider
            } else {
              map.removeLayer(defaultLayer);
              cartoLightLayer.addTo(map);
              slider.style.backgroundColor = "#ccc"; // Gray background when unchecked
              sliderBefore.style.transform = "translateX(0)"; // Reset the slider
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

      L.control.toggleSwitch({ position: "topright" }).addTo(this.map);

      // Load GeoJSON layers or other custom layers
      await this.loadGeoJSONLayers();
    }
  }

  private calculateAngle(previousPositions, currentPositions) {
    // Convert degrees to radians
    const toRadians = (degrees) => degrees * (Math.PI / 180);
    let lon1 = previousPositions.latitude;
    let lon2 = currentPositions.longitude;
    let lat1 = toRadians(previousPositions.latitude);
    let lat2 = toRadians(currentPositions.longitude);
    const deltaLon = toRadians(lon2 - lon1);

    const x = Math.sin(deltaLon) * Math.cos(lat2);
    const y = Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

    let bearing = Math.atan2(x, y) * (180 / Math.PI);
    bearing = (bearing + 360) % 360; // Normalize to 0-360 degrees
    return bearing;
  }

  private updateNearestBusStations(e, flyToUser = false) {

    this.currentLocation.latlng = e.latlng;
    this.currentLocationMarker = this.lc._marker;
    if ((flyToUser || !this.firstLoad) && (e.latlng.lat !== null && e.latlng.lng !== null)) {
      this.map.flyTo([e.latlng.lat, e.latlng.lng], 15);
      this.firstLoad = true;
    }
    if (this.selectedRoutesGroupLayers.length === 0 && this.nightBusRoutesLoaded === false)
      this.displayNearestBusStations([e.latlng.lat, e.latlng.lng]);
  }

  private getUserLocationAndDisplayNearbyStations(updateOnlyPosition = false, zoomLevel = 15, onlyMarkerUpdate = false): void {
    if (this.isBrowser && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          // Set the map view to the current position
          //this.map.setView([lat, lng], 15);
          // if (!onlyMarkerUpdate) this.map.flyTo([lat, lng], zoomLevel);
          // // Remove the existing marker if it exists
          // if (this.currentLocationMarker) {
          //   this.map.removeLayer(this.currentLocationMarker);
          // }

          // Define the arrow icon with the specified size
          // const arrowIcon = L.icon({
          //   iconUrl: "assets/arrow.png", // Path to your arrow.png file
          //   iconSize: [25, 25], // Size of the icon
          //   iconAnchor: [12.5, 12.5], // Anchor point to center the icon
          //   popupAnchor: [0, -12.5], // Adjust the popup anchor if needed (not used here)
          // });

          // Add the new marker with the arrow icon at the current position
          // this.currentLocationMarker = L.marker([lat, lng], {
          //   icon: arrowIcon,
          // }).addTo(this.map);

          // Now find the nearest bus stations
          if (!updateOnlyPosition) this.displayNearestBusStations([lat, lng]);
        },
        (error) => {
          console.error("Geolocation error:", error);
        },
        {
          enableHighAccuracy: true, // Enable high accuracy if available
          maximumAge: 0, // Don't use cached positions
          timeout: Infinity, // Keep watching indefinitely
        }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
    }
  }
  private nearbyStationMarkers: L.Marker[] = []; // Store markers for nearby stations

  public displayNearestBusStations(userLocation: [number, number]): void {
    if (this.stationsGeoJsonData && this.isBrowser) {
      this.oldNearbyStations = [];
      this.nearbyStations.forEach((e) => {
        this.oldNearbyStations.push(e);
      });
      //this.removeNearbyStationMarkers();
      const maxDistance = 0.5; // Adjust as needed

      //console.log('User location:', userLocation);

      for (const routeShortName in this.stationsGeoJsonData) {
        const stationFeatures = this.stationsGeoJsonData[routeShortName] || [];
        stationFeatures.forEach(
          (feature: GeoJSON.Feature<GeoJSON.GeometryObject>) => {
            let nearby_station_ids = this.nearbyStations
              .filter((e) => {
                return e.properties !== null ? e.properties["Route ID"] : null;
              })
              .map((e) => {
                return e.properties !== null ? e.properties["Route ID"] : null;
              });
            if (feature.geometry.type === "Point") {
              const pointGeometry = feature.geometry as GeoJSON.Point;
              const stationCoords: [number, number] = [
                pointGeometry.coordinates[1],
                pointGeometry.coordinates[0],
              ];
              const distance = this.calculateDistance(
                userLocation,
                stationCoords
              );

              //console.log(`Distance to ${feature.properties?.["Statie"]}: ${distance} km`);

              if (distance <= maxDistance) {
                if (
                  feature.properties !== null &&
                  !nearby_station_ids.includes(feature.properties["Route ID"])
                )
                  this.nearbyStations.push(
                    feature as GeoJSON.Feature<GeoJSON.Point>
                  );
                //console.log(`Added station ${feature.properties?.["Statie"]} within ${maxDistance} km`);
              } else {
                if (
                  feature.properties !== null &&
                  nearby_station_ids.includes(feature.properties["Route ID"])
                ) {
                  //@ts-ignore
                  //this.nearbyStations = this.nearbyStations.find(e=>{return e.properties !== null && e.properties['Route ID'] !== feature.properties['Route ID']});
                }
                //console.log(`Station ${feature.properties?.["Statie"]} is too far (${distance} km)`);
              }
            }
          }
        );
      }
      let _toRemove: GeoJSON.Feature<GeoJSON.Point>[] = [];
      this.nearbyStations.forEach((e) => {
        const pointGeometry = e.geometry as GeoJSON.Point;
        const stationCoords: [number, number] = [
          pointGeometry.coordinates[1],
          pointGeometry.coordinates[0],
        ];
        const distance = this.calculateDistance(userLocation, stationCoords);
        if (distance >= maxDistance) {
          _toRemove.push(e as GeoJSON.Feature<GeoJSON.Point>);
        }
      });
      if (_toRemove.length > 0)
        this.nearbyStations = this.nearbyStations.filter((e) => {
          //@ts-ignore
          let _toRemoveIds = _toRemove.map((x) => { return x.properties["Route ID"]; });
          if (
            e["marker"] !== undefined &&
            e.properties !== null &&
            _toRemoveIds.includes(e.properties["Route ID"])
          ) {
            this.map.removeLayer(e["marker"]);
            e["marker"].removeFrom(this.map);
          }
          return (
            e.properties !== null &&
            !_toRemoveIds.includes(e.properties["Route ID"])
          );
        });

      var newNearbyStationsIds = this.nearbyStations
        .filter((e) => {
          return e.properties !== null ? e.properties["Route ID"] : null;
        })
        .map((e) => {
          return e.properties !== null ? e.properties["Route ID"] : null;
        });
      var oldNewarbyStationsIds = this.oldNearbyStations
        .filter((e) => {
          return e.properties !== null ? e.properties["Route ID"] : null;
        })
        .map((e) => {
          return e.properties !== null ? e.properties["Route ID"] : null;
        });
      let diffStationIds = newNearbyStationsIds.filter((e) => {
        return !oldNewarbyStationsIds.includes(e);
      });
      let difference = [];
      diffStationIds.forEach((e) => {
        let _toPush = this.nearbyStations.find((x) => {
          return x.properties !== null && x.properties["Route ID"] === e;
        });
        if (_toPush !== undefined) {
          //@ts-ignore
          difference.push(_toPush);
        }
      });

      if (difference.length > 0) {
        difference.forEach((feature: GeoJSON.Feature<GeoJSON.Point>) => {
          const stationCoords: [number, number] = [
            feature.geometry.coordinates[1],
            feature.geometry.coordinates[0],
          ];
          const stationIcon = L.icon({
            iconUrl: "assets/statie_autobuz.png",
            iconSize: [30, 30], // Adjust size
            iconAnchor: [15, 30], // Adjust anchor point
            popupAnchor: [0, -30], // Adjust popup anchor
          });

          // Format Linii Comune without Linia/sens
          const liniiComuneFormatted = feature.properties?.["Linii Comune"]
            ? `<strong>Linii Comune:</strong> ${feature.properties[
              "Linii Comune"
            ]
              .split(", ")
              .map((line: string) => {
                return `<span style="background-color: ${this.determineBoxColor(
                  line
                )}; color: black; padding: 2px 4px; border-radius: 3px;">${line}</span>`;
              })
              .join(", ")}<br>`
            : "";

          // Construct the popup content without Linia/sens
          const popupContent = `
                    <div>
                        <strong>Cod Statie:</strong> ${feature.properties?.["Cod Statie"] ?? "N/A"
            }<br>
                        <strong>Statie:</strong> ${feature.properties?.["Statie"] ?? "N/A"
            }<br>
                        ${liniiComuneFormatted}
                        <strong>Mod Transp:</strong> ${feature.properties?.["Mod Transp"] ?? "N/A"
            }<br>
                        <strong>Linii :</strong><br>
                        <em>Loading arrival data...</em>
                    </div>
                `;

          const marker = L.marker(stationCoords, { icon: stationIcon })
            .bindPopup(popupContent)
            .addTo(this.map)
            .on("click", () => {
              // Fetch and display the next arrival data
              this.loadArrivalData(marker, feature.properties, false); // Pass an argument to indicate whether to include Linia/sens
            });
          for (let i = 0; i < this.nearbyStations.length; i++) {
            //@ts-ignore
            if (this.nearbyStations[i].properties["Route ID"] === feature.properties["Route ID"]) {
              this.nearbyStations[i]["marker"] = marker;
            }
          }
          this.currentStationMarkers.push(marker);
          this.nearbyStationMarkers.push(marker); // Store marker for removal later
        });
      } else {
        console.warn("No nearby stations found.");
      }
    } else {
      console.warn("No stations data available or not in browser environment.");
    }
  }

  // Utility function to calculate the distance between two coordinates
  private calculateDistance(
    coord1: [number, number],
    coord2: [number, number]
  ): number {
    const [lat1, lon1] = coord1;
    const [lat2, lon2] = coord2;

    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const d = R * c; // in metres
    const distanceKm = d / 1000; // Convert to kilometers

    //console.log(`Distance between ${coord1} and ${coord2}: ${distanceKm} km`); // Add this line

    return distanceKm;
  }

  private async loadRouteDetails() {
    try {
      const data = await this.excelReaderService.readExcelFromAssets(
        "assets/route_data.xlsx"
      );
      //console.log('Excel Data:', data); // Debugging log

      data.forEach((route) => {
        const rawRouteId = String(route.route_id);
        let routeId: number;

        // Check if the route_id starts with "PV" and handle it
        if (rawRouteId.startsWith("PV")) {
          // Extract the numeric portion after the underscore, ignoring any trailing characters
          const routeIdMatch = rawRouteId.match(/_(\d+)/);
          routeId = routeIdMatch ? parseInt(routeIdMatch[1]) : NaN;
        } else {
          // Directly convert route_id to a number for non-PV values
          routeId = parseInt(rawRouteId);
        }

        //console.log('Processing route_id:', rawRouteId, 'Converted to:', routeId); // Debugging log

        if (!isNaN(routeId)) {
          this.routeMap.set(routeId, route.route_short_name.toString());
        } else {
          console.warn("Invalid route_id detected:", rawRouteId); // Warn about invalid route_id
        }
      });

      //console.log('Route Map:', this.routeMap); // Debugging log

      this.routeDetails = data
        .map((route) => {
          const rawRouteId = String(route.route_id);
          let routeId: number;

          // Apply the same logic to ensure consistency
          if (rawRouteId.startsWith("PV")) {
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
            routeType: routeType, // Set routeType based on the logic above
          };
        })
        .filter((route) => !isNaN(route.routeId)); // Filter out any invalid route IDs

      // Sort the route details by shortName
      this.routeDetails.sort(
        (a, b) => parseInt(a.shortName) - parseInt(b.shortName)
      );
      this.filteredRouteDetails = this.routeDetails;
    } catch (error) {
      console.error("Error reading Excel file:", error);
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
      const geoJsonData = await this.dataLoader.loadGeoJSON(
        "./data/layers/routes_iun2024.geojson"
      );
      geoJsonData.features.forEach((feature: any) => {
        const routeName = feature.properties.route_name;
        if (!this.routeGeoJsonData[routeName]) {
          this.routeGeoJsonData[routeName] = [];
        }
        this.routeGeoJsonData[routeName].push(feature);
      });
      //console.log('Loaded and filtered GeoJSON data:', this.routeGeoJsonData); // Debugging log
    } catch (error) {
      console.error("Error loading routes GeoJSON:", error);
    }
  }

  private async loadStationsGeoJSON() {
    try {
      const geoJsonData = await this.dataLoader.loadGeoJSON(
        "./data/layers/Statii_Transport_Public_Suprafata.geojson"
      );
      //console.log('Raw GeoJSON Data:', geoJsonData); // Debugging log

      geoJsonData.features.forEach((feature: any) => {
        //console.log('Processing feature:', feature); // Debugging log

        // Validate and sanitize the feature properties
        if (
          isNaN(feature.geometry.coordinates[0]) ||
          isNaN(feature.geometry.coordinates[1])
        ) {
          console.warn("Invalid coordinates:", feature.geometry.coordinates);
          return; // Skip invalid features
        }

        const line = feature.properties["Linia/sens"];
        if (!line) {
          console.warn("Invalid Linia/sens:", line);
          return; // Skip features without Linia/sens
        }

        // Check if the Route ID starts with "PV" and handle it
        let routeIdString = feature.properties["Route ID"];
        //onsole.log('Original Route ID:', routeIdString); // Debugging log

        if (routeIdString.startsWith("PV")) {
          // Remove the "PV" prefix and the underscore, then parse the number
          routeIdString = routeIdString.split("_")[1];
        }

        //console.log('Processed Route ID String:', routeIdString); // Debugging log

        const routeId = parseInt(routeIdString);
        //console.log('Parsed Route ID:', routeId); // Debugging log

        if (isNaN(routeId)) {
          console.warn("Invalid Route ID after parsing:", routeIdString);
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

      //console.log('Loaded and filtered Stations GeoJSON data:', this.stationsGeoJsonData); // Debugging log
    } catch (error) {
      console.error("Error loading stations GeoJSON:", error);
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
          opacity: 1,
        },
        onEachFeature: (feature, layer) => {
          // Add popup content

          // @ts-ignore
          this.addPopupContent(layer, routeShortName, "#3388ff", 1);
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
        },
      }).addTo(this.map);

      this.routeLayers.set(routeId, routeLayer);
      this.loadStationMarkers(routeShortName, routeId);
      //console.log("Route id is:", routeId);
    }
  }

  private loadStationMarkers(routeShortName: string, routeId: number) {
    //console.log('Loading station markers for:', {routeShortName, routeId});
    if (this.stationsGeoJsonData && this.isBrowser) {
      //console.log('Route Short Name:', routeShortName);
      //console.log('GeoJSON Data:', this.stationsGeoJsonData[routeShortName]);

      const stationFeatures = this.stationsGeoJsonData[routeShortName] || [];
      const markers: any[] = [];

      // Determine if the device is mobile
      const isMobile = window.innerWidth <= 768;

      stationFeatures.forEach((feature: any) => {
        const { coordinates } = feature.geometry;
        const { properties } = feature;

        //console.log('Route ID in properties:', properties["Route ID"]);
        //console.log('Comparing with routeId:', routeId);

        if (parseInt(properties["Route ID"]) === routeId) {
          let iconUrl = "assets/statie_autobuz.png";

          if (properties["Mod Transp"] === "TRAM") {
            iconUrl = "assets/statie_tramvai.png";
          } else if (properties["Mod Transp"] === "Metrou") {
            iconUrl = "assets/statie_metrou.png";
          }

          const stationIcon = L.icon({
            iconUrl,
            iconSize: isMobile ? [25, 25] : [30, 30], // Adjust size based on device
            iconAnchor: isMobile ? [15, 25] : [15, 30], // Adjust anchor point
            popupAnchor: isMobile ? [0, -20] : [0, -30], // Adjust popup anchor
          });

          const determineBoxColor = (routeShortName: string) => {
            if (routeShortName.startsWith("M")) {
              return "black";
            } else if (routeShortName.startsWith("N")) {
              return "darkblue";
            } else {
              const routeNumber = parseInt(routeShortName);
              if (routeNumber >= 1 && routeNumber <= 55) {
                return "#BE1622";
              } else if (routeNumber >= 56 && routeNumber <= 99) {
                return "#008D36";
              } else if (routeNumber >= 100 && routeNumber <= 400) {
                return "#1D71B8";
              } else if (routeNumber >= 400 && routeNumber <= 999) {
                return "#662483";
              }
            }
            return "yellow"; // Fallback color
          };

          const formatLiniiComune = (liniiComune: string) => {
            return liniiComune
              .split(", ")
              .map((line) => {
                const boxColor = determineBoxColor(line);
                return `<span style="background-color: ${boxColor}; color: black; padding: 2px 4px; border-radius: 3px;">${line}</span>`;
              })
              .join(", ");
          };

          const liniiConexe = properties["Linii Comune"]
            ? `<strong>Linii Comune:</strong> <span style="color: black;">${formatLiniiComune(
              properties["Linii Comune"]
            )}</span><br>`
            : "";

          const selectedRouteColor = determineBoxColor(routeShortName);

          const artera =
            properties["Mod Transp"] !== "Metrou"
              ? `<strong>Artera:</strong> ${properties["Artera"]}<br>`
              : "";

          // Set up the marker with a basic popup, and lazy-load the arrival data
          // @ts-ignore
          const marker = L.marker([coordinates[1], coordinates[0]], {
            icon: stationIcon,
            //@ts-ignore
            transportation_mode: properties["Mod Transp"]
          })
            .bindPopup(
              `
                        <div>
                            <strong>Cod Statie:</strong> ${properties["Cod Statie"]}<br>
                            <strong>Statie:</strong> ${properties["Statie"]}<br>
                            <strong>Linie/Sens:</strong> <span style="background-color: ${selectedRouteColor}; color: white; padding: 2px 4px; border-radius: 3px;">${routeShortName}</span><br>
                            ${liniiConexe}
                            ${artera}
                            <strong>Mod Transp:</strong> ${properties["Mod Transp"]}<br>
                            <em>Loading arrival data...</em>
                        </div>
                    `
            )
            .on("click", () => this.loadArrivalData(marker, properties, true));

          markers.push(marker);
          marker.addTo(this.map);
        }
      });

      if (markers.length > 0) {
        this.stationMarkers.set(routeId, markers);
      } else {
        console.warn(
          `No markers found for routeShortName: ${routeShortName} and routeId: ${routeId}`
        );
      }
    } else {
      console.warn("No station data available or not in browser environment.");
    }
  }

  private loadArrivalData(
    marker: L.Marker,
    properties: any,
    includeLiniaSens: boolean
  ): void {
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

            const nextArrivals =
              filteredArrivals
                .map((line: any) => {
                  let arrivingTimeText: string;
                  const arrivingTimeInMinutes = Math.floor(
                    line.arrivingTime / 60
                  );

                  if (arrivingTimeInMinutes === 0) {
                    arrivingTimeText =
                      '<span style="color: white; font-weight: bold;">În Stație</span>';
                  } else if (arrivingTimeInMinutes < 1) {
                    arrivingTimeText =
                      '<span style="color: white; font-weight: bold;"> <1 min</span>';
                  } else if (arrivingTimeInMinutes >= 60) {
                    const hours = Math.floor(arrivingTimeInMinutes / 60);
                    const minutes = arrivingTimeInMinutes % 60;
                    arrivingTimeText = `<span style="color: white; font-weight: bold;">${hours} oră${hours > 1 ? " și" : ""
                      } ${minutes} min</span>`;
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
                })
                .join("") || "No arrivals";

            // If there are no valid arrivals, remove the marker and stop updating
            if (nextArrivals === "No arrivals") {
              //this.map.removeLayer(marker);

              //return;
            }

            // Construct the popup content
            let popupContent = `
                        <div>
                            <strong>Cod Statie:</strong> ${properties["Cod Statie"]}<br>
                            <strong>Statie:</strong> ${properties["Statie"]}<br>
                    `;

            if (includeLiniaSens) {
              const linieSensColor = this.determineBoxColor(
                properties["Linia/sens"]
              );
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
            console.error("Expected an array of lines but received:", response);
          }
        },
        (error) => {
          // In case of an error, remove the marker and log the error
          this.map.removeLayer(marker);
          console.error("Error fetching next arrivals:", error);
        }
      );
    };
    updateArrivalData();
    const intervalId = setInterval(updateArrivalData, 30000);
    marker.on("popupclose", () => {
      clearInterval(intervalId);
    });
  }

  private determineBoxColor(routeShortName: string): string {
    if (routeShortName.startsWith("M")) {
      return "black";
    } else if (routeShortName.startsWith("N")) {
      return "darkblue";
    } else {
      const routeNumber = parseInt(routeShortName);
      if (routeNumber >= 1 && routeNumber <= 55) {
        return "#BE1622";
      } else if (routeNumber >= 56 && routeNumber <= 99) {
        return "#008D36";
      } else if (routeNumber >= 100 && routeNumber <= 400) {
        return "#1D71B8";
      } else if (routeNumber >= 400 && routeNumber <= 500) {
        return "#662483";
      }
    }
    return "yellow"; // Fallback color
  }

  private addPopupContent(
    layer: any,
    properties: any,
    isMultiLineString: boolean
  ) {
    const popupContent = document.createElement("div");

    // Display route information in the popup
    for (const key in properties) {
      if (properties.hasOwnProperty(key)) {
        const propertyDiv = document.createElement("div");
        propertyDiv.innerHTML = `<strong>${key}:</strong> ${properties[key]}`;
        popupContent.appendChild(propertyDiv);
      }
    }

    // Only add style controls for multilines or polylines
    if (isMultiLineString) {
      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.value = "#3388ff";
      colorInput.onchange = (e) =>
        this.changeLayerStyle(
          layer,
          "color",
          (e.target as HTMLInputElement).value
        );

      const weightInput = document.createElement("input");
      weightInput.type = "range";
      weightInput.min = "1";
      weightInput.max = "10";
      weightInput.step = "1";
      weightInput.value = "3";
      weightInput.oninput = (e) =>
        this.changeLayerStyle(
          layer,
          "weight",
          parseFloat((e.target as HTMLInputElement).value)
        );

      const opacityInput = document.createElement("input");
      opacityInput.type = "range";
      opacityInput.min = "0.1";
      opacityInput.max = "1";
      opacityInput.step = "0.1";
      opacityInput.value = "1";
      opacityInput.oninput = (e) =>
        this.changeLayerStyle(
          layer,
          "opacity",
          parseFloat((e.target as HTMLInputElement).value)
        );

      // Dash pattern input
      const dashInput = document.createElement("input");
      dashInput.type = "text";
      dashInput.placeholder = "e.g., 10,5"; // Dash pattern: 10px line, 5px gap
      dashInput.oninput = (e) =>
        this.changeLayerStyle(
          layer,
          "dashArray",
          (e.target as HTMLInputElement).value
        );

      // Labels for inputs
      const labelColor = document.createElement("label");
      labelColor.innerText = "Color: ";
      labelColor.appendChild(colorInput);

      const labelWeight = document.createElement("label");
      labelWeight.innerText = "Weight: ";
      labelWeight.appendChild(weightInput);

      const labelOpacity = document.createElement("label");
      labelOpacity.innerText = "Opacity: ";
      labelOpacity.appendChild(opacityInput);

      const labelDash = document.createElement("label");
      labelDash.innerText = "Dash Pattern: ";
      labelDash.appendChild(dashInput);

      // Add inputs to the popup
      popupContent.appendChild(document.createElement("br"));
      popupContent.appendChild(labelColor);
      popupContent.appendChild(document.createElement("br"));
      popupContent.appendChild(labelWeight);
      popupContent.appendChild(document.createElement("br"));
      popupContent.appendChild(labelOpacity);
      popupContent.appendChild(document.createElement("br"));
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
      this.filteredRouteDetails = Array.from(this.routeMap.entries()).map(
        ([routeId, shortName]) => {
          return {
            routeId: routeId,
            shortName: shortName,
            routeType:
              this.routeDetails.find((r) => r.routeId === routeId)?.routeType ||
              null,
          };
        }
      );

      // Fetch bus data and update filteredRouteDetails accordingly
      this.busDataService.getBusData().subscribe(
        (data) => {
          const activeRoutes = new Set<number>();

          data.forEach((bus: any) => {
            let routeId;
            if (bus.vehicle !== undefined && bus.vehicle.trip !== undefined && bus.vehicle.trip.routeId !== undefined && bus.vehicle.trip.routeId.startsWith("PV")) {
              const routeIdMatch = bus.vehicle.trip.routeId.match(/_(\d+)/);
              routeId = routeIdMatch ? parseInt(routeIdMatch[1]) : NaN;
            } else {
              routeId = parseInt(bus.vehicle.trip.routeId);
            }
            activeRoutes.add(routeId);
          });

          // Update routeTypes for active routes
          this.filteredRouteDetails = this.filteredRouteDetails.map((route) => {
            if (activeRoutes.has(route.routeId)) {
              return {
                ...route,
                active: true,
              };
            } else {
              return {
                ...route,
                active: false,
              };
            }
          });

          this.filteredRouteDetails.sort(
            (a, b) => parseInt(a.shortName) - parseInt(b.shortName)
          );
        },
        (error) => {
          console.error("Error fetching GTFS data:", error);
        }
      );
    }
  }

  private loadPassengerData(): void {
    this.busPassengerService.getPassengerData().subscribe(
      (data) => {
        this.passengerData = data.map(e => {
          let temp = {};
          let occupation_percent = (e.capacity !== 0 ? (e.people_on_board / e.capacity) * 100 : 0);
          //@ts-ignore
          temp.id = e.vehicle_id;
          //@ts-ignore
          temp.on_board = e.capacity !== 0 ? e.people_on_board + "/" + e.capacity : e.people_on_board;
          //@ts-ignore
          temp.occupation_percent = e.capacity !== 0 ? occupation_percent.toFixed(0) + "%" : "-";
          return temp;
        });
        //console.log('Loaded passenger data:', this.passengerData);
      },
      (error) => {
        console.error("Error fetching passenger data:", error);
      }
    );
  }

  private loadBusData(): void {
    if (this.isBrowser) {
      this.busDataService.getBusData().subscribe(
        (data) => {
          this.updateBusMarkers(data);
        },
        (error) => {
          console.error("Error fetching bus data:", error);
        }
      );
    }
  }

  addGeoJsonLayer(geoJsonData: any): void {
    const layer = L.geoJSON(geoJsonData, {
      pointToLayer: (feature, latlng) => {
        const customIcon = L.icon({
          iconUrl: "assets/marker-icon.png",
          shadowUrl: "assets/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });
        return L.marker(latlng, { icon: customIcon });
      },
      onEachFeature: (feature, layer) => {
        let popupContent = "<div>";
        for (const key in feature.properties) {
          popupContent += `<strong>${key}:</strong> ${feature.properties[key]}<br>`;
        }
        if (feature.geometry.type === "MultiLineString") {
          popupContent +=
            '<br><label>Color: <input type="color" value="#3388ff" onchange="changeLayerStyle(layer, \'color\', this.value)"></label>';
          popupContent +=
            '<br><label>Weight: <input type="range" min="1" max="10" step="1" value="3" oninput="changeLayerStyle(layer, \'weight\', this.value)"></label>';
          popupContent +=
            '<br><label>Opacity: <input type="range" min="0.1" max="1" step="0.1" value="1" oninput="changeLayerStyle(layer, \'opacity\', this.value)"></label>';
        }
        popupContent += "</div>";
        layer.bindPopup(popupContent);
      },
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
      this.uploadedGeoJsonFiles.push({
        layer: undefined,
        name: file.name,
        data: geoJsonData,
      });
    };

    reader.readAsText(file);
  }

  addUploadedGeoJsonToMap(fileData: any): void {
    const layer = L.geoJSON(fileData.data, {
      pointToLayer: (feature, latlng) => {
        const customIcon = L.icon({
          iconUrl: "assets/marker-icon.png",
          shadowUrl: "assets/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });
        return L.marker(latlng, { icon: customIcon });
      },
      onEachFeature: (feature, layer) => {
        this.addPopupContent(
          layer,
          feature.properties,
          feature.geometry.type === "MultiLineString" ||
          feature.geometry.type === "LineString"
        );
      },
    }).addTo(this.map);

    this.uploadedGeoJsonLayers.push(layer);
  }

  saveGeoJsonToDatabase(): void {
    const userId = this.userId; // Assume you have this.userId set after login
    if (!userId) {
      alert("Please log in first.");
      return;
    }

    const geoJsonData = this.uploadedGeoJsonFiles.map((file) => file.data);
    this.http.post("/api/saveGeoJson", { userId, geoJsonData }).subscribe(
      (response: any) => {
        alert("GeoJSON data saved successfully.");
      },
      (error: any) => {
        console.error("Error saving GeoJSON data:", error);
      }
    );
  }

  triggerFileUpload(): void {
    const fileInput = document.getElementById(
      "uploadGeoJSON"
    ) as HTMLInputElement;
    fileInput.click();
  }

  private updateBusMarkers(
    data: any,
    isStationSpecific: boolean = false
  ): void {
    if (this.isBrowser) {
      //console.log('Updating bus markers for selected routes:', this.selectedRoutes);
      let isTram: boolean = false;

      const busIcon = L.icon({
        iconUrl: isStationSpecific
          ? "assets/bus-rt.svg.png"
          : "assets/Bus-logo.svg.png",
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15],
      });
      const tramIcon = L.icon({
        iconUrl: "assets/tram.png",
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15],
      });

      const markersToUpdate = new Map<number, L.Marker[]>();

      // Check if the user is a guest
      const isGuest = localStorage.getItem("guestSession") === "true";
      let temp_markers = [];
      if (data && Array.isArray(data)) {
        data.forEach((bus) => {
          let routeId;
          let isPV = false;
          if (bus.vehicle.trip.routeId.startsWith("PV")) {
            const routeIdMatch = bus.vehicle.trip.routeId.match(/_(\d+)/);
            routeId = routeIdMatch ? parseInt(routeIdMatch[1]) : NaN;
            isPV = true;
          } else {
            routeId = parseInt(bus.vehicle.trip.routeId);
          }

          const routeShortName = this.routeMap.get(routeId) || "Unknown";
          // Skip buses with an unknown routeShortName
          if (routeShortName === "Unknown") {
            return; // Skip this iteration
          }

          if (this.selectedRoutes.includes(routeId) || isStationSpecific) {
            const position = bus.vehicle.position;
            const vehicleId = isPV
              ? bus.id.toString()
              : bus.vehicle.vehicle.id.toString();
            const tId = this.getTId(parseInt(vehicleId));
            const passengerData = this.passengerData.find(e => { return e.id === tId?.toString(); });
            const passengerCount = this.passengerData.length === 0 ? "Lipsă comunicație" : (passengerData ? passengerData.on_board : 'Senzor inexistent.');
            const passengerOccupationPercent = this.passengerData.length === 0 ? "Lipsă comunicație" : (passengerData ? passengerData.occupation_percent : 'Senzor inexistent.');
            const directionId = bus.vehicle.trip.directionId;
            const capatName = this.getCapatName(routeId, directionId);
            let marker = this.busMarkers.find(
              (m) =>
                m.options.routeId === routeId &&
                m.options.vehicleId === vehicleId
            );
            //@ts-ignore
            temp_markers.push({ vehicleId: vehicleId, position: position });
            if (!marker) {
              //check if marker is tram or bus
              console.log(this.stationMarkers);
              let is_tram = false;
              this.stationMarkers.get(routeId)?.forEach((marker: any) => {
                is_tram = marker.options.transportation_mode === "TRAM";
              });
              marker = L.marker([position.latitude, position.longitude], {
                icon: is_tram ? tramIcon : busIcon,
              }).addTo(this.map);
              if (isStationSpecific) {
                this.stationBusMarkers.push(marker); // Keep track of station-specific markers
              } else {
                this.busMarkers.push(marker);
              }
            } else {
              marker.setLatLng([position.latitude, position.longitude]);
            }
            //Search previous positions
            let previous_positions = this.lastBusPositions.find(e => { return e.vehicleId === vehicleId });
            if (previous_positions !== null && previous_positions !== undefined) {
              // let bearing = this.calculateAngle(previous_positions.position,position);
              // marker._icon.style.WebkitTransform = marker._icon.style.WebkitTransform + ' rotate(' + bearing + 'deg)';
              // marker._icon.style.MozTransform = 'rotate(' + bearing + 'deg)';
              //marker.getElement().style.transform = `rotate(${bearing}deg)`;
            }
            let popupContent = `
            <div>
              ${!isGuest && tId ? `<strong>T ID:</strong> ${tId}<br>` : ""}
              ${!isGuest ? `<strong>Vehicle ID:</strong> ${vehicleId}<br>` : ""}
             ${!isGuest
                ? `<strong>License Plate:</strong> ${bus.vehicle.vehicle.licensePlate}<br>`
                : ""
              }
              ${!isGuest ? `<strong>Route ID:</strong>(${routeId})<br>` : ""}
              <strong>Linia: </strong>${routeShortName} <br>
              <strong>Direction:</strong> ${capatName}<br>
              <strong>Număr Pasageri:</strong> ${passengerCount}<br>
              <strong>Grad de încărcare:</strong> ${passengerOccupationPercent}<br>
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



      this.lastBusPositions = temp_markers;

      if (!isStationSpecific) {
        // Disable automatic zoom only if this is not a station-specific update
        this.map.options.zoomControl = false;
        this.map.options.doubleClickZoom = false;
        this.map.options.scrollWheelZoom = false;
      }

      // Remove markers that are no longer needed
      this.busMarkers = this.busMarkers.filter((marker) => {
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
          //console.log(`Match found for Route ID: ${routeIdStr} with Direction ID: ${directionId}`);
          return feature.properties["Capat"] || "Unknown";
        }
      }
    }

    // If no matching Capat is found
    console.warn(
      `No matching Capat found for Route ID: ${routeIdStr} with Direction ID: ${directionId}.`
    );
    return "Unknown";
  }

  private returnColorBasedOnProperty(featureName, baseColor) {
    let bgColor = "#3398ff";
    if (featureName !== undefined) {
      switch (featureName) {
        case "M1":
          bgColor = "#FCB900";
          break;
        case "M2":
          bgColor = "#24478E";
          break;
        case "M4":
          bgColor = "#046A3A";
          break;
        case "M3":
          bgColor = "#DF131A";
          break;
        case "M5":
          bgColor = "#FDB800";
          break;
        case "M5 Prelungire Domnesti":
          bgColor = "#FDB800";
          break;
        case "M3 Prelungire-Pacii-A1":
          bgColor = "#DF131A";
          break;
        case "M3 LinieTehnica-DepouPreciziei-CenturaCF":
          bgColor = "#DF131A";
          break;
        case "M2 LinieTehnica-CenturaCF":
          bgColor = "#24478E";
          break;
        case "M3 Prelungire Saligny-CenturaCF":
          bgColor = "#DF131A";
          break;
        case "M4 Prelungire-Straulesti-Mogosoaia":
          bgColor = "#046A3A";
          break;
        case "M2 Prelungire-Pipera CenturaCF":
          bgColor = "#24478E";
          break;
        case "M5 Eroilor-Pantelimon":
          bgColor = "#FDB800";
          break;
        case "M5-M1 Prelungire Pantelimon-CenturaCf":
          bgColor = "#FDB800";
          break;
        case "M6":
          bgColor = "#A7939C";
          break;
        case "Prelungire M3 Osiei":
          bgColor = "#DF131A";
          break;
        case "M6":
          bgColor = "#A7939C";
          break;
        case "Prelungire M3 Osiei":
          bgColor = "#DF131A";
          break;
        case "M3 Prelungire Latin":
          bgColor = "#DF131A";
          break;
        case "Propunere M7":
          bgColor = "#401061";
          break;
        case "Propunere M8":
          bgColor = "#484848";
          break;
        case "M4 Gara de Nord-Progresul":
          bgColor = "#046A3A";
          break;
      }
    }
    return bgColor;
  }

  private async loadGeoJSONLayers() {
    if (this.isBrowser) {
      try {
        this.layerConfigs = await this.dataLoader.loadCSV(
          "/data/layers/conf.csv"
        );
        this.layerConfigs = this.layerConfigs.filter(
          (config) => config.file && config.overlayName
        );
        console.log("Loaded layer configurations:", this.layerConfigs);

        const { default: L } = await import("leaflet");

        let selectedLayer: L.Path | null = null;

        for (const config of this.layerConfigs) {
          const geojson = await this.dataLoader.loadGeoJSON(
            `/data/layers/${config.file}`
          );

          const customIcon =
            this.iconMapping[config.file] ||
            L.icon({
              iconUrl: "assets/marker-icon.png",
              iconRetinaUrl: "assets/marker-icon-2x.png",
              shadowUrl: "assets/marker-shadow.png",
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41],
            });

          const layer = L.geoJSON(geojson, {
            pointToLayer: (feature, latlng) =>
              L.marker(latlng, { icon: customIcon }),
            style: (feature) => {
              // @ts-ignore
              if (feature.geometry.type !== "Point") {
                return {
                  //@ts-ignore
                  color: this.returnColorBasedOnProperty(feature?.properties.magistrala, config.fillColor),
                  weight: config.strokeWeight,
                  fillColor: config.fillColor,
                  fillOpacity: config.opacity,
                };
              }
              return {};
            },
            onEachFeature: (feature, featureLayer) => {
              // Cast featureLayer to L.Path to access setStyle method
              const pathLayer = featureLayer as L.Path;
              //excluded_features_from_layer
              let currentGeoJsonName = config.file.split(".")[0];
              let currentGeoJsonExcludedProperties =
                this.excluded_features_from_layer.find((e) => {
                  return e.layer_name === currentGeoJsonName;
                });
              let popupContent = `<div class="popup-content-wrapper"><h3>${config.overlayName}</h3>`;
              const properties = Object.entries(feature.properties);
              if (currentGeoJsonExcludedProperties === undefined) {
                properties.forEach(([key, value]) => {
                  popupContent += `<div><strong>${key}</strong>: ${value}</div>`;
                });
                popupContent += `</div>`;
                pathLayer.bindPopup(popupContent);
              } else if (!currentGeoJsonExcludedProperties.exclude_all) {
                properties.forEach(([key, value]) => {
                  if (
                    !currentGeoJsonExcludedProperties.excluded_properties.includes(
                      key
                    )
                  )
                    popupContent += `<div><strong>${key}</strong>: ${value}</div>`;
                });
                popupContent += `</div>`;
                pathLayer.bindPopup(popupContent);
              }
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
                    //@ts-ignore
                    color: this.returnColorBasedOnProperty(pathLayer?.feature.properties.magistrala, (pathLayer.options as any).originalColor),
                  });
                }
              });

              pathLayer.on("click", () => {
                if (selectedLayer && selectedLayer !== pathLayer) {
                  selectedLayer.setStyle({
                    //@ts-ignore
                    color: this.returnColorBasedOnProperty(pathLayer?.feature.properties.magistrala, (selectedLayer.options as any).originalColor),
                  });
                }

                pathLayer.setStyle({
                  color: "yellow",
                });

                selectedLayer = pathLayer;
              });

              // Store the original color in the options
              (pathLayer.options as any).originalColor = config.strokeColor;
            },
          });

          this.layersControl[config.overlayName] = layer;

          if (geojson.features.some((feature: any) => feature.geometry.type === "Point")) {
            this.pointLayers.add(config.overlayName);
          }
        }

        //console.log('Point layers:', this.pointLayers);
      } catch (error) {
        console.error("Error loading GeoJSON layers:", error);
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

  clearAllSelections(onlyClear = false) {
    // Remove all layers and markers from the map
    this.map.eachLayer((layer: any) => {
      if ((layer instanceof L.GeoJSON || layer instanceof L.Marker) && (layer !== this.currentLocationMarker || onlyClear)) {
        this.map.removeLayer(layer);
      }
    });

    // Reset selections and markers
    this.selectedRoutes = [];
    this.selectedRouteShortNames = [];
    this.busMarkers = [];
    this.currentStationMarkers = [];
    this.currentRouteLayer = null;
    this.selectedRoutesGroup.clearLayers();
    this.selectedRoutesGroupLayers = [];

    if (this.currentLocation.latlng.lng !== null && this.currentLocation.latlng.lat !== null) {
      this.updateNearestBusStations(this.currentLocation, true);
    }
  }

  clearAllSelectionAndRestartFollowing(onlyClear = false) {
    this.clearAllSelections(onlyClear);
    this.lc.stop;
    this.lc.start;
    if (this.currentLocationMarker !== undefined) {
      this.currentLocationMarker?.addTo(this.map);
    }
  }

  changeLayerColor(layerName: string, event: Event) {
    if (this.isBrowser) {
      const input = event.target as HTMLInputElement;
      const newColor = input.value;
      const layer = this.layersControl[layerName];
      layer.eachLayer((layer: any) => {
        if (layer.feature.geometry.type !== "Point") {
          layer.setStyle({ color: newColor, fillColor: newColor });
        }
      });
      this.saveMapData();
    }
  }

  changeLayerWeight(layerName: string, event: Event) {
    if (this.isBrowser) {
      const input = event.target as HTMLInputElement;
      let newWeight = Math.round(parseFloat(input.value));
      newWeight = Math.min(Math.max(newWeight, 1), 10);

      const layer = this.layersControl[layerName];
      layer.eachLayer((layer: any) => {
        if (layer.feature.geometry.type !== "Point") {
          layer.setStyle({ weight: newWeight });
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
    this.filteredRouteDetails = this.routeDetails.filter(
      (route) =>
        route.shortName.toLowerCase().includes(searchTerm) &&
        route.shortName !== "Unknown"
    );
  }

  filterByType(routeType: number) {
    this.selectedRouteType = routeType;
    this.filteredRouteDetails = this.routeDetails.filter(
      (route) => route.routeType === routeType
    );
  }

  selectRoute(routeId: number) {
    //this.selectedRoutesGroup = new L.FeatureGroup();
    const routeShortName = this.routeMap.get(routeId) || "Unknown";
    const routeIndex = this.selectedRoutes.indexOf(routeId);
    const routeColors = ["blue", "brown", "black", "red", "#4EFFEF"]; // Define route colors here

    // Remove nearby station markers
    this.removeNearbyStationMarkers();

    if (this.isMobile) {
      this.showGtfsMenu = false; // Close the GTFS RealTime menu
    }

    // If the route is already selected (deselecting)
    if (routeIndex > -1) {
      // Remove the route from the selected arrays
      this.selectedRoutes.splice(routeIndex, 1);
      this.selectedRouteShortNames.splice(routeIndex, 1);

      // Remove the route layer from the map
      if (this.routeLayers.has(routeId)) {
        this.map.removeLayer(this.routeLayers.get(routeId));
        this.routeLayers.delete(routeId);
      }

      // Remove the station markers for this route
      if (this.stationMarkers.has(routeId)) {
        this.stationMarkers.get(routeId)?.forEach((marker: any) => {
          this.map.removeLayer(marker);
        });
        this.stationMarkers.delete(routeId);
      }

      // Remove any bus markers associated with this route
      this.removeBusMarkers(routeId);
      let layersToRemove = this.selectedRoutesGroupLayers.filter((e) => {
        return e.shortName === routeShortName;
      });
      layersToRemove.forEach((e) => {
        this.selectedRoutesGroup.removeLayer(e.layer);
        this.selectedRoutesGroupLayers = this.selectedRoutesGroupLayers.filter(
          (e) => {
            return e.shortName !== routeShortName;
          }
        );
      });
    } else {
      // If less than 5 routes are selected, allow the user to select another route
      if (this.selectedRoutes.length < 5) {
        // Select the route and store its details
        this.selectedRoutes.push(routeId);
        this.selectedRouteShortNames.push(routeShortName);
        const _routeFeatures = this.routeGeoJsonData[routeShortName] || [];
        const _routeLayer = L.geoJSON(_routeFeatures);
        this.selectedRoutesGroup.addLayer(_routeLayer);
        this.selectedRoutesGroupLayers.push({
          layer: _routeLayer,
          shortName: routeShortName,
        });
        // Assign a color based on the number of selected routes
        const color = routeColors[this.selectedRoutes.length - 1];

        // Load the route with the assigned color
        this.loadRouteLayer(routeShortName, routeId, color);

        // Optionally load real-time bus data for the route
        this.loadBusData();
      } else {
        // Show a message if the user tries to select more than 5 routes
        this.snackBar.open(
          "You can only select up to 5 routes at a time",
          "Close",
          {
            duration: 3000,
          }
        );
      }
    }
    if (this.selectedRoutesGroupLayers.length > 0) {
      this.map.flyToBounds(this.selectedRoutesGroup.getBounds());
    } else {
      this.updateNearestBusStations(this.currentLocation, true);
    }
  }

  private removeNearbyStationMarkers(): void {
    this.nearbyStationMarkers.forEach((marker) => {
      this.map.removeLayer(marker);
    });
    this.nearbyStations = [];
    this.nearbyStationMarkers = []; // Clear the array after removal
  }

  private removeBusMarkers(routeId: number): void {
    this.busMarkers = this.busMarkers.filter((marker) => {
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
      this.http
        .post("/api/saveMapData", { userId: this.userId, mapData })
        .subscribe(
          (response) => {
            console.log("Map data saved successfully");
          },
          (error) => {
            console.error("Error saving map data:", error);
          }
        );
    } else {
      console.log("Please log in first.");
    }
  }

  loadMapData() {
    if (this.userId) {
      console.log("Loading map data for userId:", this.userId); // Debug log
      this.http
        .get("/api/getMapData", { params: { userId: this.userId } })
        .subscribe(
          (response: any) => {
            if (response.success) {
              console.log("Map data retrieved from backend:", response.mapData);
              this.setMapData(response.mapData);
            } else {
              console.error("No map data found for the user");
            }
          },
          (error) => {
            console.error("Error retrieving map data:", error);
          }
        );
    }
  }

  getMapData() {
    const mapData: any = {
      layers: [],
    };

    this.map.eachLayer((layer: any) => {
      if (layer.toGeoJSON) {
        mapData.layers.push(layer.toGeoJSON());
      }
    });

    return mapData;
  }

  async setMapData(mapData: any) {
    const { default: L } = await import("leaflet");

    // Clear existing layers
    this.map.eachLayer((layer: any) => {
      if (layer.pm) {
        this.map.removeLayer(layer);
      }
    });

    const customIcon = L.icon({
      iconUrl: "assets/marker-icon.png",
      iconRetinaUrl: "assets/marker-icon-2x.png",
      shadowUrl: "assets/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    console.log("Setting map data:", mapData);

    mapData.layers.forEach((geojson: any) => {
      const layer = L.geoJSON(geojson, {
        pointToLayer: (feature, latlng) => {
          return L.marker(latlng, { icon: customIcon });
        },
      }).addTo(this.map);

      // Add the layer to the map
      this.map.addLayer(layer);
    });

    console.log("Map data successfully added to map");
  }

  private loadTData() {
    this.http.get<any[]>("/api/dataset").subscribe(
      (data) => {
        this.tData = data;
      },
      (error) => {
        console.error("Error fetching T ID data:", error);
      }
    );
  }

  private getTId(vehicleId: number): string | null {
    const vehicle = this.tData.find(
      (item: any) => item.vehicle.vehicle.id === vehicleId
    );
    return vehicle ? vehicle.vehicle.vehicle.th_id : null;
  }

  /*private addLoginButton(): void {
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
*/
  private showLoginOverlay(): void {
    const overlay = document.getElementById("loginOverlay");
    if (overlay) {
      overlay.style.display = "flex";
    }
  }

  private hideLoginOverlay(): void {
    const overlay = document.getElementById("loginOverlay");
    if (overlay) {
      overlay.style.display = "none";
    }
  }

  public onLoginSubmit(): void {
    // Make sure username and password are entered
    if (!this.loginData.username || !this.loginData.password) {
      this.showAlert("Error", "Username and password are required", "error");
      return;
    }

    this.http
      .post("/api/login", this.loginData)
      .pipe(
        catchError((error) => {
          this.handleLoginError(error);
          return throwError(error);
        })
      )
      .subscribe((response: any) => {
        if (response.success) {
          this.showAlert("Success", "Login successful!", "success");
          this.hideLoginOverlay(); // Close the login overlay
          this.guestSession = false; // Set guestSession to false
          localStorage.setItem("guestSession", "false"); // Update guestSession in localStorage
          localStorage.setItem("username", this.loginData.username); // Save username for later use

          // Update bus markers
          // @ts-ignore
          this.updateBusMarkers();

          // Change the login button to the logout icon
          this.updateLoginButtonIcon(true); // Pass 'true' to indicate logged in
        } else {
          this.showAlert("Error", "Invalid username or password", "error");
        }
      });
  }

  // Handle login errors
  private handleLoginError(error: any): void {
    console.error("Error details:", error); // Log full error details for inspection

    if (error.status === 400) {
      this.showAlert(
        "Error",
        "Invalid request. Please check the form data.",
        "error"
      );
    } else if (error.status === 401) {
      this.showAlert(
        "Unauthorized",
        "Incorrect username or password.",
        "error"
      );
    } else {
      this.showAlert(
        "Error",
        "An unexpected error occurred. Please try again later.",
        "error"
      );
    }
  }

  // Show alert using SweetAlert2
  private showAlert(
    title: string,
    text: string,
    icon: "success" | "error"
  ): void {
    Swal.fire({
      title: title,
      text: text,
      icon: icon,
      confirmButtonText: "OK",
    });
  }

  public logout(): void {
    const username = localStorage.getItem("username"); // Retrieve the logged-in username

    // Show a sweetalert popup with the waving emoji and the username
    Swal.fire({
      title: `👋 Goodbye, ${username}!`,
      text: "You have successfully logged out.",
      icon: "success",
      confirmButtonText: "OK",
    }).then(() => {
      // After the popup is confirmed, proceed with logout actions

      // Set guestSession to true in localStorage
      localStorage.setItem("guestSession", "true");
      this.guestSession = true; // Set guestSession to true in the component

      // Update the bus markers to reflect the guest state
      // @ts-ignore

      // Change the login button back to the login icon
      this.updateLoginButtonIcon(false); // Pass 'false' to indicate it's now logout state

      // Clear the username from localStorage
      localStorage.removeItem("username");
    });
  }

  private updateLoginButtonIcon(isLoggedIn: boolean): void {
    // Get the existing control and update the icon based on login/logout state
    const loginButton = document.querySelector(".leaflet-control-custom");

    if (loginButton) {
      const iconUrl = isLoggedIn
        ? "assets/logout-icon.svg.png"
        : "assets/login-icon.svg.png";

      // Update the icon in the button
      (loginButton as HTMLElement).style.backgroundImage = `url(${iconUrl})`;
    }
  }

  private checkGuestSession() {
    const storedSession = localStorage.getItem("guestSession");
    if (storedSession === null) {
      localStorage.setItem("guestSession", "true"); // Initialize guestSession as true
      this.guestSession = true;
    } else {
      this.guestSession = storedSession === "true"; // Set guestSession based on stored value
    }
  }

  /*private addGtfsButton(): void {
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
  }*/
  private async loadCapMarkers(): Promise<void> {
    try {
      // Fetch Excel data from the provided file path
      this.nightRoutesTerminals = await this.excelReaderService.readExcelFromAssets('assets/terminale_linii.xlsx');
    } catch (error) {
      console.error('Error loading Excel data or processing station markers:', error);
    }
  }

  private loadFilteredStationMarkers(routeShortName: string, routeId: number, cap1: string, cap2: string) {
    if (this.stationsGeoJsonData && this.isBrowser) {
      const stationFeatures = this.stationsGeoJsonData[routeShortName] || [];
      const markers: any[] = [];
      const isMobile = window.innerWidth <= 768;

      stationFeatures.forEach((feature: any) => {
        const { coordinates } = feature.geometry;
        const { properties } = feature;

        if (parseInt(properties["Route ID"]) === routeId) {
          const stationName = properties["Statie"];

          // Case-insensitive comparison with Cap 1 and Cap 2
          if (stationName && (stationName.toLowerCase() === cap1.toLowerCase() || stationName.toLowerCase() === cap2.toLowerCase())) {
            let iconUrl = "assets/statie_autobuz.png";

            if (properties["Mod Transp"] === "TRAM") {
              iconUrl = "assets/statie_tramvai.png";
            } else if (properties["Mod Transp"] === "Metrou") {
              iconUrl = "assets/statie_metrou.png";
            }

            const stationIcon = L.icon({
              iconUrl,
              iconSize: isMobile ? [25, 25] : [30, 30], // Adjust size based on device
              iconAnchor: isMobile ? [15, 25] : [15, 30], // Adjust anchor point
              popupAnchor: isMobile ? [0, -20] : [0, -30], // Adjust popup anchor
            });

            const determineBoxColor = (routeShortName: string) => {
              if (routeShortName.startsWith("M")) {
                return "black";
              } else if (routeShortName.startsWith("N")) {
                return "darkblue";
              } else {
                const routeNumber = parseInt(routeShortName);
                if (routeNumber >= 1 && routeNumber <= 55) {
                  return "#BE1622";
                } else if (routeNumber >= 56 && routeNumber <= 99) {
                  return "#008D36";
                } else if (routeNumber >= 100 && routeNumber <= 400) {
                  return "#1D71B8";
                } else if (routeNumber >= 400 && routeNumber <= 999) {
                  return "#662483";
                }
              }
              return "yellow"; // Fallback color
            };

            const formatLiniiComune = (liniiComune: string) => {
              return liniiComune
                .split(", ")
                .map((line) => {
                  const boxColor = determineBoxColor(line);
                  return `<span style="background-color: ${boxColor}; color: white; padding: 2px 4px; border-radius: 3px;" > ${line} </span>`;
                })
                .join(", ");
            };

            const liniiConexe = properties["Linii Comune"]
              ? `<strong>Linii Comune:</strong> <span style="color: black;">${formatLiniiComune(
                properties["Linii Comune"]
              )}</span><br>`
              : "";

            const selectedRouteColor = determineBoxColor(routeShortName);
            const linieSens = `<strong>Linie / Sens:</strong> <span style="background-color: ${selectedRouteColor}; color: white; padding: 2px 4px; border-radius: 3px;">${routeShortName}</span > <br>`;

            const artera =
              properties["Mod Transp"] !== "Metrou"
                ? `<strong>Artera : </strong> ${properties["Artera"]}<br>`
                : "";

            // Set up the marker with a basic popup, and lazy-load the arrival data
            const marker = L.marker([coordinates[1], coordinates[0]], {
              icon: stationIcon,
            })
              .bindPopup(
                `
                          <div>
                              <strong>Cod Statie:</strong> ${properties["Cod Statie"]}<br>
                              <strong>Statie:</strong> ${properties["Statie"]}<br>
                              ${linieSens}
                              ${liniiConexe}
                              ${artera}
                              <strong>Mod Transp:</strong> ${properties["Mod Transp"]}<br>
                          </div>
                      `
              )

            this.nightBusStationMarkers.push(marker); // Store the marker for removal later
            marker.addTo(this.map);
          }
        }
      });

      if (markers.length > 0) {
        this.stationMarkers.set(routeId, markers);
      } else {
        console.warn("No markers found for routeShortName: ${ routeShortName } and routeId: ${ routeId }");
      }
    } else {
      console.warn("No station data available or not in browser environment.");
    }
  }



  private loadNightBus() {
    if (this.isBrowser) {
      this.nightBusRoutesLoaded = false; // Track if the routes are already loaded
      const customControl = L.Control.extend({
        options: {
          position: "topleft",
        },

        onAdd: (map: L.Map) => {
          const container = L.DomUtil.create(
            "div",
            "leaflet-bar leaflet-control leaflet-control-custom"
          );
          container.style.backgroundImage = 'url("assets/night_bus.png")';
          container.style.backgroundSize = "30px 30px";
          container.style.width = "30px";
          container.style.height = "30px";
          container.style.cursor = "pointer";
          container.title = "Load Night Bus Routes";
          //Show Capat
          this.loadCapMarkers();
          L.DomEvent.on(container, "click", () => {
            if (this.nightBusRoutesLoaded) {
              // When the night bus routes are removed, display nearest bus stations again
              this.removeNightBusLayers(); // Remove night bus layers
              this.nightBusRoutesLoaded = false;
              this.clearAllSelectionAndRestartFollowing(false);
              this.nightBusStationMarkers.forEach(marker => this.map.removeLayer(marker));
              this.nightBusStationMarkers = []; // Clear the array
            } else {
              this.clearAllSelections(true);
              // When the night bus routes are loaded, remove the nearby station markers
              this.loadNightBusRoutes(); // Load night bus routes (without stations)
              this.removeNearbyStationMarkers(); // Remove the nearest bus station markers
              this.nightBusRoutesLoaded = true;
              // Add markers for Cap 1 and Cap 2 from the Excel file
            }
          });

          return container;
        },
      });

      this.map.addControl(new customControl());
    }
  }


  private removeNightBusLayers() {
    // Remove all the route layers for night bus routes
    this.routeLayers.forEach((routeLayer, routeId) => {
      this.map.removeLayer(routeLayer);

      // Remove the corresponding station markers if they exist
      const stationMarkers = this.stationMarkers.get(routeId);
      if (stationMarkers) {
        stationMarkers.forEach((marker) => {
          this.map.removeLayer(marker);
        });
      }
    });

    // Optionally remove the checkbox when routes are removed
    const checkboxContainer = document.querySelector(".checkbox-container");
    if (checkboxContainer) {
      checkboxContainer.remove();
    }

    console.log("Night bus routes and stations removed.");
  }

  private loadNightBusRoutes() {
    const nightBusRoutes = this.routeDetails.filter((route) =>
      route.shortName.startsWith("N")
    );

    if (nightBusRoutes.length === 0) {
      console.log("No night bus routes found.");
      return;
    }
    //nightRoutesGroup
    // Load only the routes initially (no stations)
    nightBusRoutes.forEach((route) => {
      const _routeFeatures = this.routeGeoJsonData[route.shortName] || [];
      const _routeLayer = L.geoJSON(_routeFeatures);
      this.nightRoutesGroup.addLayer(_routeLayer);
      const routeId = route.routeId;
      const randomColor = this.getRandomColor(); // Generate a random color for each route
      this.loadRouteLayerWithoutStations(route.shortName, routeId, randomColor); // Load routes without stations
    });

    // Add the checkbox after loading the routes
    this.addStationsCheckbox();
    this.map.flyToBounds(this.nightRoutesGroup.getBounds());
  }
  private getRandomColor(): string {
    const tableau10Palette = [
      "#4E79A7", // Blue
      "#F28E2B", // Orange
      "#E15759", // Red
      "#76B7B2", // Teal
      "#59A14F", // Green
      "#EDC949", // Yellow
      "#AF7AA1", // Purple
      "#FF9DA7", // Pink
      "#9C755F", // Brown
      "#BAB0AC", // Gray
    ];

    // Randomly select a color from the Tableau 10 palette
    const randomIndex = Math.floor(Math.random() * tableau10Palette.length);
    return tableau10Palette[randomIndex];
  }

  private addStationsCheckbox() {
    const checkboxContainer = document.createElement("div");
    checkboxContainer.className = "checkbox-container";
    checkboxContainer.style.position = "absolute";
    checkboxContainer.style.top = "10px";
    checkboxContainer.style.left = "50px";
    checkboxContainer.style.zIndex = "1000";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "showStationsCheckbox";

    const label = document.createElement("label");
    label.htmlFor = "showStationsCheckbox";
    label.innerText = "Show Stations";

    checkboxContainer.appendChild(checkbox);
    checkboxContainer.appendChild(label);

    document.body.appendChild(checkboxContainer);

    // Add event listener for checkbox toggle
    checkbox.addEventListener("change", (event: Event) => {
      const isChecked = (event.target as HTMLInputElement).checked;
      this.toggleStationVisibility(isChecked);
    });
  }
  private toggleStationVisibility(show: boolean) {
    this.routeLayers.forEach((routeLayer, routeId) => {
      if (show) {
        // Load station markers for this route when the checkbox is checked
        this.routeDetails.forEach((route) => {
          if (route.routeId === routeId) {
            this.loadStationMarkers(route.shortName, routeId);
          }
        });
      } else {
        // Remove the station markers when the checkbox is unchecked
        const stationMarkers = this.stationMarkers.get(routeId);
        if (stationMarkers) {
          stationMarkers.forEach((marker) => {
            this.map.removeLayer(marker);
          });
        }
      }
    });
  }


  private loadRouteLayerWithoutStations(routeShortName: string, routeId: number, color: string) {
    if (this.routeGeoJsonData && this.isBrowser) {
      const routeFeatures = this.routeGeoJsonData[routeShortName] || [];

      let selectedLayer: L.Path | null = null;

      const routeLayer = L.geoJSON(routeFeatures, {
        style: {
          color: color,
          weight: 3,
          opacity: 1,
        },
        onEachFeature: (feature, layer) => {
          // Add popup content with Route Name (shortName)
          const pathLayer = layer as L.Path;

          // Add hover effect
          pathLayer.on("mouseover", () => {
            if (selectedLayer !== pathLayer) {
              pathLayer.setStyle({ color: "purple" });
            }
          });

          pathLayer.on("mouseout", () => {
            if (selectedLayer !== pathLayer) {
              pathLayer.setStyle({ color: color });
            }
          });

          pathLayer.on("document:click", () => {
            if (selectedLayer !== pathLayer) {
              pathLayer.setStyle({ color: color });
            }
          });

          // Add click effect to show popup at the click location
          pathLayer.on("click", (e: L.LeafletMouseEvent) => {
            if (selectedLayer && selectedLayer !== pathLayer) {
              selectedLayer.setStyle({ color: color });
            }
            pathLayer.setStyle({ color: "yellow" });
            selectedLayer = pathLayer;
            this.nightBusStationMarkers.forEach(marker => this.map.removeLayer(marker));
            this.nightBusStationMarkers = []; // Clear the array
            // Iterate through the Excel rows to get routeShortName (from 'Linia') and routeId (from 'route_id')
            let cap1 = "";
            let cap2 = "";
            let currentRow = this.nightRoutesTerminals.find(e => {
              return e['route_id'] === routeId;
            });
            if (currentRow !== undefined && currentRow !== null) {
              const routeShortName = currentRow['LINIA']; // Assuming 'LINIA' column is the route short name
              const routeId = currentRow['route_id'];
              // Load and filter station markers for the current route
              this.loadFilteredStationMarkers(routeShortName, routeId, currentRow['CAP 1'], currentRow['CAP 2']);
              cap1 = currentRow['CAP 1'];
              cap2 = currentRow['CAP 2'];
            }
            const popupContent = `<strong>Rută: </strong> ${routeShortName}<br>
                                  <strong>Capete: ${cap1} - ${cap2}</strong>`;
            // Create a popup at the click location
            const popup = L.popup()
              .setLatLng(e.latlng) // Set the popup to the clicked point
              .setContent(popupContent) // Display the route name
              .openOn(this.map); // Open the popup on the map
          });
        },
      }).addTo(this.map);

      this.routeLayers.set(routeId, routeLayer);
      // No station markers loaded here
    }
  }

  // Function to show a custom form using SweetAlert2
  private showGtfsSelectionMenu(
    routes: any[],
    stations: any[],
    stopTimes: any[]
  ): void {
    // Convert routes into HTML select options
    const routeOptions = routes
      .map((route) => {
        return `<option value="${route.route_id}">${route.route_short_name || "Unnamed Route"
          }</option>`;
      })
      .join("");

    Swal.fire({
      title: "Select Route",
      html: `
    <label for="route-select">Select Route:</label>
    <select id="route-select" class="swal2-input">
      ${routeOptions}
    </select>
    `,
      confirmButtonText: "Submit",
      showCancelButton: true,
      preConfirm: () => {
        const selectedRouteId = (
          document.getElementById("route-select") as HTMLSelectElement
        ).value;

        if (!selectedRouteId) {
          Swal.showValidationMessage("Please select a route");
          return null;
        }
        return { selectedRouteId };
      },
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
    const stationsForRoute = stations.filter(
      (station) => station.route_id === routeId
    );

    // Display stations as markers on the map
    stationsForRoute.forEach((station) => {
      const stationLatLng = [station.stop_lat, station.stop_lon];
      // @ts-ignore
      const stationMarker = L.marker(stationLatLng, {
        icon: L.icon({
          iconUrl: "assets/statie_autobuz.png",
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          popupAnchor: [0, -30],
        }),
      }).addTo(this.map);

      // Bind a popup to the station marker
      stationMarker
        .bindPopup(
          `
      <div>
        <strong>Station:</strong> ${station.stop_name}<br>
        <strong>Description:</strong> ${station.stop_desc || "No description available"
          }
      </div>
    `
        )
        .openPopup();
    });
  }

  // Call this function after receiving stops data from the server

  private displaySelectedRoute(
    routeId: string,
    routes: any[],
    shapes: any[]
  ): void {
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
    const polylinePoints = routeShapes.map((shape: { lat: any; lon: any }) => [
      shape.lat,
      shape.lon,
    ]);

    // Create and add the polyline to the map
    const polyline = L.polyline(polylinePoints, {
      color: "blue",
      weight: 3,
    }).addTo(this.map);

    // Add popup content with route details
    const properties = {
      route_id: routeId,
      name:
        routes.find((r: any) => r.route_id === routeId)?.route_short_name ||
        "Unnamed Route",
    };

    // Add customization popups for the polyline
    this.addPopupContent(polyline, properties, true); // true for polyline/multi-line

    // Fit the map to the bounds of the polyline
    this.map.fitBounds(polyline.getBounds());
  }
}
