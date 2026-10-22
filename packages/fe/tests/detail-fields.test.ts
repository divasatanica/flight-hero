import { expect, it } from "vitest";
import { detailFields } from "../src/modules/tools/detail-fields";
import type { PlaneDetailed } from "@flight-hero/contract";

it("formats measurements, route, status and arrival with explicit units and UTC", () => {
  const fields = Object.fromEntries(
    detailFields({
      id: "plane-1",
      altitude: 10668.4321,
      speed: 283.126,
      heading: 180.12,
      latitude: 45.123456,
      longitude: -75.567891,
      verticalSpeed: -2.456,
      flightDuration: 125,
      estimatedArrival: Date.UTC(2026, 9, 22, 14, 30),
      status: "enroute",
      origin: { airport: "JFK", city: "New York" },
      destination: { airport: "LAX", city: "Los Angeles" },
      numberOfPassengers: 180,
      maxPassengers: 200,
    } as PlaneDetailed),
  );
  expect(fields["Altitude"]).toBe("10,668 m");
  expect(fields["Speed"]).toBe("283.1 m/s");
  expect(fields["Heading"]).toBe("180°");
  expect(fields["Latitude"]).toBe("45.1235°");
  expect(fields["Longitude"]).toBe("-75.5679°");
  expect(fields["Vertical speed"]).toBe("-2.5 m/s");
  expect(fields["Flight duration"]).toBe("125 min");
  expect(fields["Estimated arrival (UTC)"]).toBe("22 Oct 2026, 14:30");
  expect(fields["Origin"]).toBe("JFK · New York");
  expect(fields["Status"]).toBe("En route");
  expect(fields["Passengers"]).toBe("180 / 200");
});

it("preserves zero values and safely displays missing or invalid values", () => {
  const fields = Object.fromEntries(
    detailFields({
      altitude: 0,
      speed: NaN,
      estimatedArrival: Infinity,
    } as PlaneDetailed),
  );
  expect(fields["Altitude"]).toBe("0 m");
  expect(fields["Speed"]).toBe("—");
  expect(fields["Estimated arrival (UTC)"]).toBe("—");
  expect(fields["Origin"]).toBe("—");
});
