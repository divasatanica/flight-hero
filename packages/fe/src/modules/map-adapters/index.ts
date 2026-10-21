import { LeafletAdapter } from "./leaflet";

const ADAPTER_TYPE = "leaflet";

export function mapAdapaterFactory() {
  const type = ADAPTER_TYPE;
  switch (type) {
    case "leaflet": {
      return new LeafletAdapter();
    }
    default: {
      throw new Error("Invalid adapter type");
    }
  }
}
