import { lazy, useEffect, useRef, useState } from "react";
import "../styles/main-map.css";
import type { FlightMapAdapter } from "../modules/map-adapters/base";
import { mapAdapaterFactory } from "../modules/map-adapters";
import { FlightSocket } from "../modules/websocket/flights";
import { CONFIGS } from "../modules/configs";
import {
  connectFlightIdToMap,
  connnectFlightBasicToAircraftMap,
  useFlightStore,
} from "../store/flights";

const LazyPlaneDetailDrawer = lazy(async () => ({
  default: (await import("./plane-detail-drawer")).PlaneDetailDrawer,
}));

export function MainMap() {
  const mapRef = useRef<FlightMapAdapter | null>(null);
  const flightBasicSocketRef = useRef<FlightSocket | null>(null);
  const store = useFlightStore();
  const selectedFlightId = store.selectedFlightId;
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    flightBasicSocketRef.current = new FlightSocket(
      `${CONFIGS.wsBaseUrl}/planes/basic`,
      {
        onMessage(message) {
          const { type } = message;

          if (type !== "planes") {
            return;
          }

          const { data } = message;

          store.updatePosition(data);
        },
      },
    );
    mapRef.current = mapAdapaterFactory();
    mapRef.current.on("mapClick", () => {
      store.clearSelectedFlightId();
    });
    mapRef.current.on("flightClick", ({ flightId }) => {
      console.log("✈️ Selected:", flightId);
      store.updateSelectedFlightId(flightId);
    });
    // Start the position stream after map resources load so store updates can safely render aircraft.
    mapRef.current.on("mapLoaded", () => {
      flightBasicSocketRef.current!.init();
      setMapLoaded(true);
    });

    mapRef.current.init({
      type: "leaflet",
      selectorID: "map",
    });

    return () => {
      mapRef.current?.destroy();
      mapRef.current = null;
      flightBasicSocketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    const unsubscribeFlightBasic = connnectFlightBasicToAircraftMap(
      useFlightStore,
      mapRef.current!,
    );
    const unsubscribeFlightId = connectFlightIdToMap(
      useFlightStore,
      mapRef.current!,
    );

    return () => {
      unsubscribeFlightBasic();
      unsubscribeFlightId();
    };
  }, []);

  return (
    <div>
      <div id="map">
        {mapLoaded ? null : <span>Loading map resources...</span>}
      </div>
      {selectedFlightId !== "" && (
        <LazyPlaneDetailDrawer
          key={selectedFlightId}
          selectedFlightId={selectedFlightId}
          onClose={store.clearSelectedFlightId}
        />
      )}
    </div>
  );
}
