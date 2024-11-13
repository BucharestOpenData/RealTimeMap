import os
import requests
import zipfile
import pandas as pd
import geopandas as gpd
from shapely import LineString
from tqdm import tqdm
from colorama import Fore, Style, init
from datetime import datetime

# Initialize colorama
init(autoreset=True)

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
shapes_file_path = os.path.join(download_dir, "shapes.txt")
trips_file_path = os.path.join(download_dir, "trips.txt")
geojson_file_path = os.path.join(download_dir, "routes_iun2024.geojson")  # Updated filename

def fetch_and_extract_gtfs():
    try:
        # Fetch the GTFS zip file with a progress bar
        response = requests.get(gtfs_url, stream=True)
        response.raise_for_status()  # Check if the request was successful

        # Get the total length of the content for progress bar
        total_size = int(response.headers.get('content-length', 0))

        # Save the zip file with a progress bar
        with open(zip_file_path, "wb") as file, tqdm(
                desc=Fore.WHITE + "Downloading GTFS file" + Style.RESET_ALL,
                total=total_size,
                unit='B',
                unit_scale=True,
                unit_divisor=1024,
        ) as bar:
            for chunk in response.iter_content(chunk_size=1024):
                file.write(chunk)
                bar.update(len(chunk))

        # Unzip the file and extract the necessary files with progress bar
        with zipfile.ZipFile(zip_file_path, "r") as zip_ref:
            file_list = zip_ref.namelist()
            with tqdm(total=len(file_list), desc=Fore.WHITE + "Extracting files" + Style.RESET_ALL) as bar:
                for file_name in file_list:
                    if file_name in ["routes.txt", "shapes.txt", "trips.txt"]:
                        zip_ref.extract(file_name, download_dir)
                    bar.update(1)

        print(
            Fore.GREEN + f"Files successfully extracted on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}" + Style.RESET_ALL)

    except requests.exceptions.RequestException as e:
        print(Fore.RED + f"Failed to fetch GTFS file: {e}" + Style.RESET_ALL)
    except zipfile.BadZipFile as e:
        print(Fore.RED + f"Failed to unzip GTFS file: {e}" + Style.RESET_ALL)
    except KeyError as e:
        print(Fore.RED + f"Required files not found in the zip file: {e}" + Style.RESET_ALL)


def generate_geojson_routes():
    try:
        # Read the shapes.txt file into a DataFrame
        shapes_df = pd.read_csv(shapes_file_path, dtype={
            'shape_id': 'str',
            'shape_pt_lat': 'float',
            'shape_pt_lon': 'float',
            'shape_pt_sequence': 'Int64'
        })

        # Read the trips.txt file into a DataFrame
        trips_df = pd.read_csv(trips_file_path, dtype={
            'route_id': 'str',
            'service_id': 'str',
            'trip_id': 'str',
            'shape_id': 'str'
        }, low_memory=False)

        # Read the routes.txt file into a DataFrame
        routes_df = pd.read_csv(routes_file_path, dtype={
            'route_id': 'str',
            'agency_id': 'str',
            'route_short_name': 'str',
            'route_long_name': 'str',
            'route_desc': 'str',
            'route_type': 'str',
            'route_color': 'str',
            'route_text_color': 'str'
        })

        # Merge trips with shapes to get route_id for each shape
        merged_df = pd.merge(shapes_df, trips_df[['shape_id', 'route_id']], on='shape_id', how='left')

        # Merge with routes to get the route_name (using route_short_name)
        merged_df = pd.merge(merged_df, routes_df[['route_id', 'route_short_name']], on='route_id', how='left')

        # Create an empty list to store LineStrings, route IDs, and route names
        lines = []
        route_ids = []
        route_names = []

        # Iterate over each group in merged_df grouped by 'shape_id' with a progress bar
        grouped = merged_df.groupby('shape_id')
        for name, group in tqdm(grouped, desc=Fore.WHITE + "Generating LineStrings" + Style.RESET_ALL):
            # Sort the group by 'shape_pt_sequence' to ensure the points are in the correct order
            group = group.sort_values('shape_pt_sequence')

            # Create a list of unique points
            unique_points = list(dict.fromkeys(zip(group['shape_pt_lon'], group['shape_pt_lat'])))

            # Create a LineString from the unique points, only if there are at least 2 unique points
            if len(unique_points) > 1:
                line = LineString(unique_points)
                if line.is_valid:  # Ensure the geometry is valid
                    lines.append(line)
                    route_ids.append(group['route_id'].iloc[0])  # Assuming all rows in the group have the same route_id
                    route_names.append(group['route_short_name'].iloc[0])  # Assuming all rows in the group have the same route_short_name

        # Create a GeoDataFrame
        routes_gdf = gpd.GeoDataFrame({
            'route_id': route_ids,
            'route_name': route_names,  # Renamed column
            'geometry': lines
        })

        # Set the CRS to WGS 84 (EPSG:4326)
        routes_gdf.set_crs("EPSG:4326", inplace=True)

        # Simplify geometries if needed (optional)
        routes_gdf['geometry'] = routes_gdf['geometry'].simplify(0.00001, preserve_topology=True)

        # Validate the GeoDataFrame
        routes_gdf = routes_gdf[routes_gdf.is_valid]

        # Write the GeoDataFrame to a GeoJSON file with a progress bar
        with tqdm(total=1, desc=Fore.WHITE + "Writing GeoJSON file" + Style.RESET_ALL) as bar:
            routes_gdf.to_file(geojson_file_path, driver='GeoJSON')
            bar.update(1)

        print(
            Fore.GREEN + f"GeoJSON routes generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}" + Style.RESET_ALL)

    except FileNotFoundError:
        print(Fore.RED + "shapes.txt not found in the download directory." + Style.RESET_ALL)
    except Exception as e:
        print(Fore.RED + f"An error occurred while generating GeoJSON routes: {e}" + Style.RESET_ALL)


# Run the tasks immediately after script execution
if __name__ == "__main__":
    fetch_and_extract_gtfs()
    generate_geojson_routes()
