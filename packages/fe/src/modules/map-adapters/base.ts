import type { PlaneBasic } from "@flight-hero/contract";

export interface MapAdapter {
  init(options: AdapterInitializationOptions): void;
  destroy(): void;
}

export interface FlightMapAdapter {
  updateAircraft(id: string, payload: PlaneBasic): void;
  removeAircraft(id: string): void;
  showTrack(points: Array<[number, number]>): void;
  addTrack(points: Array<[number, number]>): void;
  clearTrack(): void;
}

export type LeafletInitializationOptions = {
  type: "leaflet";
  selectorID: string;
};

export type AdapterInitializationOptions = LeafletInitializationOptions;
