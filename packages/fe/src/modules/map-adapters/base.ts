import type { EventEmitter } from "./event-emitter";
import type { PlaneBasic } from "@flight-hero/contract";

export type FlightClickEvent = { flightId: string };
/** Add new event names and argument tuples here. */
export type FlightMapEvents = {
  flightClick: [event: FlightClickEvent];
  mapClick: [];
  mapLoaded: [];
};

export interface FlightMapAdapter extends Pick<
  EventEmitter<FlightMapEvents>,
  "on" | "off" | "once"
> {
  init(options: AdapterInitializationOptions): void;
  destroy(): void;
  updateAircraft(id: string, payload: PlaneBasic): void;
  removeAircraft(id: string): void;
  showTrack(points: Array<[number, number]>): void;
  addTrack(key: string, points: Array<[number, number]>): void;
  clearTrack(key?: string): void;
  clearAllTrack(): void;
}

export type LeafletInitializationOptions = {
  type: "leaflet";
  selectorID: string;
};

export type AdapterInitializationOptions = LeafletInitializationOptions;
