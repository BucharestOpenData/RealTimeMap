// src/app/interfaces/geojson-layer-config.ts
export interface GeoJSONLayerConfig {
  file: string;
  overlayName: string;
  fillColor: string;
  strokeColor: string;
  strokeWeight: number;
  popupMaxHeight: number;
  popupMaxWidth: number;
  opacity: number;
}
