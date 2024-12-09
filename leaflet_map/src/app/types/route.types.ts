type Coordinates = [number, number];

type Geometry = {
  type: string;
  coordinates: Coordinates[];
};

type Stop = {
  stop_id: string;
  stop_name: string;
  geometry: {
    type: string;
    coordinates: Coordinates;
  };
  arrival_time?: string;
  departure_time?: string;
};

type Instruction = {
  text: string;
  street_name: string;
  distance: number;
  time: number;
};

type RouteLeg = {
  routeColor: string,
  type: string;
  departure_location: string;
  geometry: Geometry;
  trip_headsign?: string;
  stops?: Stop[];
  total_time?: Number;
  instructions?: Instruction[];
  trip_id?: string;
  route_id?: string;
  shortName?: string;  // Adăugat pentru maparea route ID
  showStops?: boolean; // Adăugat pentru UI toggle
};

type RoutePath = {
  legs: RouteLeg[];
};

type RouteResponse = {
  paths: RoutePath[];
};

export type {
  RouteResponse,
  RoutePath,
  RouteLeg,
  Stop,
  Instruction,
  Geometry,
  Coordinates
};
