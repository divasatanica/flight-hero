import type { PlaneBasic } from "@flight-hero/contract";

export type FlightClickEvent = { flightId: string };
export type FlightClickHandler = (event: FlightClickEvent) => void;
export interface FlightMapAdapter {
  init(options: AdapterInitializationOptions): void;
  destroy(): void;
  updateAircraft(id: string, payload: PlaneBasic): void;
  removeAircraft(id: string): void;
  showTrack(points: Array<[number, number]>): void;
  addTrack(key: string, points: Array<[number, number]>): void;
  clearTrack(key?: string): void;
  clearAllTrack(): void;
  onFlightClick(handler: FlightClickHandler): () => void;
  onMapClick(handler: () => void): () => void;
}

export type LeafletInitializationOptions = {
  type: "leaflet";
  selectorID: string;
};

export type AdapterInitializationOptions = LeafletInitializationOptions;
