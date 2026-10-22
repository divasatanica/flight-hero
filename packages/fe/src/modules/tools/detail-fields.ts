import type { PlaneDetailed } from "@flight-hero/contract";

const arrivalFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});
const statuses: Record<PlaneDetailed["status"], string> = {
  departed: "Departed",
  enroute: "En route",
  cruising: "Cruising",
  landing: "Landing",
};

function measurement(
  value: number | undefined,
  unit: string,
  digits = 0,
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("en-GB", { maximumFractionDigits: digits })}${unit}`;
}

function airport(value: PlaneDetailed["origin"] | undefined): string {
  return value ? `${value.airport} · ${value.city}` : "—";
}

/** Keep presentation labels and units explicit rather than exposing wire-format keys. */
export function detailFields(plane: PlaneDetailed): Array<[string, string]> {
  const arrival = new Date(plane.estimatedArrival);
  return [
    ["Aircraft ID", plane.id ?? "—"],
    ["Model", plane.model ?? "—"],
    ["Airline", plane.airline ?? "—"],
    ["Flight number", plane.flightNumber ?? "—"],
    ["Registration", plane.registration ?? "—"],
    ["Status", statuses[plane.status] ?? "—"],
    ["Origin", airport(plane.origin)],
    ["Destination", airport(plane.destination)],
    ["Altitude", measurement(plane.altitude, " m")],
    ["Speed", measurement(plane.speed, " m/s", 1)],
    ["Heading", measurement(plane.heading, "°")],
    ["Vertical speed", measurement(plane.verticalSpeed, " m/s", 1)],
    ["Latitude", measurement(plane.latitude, "°", 4)],
    ["Longitude", measurement(plane.longitude, "°", 4)],
    ["Flight duration", measurement(plane.flightDuration, " min")],
    [
      "Estimated arrival (UTC)",
      Number.isNaN(arrival.getTime()) ? "—" : arrivalFormat.format(arrival),
    ],
    [
      "Passengers",
      `${measurement(plane.numberOfPassengers, "")} / ${measurement(plane.maxPassengers, "")}`,
    ],
  ];
}
