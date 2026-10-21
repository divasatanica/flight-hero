export interface MapAdapter {
  init(options: AdapterInitializationOptions): void;
  destroy(): void;
}

export type LeafletInitializationOptions = {
  type: "leaflet";
  selectorID: string;
};

export type AdapterInitializationOptions = LeafletInitializationOptions;
