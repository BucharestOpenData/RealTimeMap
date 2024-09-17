import { Injectable } from '@angular/core';
import * as fs from 'fs';
import * as path from 'path';

@Injectable({
  providedIn: 'root'
})
export class GtfsDataService {

  constructor() { }

  readRoutesFile(filePath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          // Parse the CSV data into JSON
          const lines = data.split('\n');
          const headers = lines[0].split(',');
          const routes = lines.slice(1).map(line => {
            const values = line.split(',');
            const route = {};
            headers.forEach((header, index) => {
              // @ts-ignore
              route[header.trim()] = values[index].trim();
            });
            return route;
          });
          resolve(routes);
        }
      });
    });
  }
}
