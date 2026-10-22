import type { EventEmitter } from "./event-emitter";
import type { PlaneBasic } from "@flight-hero/contract";

export type FlightClickEvent = { flightId: string };
/** Add new event names and argument tuples here. */
export type FlightMapEvents = {
  flightClick: [event: FlightClickEvent];
  mapClick: [];
  mapLoaded: [];
};

/**
 * Hide map engine details behind this interface and domain events for components and the store.
 * Components will only depend on the adapter APIs instead of map library APIs.
 * This allows us to change low-level map library without changing many application codes.
 */
export interface FlightMapAdapter extends Pick<
  EventEmitter<FlightMapEvents>,
  "on" | "off" | "once"
> {
  /** Initialization may load resources asynchronously; wait for mapLoaded before sending positions. */
  init(options: AdapterInitializationOptions): void;
  destroy(): void;
  updateAircraft(id: string, payload: PlaneBasic): void;
  removeAircraft(id: string): void;
  /** Trail coordinates use [latitude, longitude], matching Leaflet coordinate order. */
  showTrack(points: Array<[number, number]>): void;
  addTrack(key: string, points: Array<[number, number]>): void;
  clearTrack(key?: string): void;
  clearAllTrack(): void;
}

/**
 * We can extend more adapter options with discriminated union types
 */
export type LeafletInitializationOptions = {
  type: "leaflet";
  selectorID: string;
};

// just for example
export type OtherInitializationOptions = {
  type: "other";
  name: string;
};

export type AdapterInitializationOptions =
  LeafletInitializationOptions | OtherInitializationOptions;
