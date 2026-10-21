import type { MapAdapter } from "./base";
import { LeafletAdapter } from "./leaflet";

const ADAPTER_TYPE = "leaflet";

function mapAdapaterFactory(type: string) {
  switch (type) {
    case "leaflet": {
      return new LeafletAdapter();
    }
    default: {
      throw new Error("Invalid adapter type");
    }
  }
}

let adapater: MapAdapter | null = null;

export function getMapAdaptar() {
  if (adapater == null) {
    adapater = mapAdapaterFactory(ADAPTER_TYPE);
  }

  return adapater;
}
