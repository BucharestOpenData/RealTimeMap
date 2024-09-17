import pandas as pd
import os

# Directory where the GTFS files are stored
download_dir = "gtfs_data"

# Path to the routes.txt file
routes_file_path = os.path.join(download_dir, "routes.txt")
output_excel_path = os.path.join(download_dir, "route_data.xlsx")

def convert_routes_to_excel():
    try:
        # Read the routes.txt file
        routes_df = pd.read_csv(routes_file_path, dtype=str)

        # Select only the route_id and route_short_name columns
        routes_df = routes_df[['route_id', 'route_short_name']]

        # Save the selected data to an Excel file
        routes_df.to_excel(output_excel_path, index=False)

        print(f"route_data.xlsx file has been created at {output_excel_path}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    convert_routes_to_excel()
