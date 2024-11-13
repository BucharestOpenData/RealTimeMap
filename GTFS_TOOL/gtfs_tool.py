import os
import requests
import zipfile
import schedule
import time
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
from datetime import datetime
from flask import Flask, jsonify
from tqdm import tqdm

# URL of the GTFS zip file
gtfs_url = "https://gtfs.tpbi.ro/regional/BUCHAREST-REGION.zip"

# Directory where the GTFS file will be downloaded and extracted
download_dir = "gtfs_data"
os.makedirs(download_dir, exist_ok=True)

# Paths for the downloaded zip file and the extracted files
zip_file_path = os.path.join(download_dir, "BUCHAREST-REGION.zip")
stops_file_path = os.path.join(download_dir, "stops.txt")
stop_times_file_path = os.path.join(download_dir, "stop_times.txt")
routes_file_path = os.path.join(download_dir, "routes.txt")
trips_file_path = os.path.join(download_dir, "trips.txt")
stops_for_time_arrival_path = os.path.join(download_dir, "stops_for_time_arrival.txt")
geojson_file_path = os.path.join(download_dir, "Statii_Transport_Public_Suprafata.geojson")

app = Flask(__name__)

def fetch_and_extract_gtfs():
    try:
        # Fetch the GTFS zip file
        response = requests.get(gtfs_url)
        response.raise_for_status()

        # Save the zip file
        with open(zip_file_path, "wb") as file:
            file.write(response.content)

        # Unzip the file and extract stops.txt, stop_times.txt, routes.txt, and trips.txt
        with zipfile.ZipFile(zip_file_path, "r") as zip_ref:
            zip_ref.extract("stops.txt", download_dir)
            zip_ref.extract("stop_times.txt", download_dir)
            zip_ref.extract("routes.txt", download_dir)
            zip_ref.extract("trips.txt", download_dir)

        print(f"Files successfully extracted on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        # Generate GeoJSON data
        generate_geojson()

    except requests.exceptions.RequestException as e:
        print(f"Failed to fetch GTFS file: {e}")
    except zipfile.BadZipFile as e:
        print(f"Failed to unzip GTFS file: {e}")
    except KeyError as e:
        print(f"Required files not found in the zip file: {e}")

def generate_geojson():
    try:
        # Specify the dtype for each column to avoid DtypeWarning
        stops_dtype = {
            'stop_id': 'str',
            'stop_name': 'str',
            'stop_desc': 'str',
            'stop_lat': 'float',
            'stop_lon': 'float',
            'location_type': 'str',
            'platform_code': 'str',
            'parent_station': 'str',
            'level_id': 'str'
        }
        stop_times_dtype = {
            'trip_id': 'str',
            'arrival_time': 'str',
            'departure_time': 'str',
            'stop_id': 'str',
            'stop_sequence': 'int',
            'stop_headsign': 'str',
            'pickup_type': 'str',
            'drop_off_type': 'str',
            'shape_dist_traveled': 'str',
            'timepoint': 'str'
        }
        routes_dtype = {
            'route_id': 'str',
            'agency_id': 'str',
            'route_short_name': 'str',
            'route_type': 'str',
            'route_color': 'str',
            'route_text_color': 'str',
            'route_long_name': 'str'
        }
        trips_dtype = {
            'route_id': 'str',
            'service_id': 'str',
            'trip_id': 'str',
            'trip_headsign': 'str',
            'direction_id': 'int',
            'block_id': 'str',
            'shape_id': 'str'
        }

        print("Reading stops data...")
        stops_df = pd.read_csv(stops_file_path, dtype=stops_dtype, low_memory=False)
        print("Reading stop_times data...")
        stop_times_df = pd.read_csv(stop_times_file_path, dtype=stop_times_dtype, low_memory=False)
        print("Reading routes data...")
        routes_df = pd.read_csv(routes_file_path, dtype=routes_dtype, low_memory=False)
        print("Reading trips data...")
        trips_df = pd.read_csv(trips_file_path, dtype=trips_dtype, low_memory=False)

        # Load stops_for_time_arrival.txt
        stops_for_time_arrival_df = pd.read_csv(stops_for_time_arrival_path, dtype=stops_dtype, low_memory=False)

        # Merge stop_times with trips to get route_id for each stop
        print("Merging stop_times with trips to get route_id...")
        merged_df = pd.merge(stop_times_df, trips_df[['trip_id', 'route_id', 'trip_headsign', 'direction_id']], on='trip_id', how='left')

        # Merge with stops to get stop details
        merged_df = pd.merge(merged_df, stops_df, on='stop_id', how='left')

        # Filter out rows with NaN values in stop_lat or stop_lon
        merged_df = merged_df.dropna(subset=['stop_lat', 'stop_lon'])

        # Replace NaN values in stop_desc with an empty string
        merged_df['stop_desc'] = merged_df['stop_desc'].fillna('')

        # Merge with routes to get route_short_name
        print("Merging with routes to get route_short_name...")
        merged_df = pd.merge(merged_df, routes_df[['route_id', 'route_short_name']], on='route_id', how='left')

        # Create a lookup for Linii Comune by stop_id
        print("Creating lookup for Linii Comune by stop_id...")
        linii_comune_lookup = merged_df.groupby('stop_id')['route_short_name'].apply(lambda x: ', '.join(sorted(set(x)))).to_dict()

        # Apply Linii Comune lookup to each row
        def calculate_linii_comune(row):
            linii_comune = linii_comune_lookup.get(row['stop_id'], '')
            # Remove the current line from Linii Comune
            return ', '.join([line for line in linii_comune.split(', ') if line != row['route_short_name']])

        merged_df['Linii Comune'] = merged_df.apply(calculate_linii_comune, axis=1)

        # Determine Mod Transp based on route_short_name
        def determine_mod_transp(route_short_name):
            if route_short_name.startswith('M'):
                return "Metrou"
            elif isinstance(route_short_name, str) and route_short_name.isdigit() and 1 <= int(route_short_name) <= 55:
                return "TRAM"
            return "BUS"

        merged_df['Mod Transp'] = merged_df['route_short_name'].apply(determine_mod_transp)

        # Ensure all stops for each trip_id are included, skipping duplicate stop_ids
        unique_stops = {}
        filtered_rows = []

        print("Filtering unique stops...")
        for _, row in tqdm(merged_df.iterrows(), total=merged_df.shape[0]):
            stop_key = (row['route_id'], row['stop_id'])
            if stop_key not in unique_stops:
                unique_stops[stop_key] = True
                row['coordinates'] = {'lat': row['stop_lat'], 'lon': row['stop_lon']}
                filtered_rows.append(row)

        filtered_df = pd.DataFrame(filtered_rows)

        # Replace 'PV' Cod Statie using stops_for_time_arrival.txt
        print("Replacing 'PV' Cod Statie using stops_for_time_arrival.txt...")

        def replace_pv_cod_statie(row):
            if row['stop_id'].startswith('PV'):
                matching_stops = stops_for_time_arrival_df[
                    (stops_for_time_arrival_df['stop_name'].str[:5].str.lower() == row['stop_name'][:5].lower())
                ]
                if not matching_stops.empty:
                    matching_stops['distance'] = (
                        (matching_stops['stop_lat'] - row['coordinates']['lat']).abs() +
                        (matching_stops['stop_lon'] - row['coordinates']['lon']).abs()
                    )
                    closest_match = matching_stops.loc[matching_stops['distance'].idxmin()]
                    return closest_match['stop_id']
            return row['stop_id']

        filtered_df['stop_id'] = filtered_df.apply(replace_pv_cod_statie, axis=1)

        # Drop the original stop_lat and stop_lon columns
        filtered_df = filtered_df.drop(columns=['stop_lat', 'stop_lon'])

        # Sort filtered DataFrame by trip_id in ascending order
        filtered_df = filtered_df.sort_values(by='trip_id')

        # Create geometry column using apply on the DataFrame
        filtered_df['geometry'] = filtered_df.apply(
            lambda row: Point(row['coordinates']['lon'], row['coordinates']['lat']), axis=1
        )

        # Create GeoDataFrame with geometry
        gdf = gpd.GeoDataFrame(filtered_df, geometry='geometry')

        # Select and rename columns for GeoJSON output, including trip_headsign and direction_id
        gdf = gdf[['route_id', 'route_short_name', 'stop_id', 'stop_name', 'stop_desc', 'Mod Transp', 'Linii Comune', 'trip_headsign', 'direction_id', 'geometry']]
        gdf = gdf.rename(columns={
            'route_short_name': 'Linia/sens',
            'stop_name': 'Statie',
            'stop_desc': 'Artera',
            'Mod Transp': 'Mod Transp',
            'route_id': 'Route ID',
            'Linii Comune': 'Linii Comune',
            'stop_id': 'Cod Statie',  # Rename stop_id to Cod Statie
            'trip_headsign': 'Capat',  # Rename trip_headsign to Capat
            'direction_id': 'Directie'  # Rename direction_id to Directie
        })

        # Set CRS to EPSG:4326 (which is equivalent to CRS84)
        gdf.set_crs(epsg=4326, inplace=True)

        # Save to GeoJSON file with a progress bar
        print("Saving GeoJSON...")
        with tqdm(total=len(gdf), desc="Saving GeoJSON") as pbar:
            gdf.to_file(geojson_file_path, driver='GeoJSON')
            pbar.update(len(gdf))

        print(f"GeoJSON file successfully created at {geojson_file_path}")

    except Exception as e:
        print(f"Failed to generate GeoJSON: {e}")


if __name__ == "__main__":
    fetch_and_extract_gtfs()

import json

def update_linii_comune_in_geojson():
    try:
        # Load the previously saved GeoJSON file
        with open(geojson_file_path, 'r') as f:
            data = json.load(f)

        # Create a lookup dictionary for Linii Comune
        linii_comune_lookup = {}
        for feature in data['features']:
            cod_statie = feature['properties']['Cod Statie']
            linia_sens = feature['properties']['Linia/sens']
            if cod_statie not in linii_comune_lookup:
                linii_comune_lookup[cod_statie] = set()
            linii_comune_lookup[cod_statie].add(linia_sens)

        # Update each feature's Linii Comune by excluding its own Linia/sens
        for feature in data['features']:
            cod_statie = feature['properties']['Cod Statie']
            linia_sens = feature['properties']['Linia/sens']
            linii_comune = linii_comune_lookup[cod_statie] - {linia_sens}
            feature['properties']['Linii Comune'] = ', '.join(sorted(linii_comune)) if linii_comune else None

        # Save the updated GeoJSON
        with open(geojson_file_path, 'w') as f:
            json.dump(data, f)
        print(f"Linii Comune updated and saved to {geojson_file_path}")

    except Exception as e:
        print(f"Failed to update Linii Comune: {e}")

# Call this function after the initial GeoJSON generation
update_linii_comune_in_geojson()
