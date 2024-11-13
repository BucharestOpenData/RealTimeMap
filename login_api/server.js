const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2/promise');
const axios = require('axios');
const debug = require('debug')('app:server');
const https = require('https');
const NodeCache = require('node-cache'); // Import a caching library
const JSZip = require('jszip'); // For unzipping GTFS files
const multer = require('multer');
const app = express();
const path = require('path');
const fs = require('fs'); // Ensure fs is also required for file system operations
const config = require('./config.json'); // Load GTFS config
const port = 3000;

// Middleware
app.use(bodyParser.json({ limit: '5000mb' })); // Increase limit here
app.use(bodyParser.urlencoded({ limit: '5000mb', extended: true })); // Increase limit here
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 100 * 1024 * 1024 // 100 MB
    }
});
const gtfsConfig = {
    sqlitePath: path.join(__dirname, 'gtfs-data.db'), // SQLite database for parsed data
    agencies: [
        {
            path: '', // We'll dynamically update this path after upload
            exclude: []
        }
    ]
};
// MySQL connection
let db;
async function connectToDatabase() {
    try {
        db = await mysql.createConnection({
            host: '192.168.19.0',
            user: 'matei',
            password: '14022002Ma!',
            database: 'utilizatori',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        debug('Connected to the database');
    } catch (err) {
        debug('Error connecting to the database:', err);
    }
}

connectToDatabase();

app.post('/api/upload-gtfs', upload.single('gtfs'), async (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const gtfsZipPath = path.join(__dirname, file.path);  // Path to the uploaded zip file
    const extractDir = path.join(__dirname, 'unzipped-gtfs');  // Directory where we will extract the GTFS files

    try {
        // Read the uploaded ZIP file
        const zipData = fs.readFileSync(gtfsZipPath);
        const zip = await JSZip.loadAsync(zipData);  // Load the ZIP file into JSZip

        // Ensure the extraction directory exists
        if (!fs.existsSync(extractDir)) {
            fs.mkdirSync(extractDir);
        }

        // Extract all files from the zip into the extraction directory
        await Promise.all(
            Object.keys(zip.files).map(async (filename) => {
                const file = zip.files[filename];

                // Write each file to the extraction directory
                if (!file.dir) {
                    const filePath = path.join(extractDir, filename);
                    const fileData = await file.async('nodebuffer');
                    const dir = path.dirname(filePath);

                    // Ensure that the directory exists
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }

                    fs.writeFileSync(filePath, fileData);  // Write the file content
                }
            })
        );

        // Dynamically import `gtfs` and extract the required methods
        const gtfs = await import('gtfs');
        const { openDb, importGtfs, getRoutes, getStops, getTrips } = gtfs;

        // Configure the GTFS data import
        const config = {
            sqlitePath: path.join(__dirname, 'gtfs-data.db'),
            agencies: [
                {
                    path: extractDir  // Path to the unzipped GTFS files
                }
            ]
        };

        // Open the database and import the GTFS data
        await openDb(config);
        await importGtfs(config);

        // Retrieve routes, stops, and trips from the imported GTFS data
        const routes = await getRoutes();
        const stops = await getStops();
        const trips = await getTrips();

        // Query stop times from the stop_times table directly
        const db = await openDb(config);
        const stopTimes = db.prepare('SELECT * FROM stop_times').all();  // Query stop_times directly

        // Create a map of trip_id to route_id from trips.txt
        const tripToRouteMap = trips.reduce((acc, trip) => {
            const { trip_id, route_id } = trip;
            acc[trip_id] = route_id;
            return acc;
        }, {});

        // Add route_id to each stop based on stop_times.txt and trips.txt
        const stopsWithRouteId = stopTimes.reduce((acc, stopTime) => {
            const { trip_id, stop_id } = stopTime;
            const route_id = tripToRouteMap[trip_id];

            if (route_id) {
                if (!acc[stop_id]) {
                    acc[stop_id] = { ...stops.find(stop => stop.stop_id === stop_id), route_id };
                }
            }

            return acc;
        }, {});

        // Send the parsed routes, stops (with route_id), and other data to the client
        res.json({
            success: true,
            message: 'GTFS file uploaded and processed successfully!',
            routes: routes,
            stations: Object.values(stopsWithRouteId),
        });

    } catch (error) {
        console.error('Error processing GTFS file:', error.message);
        res.status(500).json({ success: false, message: 'Error processing GTFS file.', error: error.message });
    } finally {
        // Clean up: Delete the uploaded ZIP file and the extracted files
        fs.unlinkSync(gtfsZipPath);
        fs.rmdirSync(extractDir, { recursive: true });  // Recursively remove the extraction directory
    }
});



// Root route for testing
app.get('/', (req, res) => {
    res.send('Server is running');
    debug('Root route accessed');
});

// Simple GET route for testing
app.get('/api/test', (req, res) => {
    debug('Test route accessed');
    res.send('Test route is working');
});

// Login route
app.post('/api/login', async (req, res) => {
    debug('Received a login request');
    const { username, password } = req.body;
    debug('Request body:', req.body);

    if (!username || !password) {
        debug('Missing username or password');
        res.status(400).send('Missing username or password');
        return;
    }

    try {
        const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
        const [results] = await db.execute(query, [username, password]);

        if (results.length > 0) {
            debug('Login successful');
            res.send({ success: true, message: 'Login successful', userId: results[0].id });
        } else {
            debug('Invalid username or password');
            res.send({ success: false, message: 'Invalid username or password' });
        }
    } catch (err) {
        debug('Error querying the database:', err);
        res.status(500).send('Server error');
    }
});
// New endpoint to fetch next arrivals for a station


// New endpoint to fetch bus data
app.get('/api/busData', async (req, res) => {
    try {
        const response = await axios.get('http://192.168.111.22:8092');
        res.send(response.data);
    } catch (error) {
        debug('Error fetching bus data:', error);
        res.status(500).send('Error fetching bus data');
    }
});

// New endpoint to fetch passenger data
app.get('/api/passenger-data', async (req, res) => {
    try {
        const agent = new https.Agent({
            rejectUnauthorized: false // Accept self-signed certificates
        });

        const response = await axios.get('https://192.168.111.9/thoreb_psg/', {
            headers: {
                'Authorization': `Basic ${Buffer.from('gtfs@tpbi.ro:6EfJrtuhF5z6IA').toString('base64')}`
            },
            httpsAgent: agent // Use custom agent for HTTPS
        });

        res.send(response.data);
    } catch (error) {
        debug('Error fetching passenger data:', error);
        res.status(500).send('Error fetching passenger data');
    }
});
app.get('/api/dataset', async (req, res) => {
    try {
        const agent = new https.Agent({
            rejectUnauthorized: false // Accept self-signed certificates
        });

        const response = await axios.get('https://192.168.16.24:8080/', {
            httpsAgent: agent
        });

        res.json(response.data); // Send the entire dataset to the frontend
    } catch (error) {
        console.error('Error fetching dataset:', error.message);
        res.status(500).send('Error fetching dataset');
    }
});

// Run the Node.js server
app.listen(port, () => {
    debug(`Server running on http://localhost:${port}`);
});
const cache = new NodeCache({ stdTTL: 3600 }); // TTL set to 1 hour (3600 seconds)
app.get('/api/alertdata', async (req, res) => {
    try {
        const agent = new https.Agent({
            rejectUnauthorized: false // Accept self-signed certificates
        });

        // Request the Waze data alerts from the target URL
        const response = await axios.get('https://192.168.16.24:8080/waze_data_alerts', {
            httpsAgent: agent
        });

        // Send the fetched data to the frontend
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching alert data:', error.message);
        res.status(500).send('Error fetching alert data');
    }
});
app.get('/api/trafficdata', async (req, res) => {
    try {
        // Check if data is in cache
        const cachedData = cache.get('dataset');
        if (cachedData) {
            debug('Serving dataset from cache');
            return res.json(cachedData);
        }

        // Create an HTTPS agent for self-signed certificates
        const agent = new https.Agent({
            rejectUnauthorized: false // Accept self-signed certificates
        });

        // Fetch alert data (ROAD_CLOSED/ROAD_CLOSED_EVENT)
        const alertResponse = await axios.get('https://192.168.16.24:8080/waze_data_alerts', {
            httpsAgent: agent
        });

        // Filter only ROAD_CLOSED and ROAD_CLOSED_EVENT alerts
        const alertData = alertResponse.data.features.filter(alert =>
            ['ROAD_CLOSED', 'ROAD_CLOSED_EVENT'].includes(alert.properties.sub_type)
        );

        // Fetch traffic data
        const trafficResponse = await axios.get('https://192.168.16.24:8080/waze_data_jams', {
            httpsAgent: agent
        });

        const trafficData = trafficResponse.data;

        // Loop through traffic data and check if any street matches alertData and speed is 0
        trafficData.features.forEach(traffic => {
            const trafficStreet = traffic.properties.street;
            const trafficSpeed = traffic.properties.speed_kph;

            // Find matching alerts with road closures on the same street
            const matchingAlert = alertData.find(alert => alert.properties.street === trafficStreet);

            // If a matching road closure is found and speed is 0, add 'road_line: 1'
            if (matchingAlert && trafficSpeed === 0) {
                traffic.properties.road_line = 1;
            }
        });

        // Cache the modified traffic dataset
        cache.set('dataset', trafficData);

        debug('Serving dataset from API with road closure information');
        res.json(trafficData);
    } catch (error) {
        debug('Error fetching dataset:', error.message);
        res.status(500).send('Error fetching dataset');
    }
});

app.get('/api/nextArrivals/:codStatie', async (req, res) => {
    const { codStatie } = req.params;
    debug(`Fetching next arrivals for Cod Statie: ${codStatie}`);

    try {
        const url = `http://192.168.111.22:3500/stop_eta/VL7sHW5A9sbE/${encodeURIComponent(codStatie)}`;
        debug(`Request URL: ${url}`);
        const response = await axios.get(url);
        debug(`Response status: ${response.status}`);
        debug(`Response data: ${JSON.stringify(response.data)}`);

        if (response.status === 200 && response.data) {
            res.send(response.data);
        } else {
            res.status(404).send('No data found for the given Cod Statie');
        }
    } catch (error) {
        debug('Error fetching next arrivals:', error.message);
        res.status(500).send('Error fetching next arrivals');
    }
});

