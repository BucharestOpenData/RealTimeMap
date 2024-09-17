import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as XLSX from 'xlsx';

@Injectable({
  providedIn: 'root'
})
export class ExcelReaderService {

  constructor(private http: HttpClient) { }

  async readExcelFromAssets(filePath: string): Promise<any[]> {
    const data = await this.http.get(filePath, { responseType: 'arraybuffer' }).toPromise();
    // @ts-ignore
    const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet);
  }
}
