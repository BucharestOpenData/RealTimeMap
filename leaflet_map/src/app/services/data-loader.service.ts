import { Injectable } from '@angular/core';
import * as Papa from 'papaparse';
import { GeoJSONLayerConfig } from '../interfaces/geojson-layer-config'; // Correct import path

@Injectable({
  providedIn: 'root'
})
export class DataLoaderService {

  constructor() { }

  async loadCSV(filePath: string): Promise<GeoJSONLayerConfig[]> {
    return new Promise((resolve, reject) => {
      fetch(filePath)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch CSV file: ${response.statusText}`);
          }
          return response.text();
        })
        .then(data => {
          Papa.parse(data, {
            header: true,
            complete: (results) => {
              const configs: GeoJSONLayerConfig[] = results.data.map((row: any) => ({
                file: row['file'],
                overlayName: row['overlay-name'],
                fillColor: row['fill-color'],
                strokeColor: row['stroke-color'],
                strokeWeight: +row['stroke-weight'],
                popupMaxHeight: +row['popup-max-height'],
                popupMaxWidth: +row['popup-max-width'],
                opacity: +row['opacity']
              }));
              resolve(configs);
            },
            error: (error: { message: any; }) => {
              reject(`Error parsing CSV: ${error.message}`);
            }
          });
        })
        .catch(error => reject(`Error loading CSV: ${error.message}`));
    });
  }

  async loadGeoJSON(filePath: string): Promise<any> {
    return fetch(filePath)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch GeoJSON file: ${response.statusText}`);
        }
        return response.json();
      })
      .catch(error => {
        throw new Error(`Error loading GeoJSON: ${error.message}`);
      });
  }
}
