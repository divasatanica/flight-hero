/**
 * Basic plane information broadcast to all clients
 */
export type PlaneBasic = {
  id: string;
  latitude: number;
  longitude: number;
  altitude: number;
  color: string;
  heading: number;
  model: string;
};

/**
 * Detailed plane information for subscribed clients
 */
export type PlaneDetailed = {
  id: string;

  // Aircraft
  model: string;
  airline: string;
  flightNumber: string;
  registration: string;

  // Position
  latitude: number;
  longitude: number;
  altitude: number; // meters
  speed: number; // meters per second
  heading: number;
  verticalSpeed: number;

  // Route
  origin: {
    airport: string;
    city: string;
  };
  destination: {
    airport: string;
    city: string;
  };

  // Time
  flightDuration: number;
  estimatedArrival: number;

  // Load & status
  numberOfPassengers: number;
  maxPassengers: number;
  status: "departed" | "enroute" | "cruising" | "landing";

  // UI
  color: string;
};

/**
 * WebSocket message types for basic planes endpoint
 */
export type BasicPlanesMessage = {
  type: "planes";
  data: PlaneBasic[];
};

/**
 * WebSocket message types for detailed plane endpoint
 */
export type SubscribeMessage = {
  type: "subscribe";
  planeId: string;
};

export type PlaneDetailsMessage = {
  type: "plane-details";
  data: PlaneDetailed;
};
