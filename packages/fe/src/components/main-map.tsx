import { useEffect, useRef } from "react";
import "../styles/main-map.css";
import type { MapAdapter } from "../modules/map-adapters/base";
import { getMapAdaptar } from "../modules/map-adapters";

export function MainMap() {
  const mapRef = useRef<MapAdapter | null>(null);

  useEffect(() => {
    mapRef.current = getMapAdaptar();
    mapRef.current.init({
      type: "leaflet",
      selectorID: "map",
    });

    return () => {
      if (mapRef.current == null) {
        return;
      }
      mapRef.current.destroy();
      mapRef.current = null;
    };
  }, []);

  return (
    <div>
      <div id="map"></div>
    </div>
  );
}
