import type { PlaneBasic, PlaneDetailed } from "@flight-hero/contract";

/**
 * Plane model with simulation logic
 */
export class Plane {
  private id: string;
  private latitude: number;
  private longitude: number;
  private altitude: number; // meters
  private color: string;
  private speed: number; // meters per second
  private model: string;
  private airline: string;
  private flightNumber: string;
  private registration: string;
  private heading: number; // degrees
  private verticalSpeed: number; // meters per second
  private origin: { airport: string; city: string };
  private destination: { airport: string; city: string };
  private numberOfPassengers: number;
  private maxPassengers: number;
  private status: "departed" | "enroute" | "cruising" | "landing";
  private flightDuration: number; // minutes
  private estimatedArrival: number; // timestamp
  private startTime: number;

  // Movement deltas (small increments for smooth movement)
  private latDelta: number;
  private lngDelta: number;
  private altDelta: number;

  constructor(id: string) {
    this.id = id;
    this.startTime = Date.now();

    // Initialize with random realistic positions
    // Europe/North America range
    this.latitude = 35 + Math.random() * 30; // 35-65 degrees
    this.longitude = -120 + Math.random() * 60; // -120 to -60 degrees

    // Realistic altitude range in meters (converted from 20,000 - 50,000 feet)
    // 1 foot = 0.3048 meters
    const altitudeFeet = 20000 + Math.random() * 30000;
    this.altitude = altitudeFeet * 0.3048; // Convert to meters

    // Random color for visualization
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#FFA07A",
      "#98D8C8",
      "#F7DC6F",
      "#BB8FCE",
      "#85C1E2",
      "#F8B739",
      "#52BE80",
    ];
    this.color = colors[Math.floor(Math.random() * colors.length)];

    // Realistic speed in meters per second (converted from 400-700 knots)
    // 1 knot = 0.514444 m/s
    const speedKnots = 400 + Math.random() * 300;
    this.speed = speedKnots * 0.514444; // Convert to m/s

    // Random plane models
    const models = [
      "Boeing 737",
      "Airbus A320",
      "Boeing 787",
      "Airbus A350",
      "Boeing 777",
      "Airbus A380",
      "Embraer E190",
      "Bombardier CRJ",
    ];
    this.model = models[Math.floor(Math.random() * models.length)];

    // Airlines
    const airlines = [
      "American Airlines",
      "United Airlines",
      "Delta Air Lines",
      "Lufthansa",
      "British Airways",
      "Air France",
      "KLM",
      "Emirates",
      "Qatar Airways",
      "Turkish Airlines",
    ];
    this.airline = airlines[Math.floor(Math.random() * airlines.length)];

    // Flight number (format: AA1234)
    const airlineCode = this.airline
      .substring(0, 2)
      .toUpperCase()
      .replace(/\s/g, "");
    this.flightNumber = `${airlineCode}${1000 + Math.floor(Math.random() * 9000)}`;

    // Registration (format: N12345)
    this.registration = `N${Math.floor(10000 + Math.random() * 90000)}`;

    // Heading (0-360 degrees)
    this.heading = Math.floor(Math.random() * 360);

    // Vertical speed in m/s (typically -10 to +10 m/s)
    this.verticalSpeed = (Math.random() - 0.5) * 20;

    // Origin and destination airports
    const airports = [
      { airport: "JFK", city: "New York" },
      { airport: "LAX", city: "Los Angeles" },
      { airport: "ORD", city: "Chicago" },
      { airport: "LHR", city: "London" },
      { airport: "CDG", city: "Paris" },
      { airport: "FRA", city: "Frankfurt" },
      { airport: "AMS", city: "Amsterdam" },
      { airport: "DXB", city: "Dubai" },
      { airport: "IST", city: "Istanbul" },
      { airport: "MIA", city: "Miami" },
    ];
    const originIdx = Math.floor(Math.random() * airports.length);
    let destIdx = Math.floor(Math.random() * airports.length);
    while (destIdx === originIdx) {
      destIdx = Math.floor(Math.random() * airports.length);
    }
    this.origin = airports[originIdx];
    this.destination = airports[destIdx];

    // Realistic passenger count
    this.maxPassengers = 150 + Math.floor(Math.random() * 350); // 150-500
    this.numberOfPassengers = Math.floor(
      this.maxPassengers * (0.6 + Math.random() * 0.4),
    ); // 60-100% capacity

    // Status
    const statuses: Array<"departed" | "enroute" | "cruising" | "landing"> = [
      "departed",
      "enroute",
      "cruising",
      "landing",
    ];
    this.status = statuses[Math.floor(Math.random() * statuses.length)];

    // Initialize flight duration (starts at 0)
    this.flightDuration = 0;

    // Estimated arrival (random 2-8 hours from now)
    const flightTimeHours = 2 + Math.random() * 6;
    this.estimatedArrival = Date.now() + flightTimeHours * 3600000;

    // Initialize movement deltas (small random values for smooth drift)
    this.latDelta = (Math.random() - 0.5) * 0.01; // ~0.005 degrees per update
    this.lngDelta = (Math.random() - 0.5) * 0.01;
    this.altDelta = (Math.random() - 0.5) * 30.48; // ~15 meters per update (converted from feet)
  }

  /**
   * Update plane position and state (called on each simulation tick)
   */
  update(): void {
    // Update position with small increments for smooth movement
    this.latitude += this.latDelta;
    this.longitude += this.lngDelta;
    this.altitude += this.altDelta;

    // Keep within realistic bounds
    if (this.latitude < 35 || this.latitude > 65) {
      this.latDelta *= -1;
    }
    if (this.longitude < -120 || this.longitude > -60) {
      this.lngDelta *= -1;
    }
    // Altitude bounds in meters (converted from 20,000 - 50,000 feet)
    if (this.altitude < 6096 || this.altitude > 15240) {
      this.altDelta *= -1;
    }

    // Update heading based on movement direction
    this.heading = (Math.atan2(this.lngDelta, this.latDelta) * 180) / Math.PI;
    if (this.heading < 0) this.heading += 360;

    // Update vertical speed with small variations
    this.verticalSpeed = Math.max(
      -15,
      Math.min(15, this.verticalSpeed + (Math.random() - 0.5) * 2),
    );

    // Update flight duration
    this.flightDuration = Math.floor((Date.now() - this.startTime) / 60000);

    // Small random speed variations in m/s (converted from knots bounds)
    // 300 knots = 154.3 m/s, 800 knots = 411.6 m/s
    this.speed = Math.max(
      154.3,
      Math.min(411.6, this.speed + (Math.random() - 0.5) * 5),
    );
  }

  /**
   * Get basic plane data (for /ws/planes/basic endpoint)
   */
  getBasic(): PlaneBasic {
    return {
      id: this.id,
      latitude: this.latitude,
      longitude: this.longitude,
      altitude: this.altitude,
      color: this.color,
    };
  }

  /**
   * Get detailed plane data (for /ws/planes/details endpoint)
   */
  getDetailed(): PlaneDetailed {
    return {
      id: this.id,
      model: this.model,
      airline: this.airline,
      flightNumber: this.flightNumber,
      registration: this.registration,
      latitude: this.latitude,
      longitude: this.longitude,
      altitude: this.altitude,
      speed: this.speed,
      heading: this.heading,
      verticalSpeed: this.verticalSpeed,
      origin: this.origin,
      destination: this.destination,
      flightDuration: this.flightDuration,
      estimatedArrival: this.estimatedArrival,
      numberOfPassengers: this.numberOfPassengers,
      maxPassengers: this.maxPassengers,
      status: this.status,
      color: this.color,
    };
  }

  getId(): string {
    return this.id;
  }
}
