import { lazy, useEffect, useRef, useState } from "react";
import "../styles/main-map.css";
import type { FlightMapAdapter } from "../modules/map-adapters/base";
import { mapAdapaterFactory } from "../modules/map-adapters";
import { ConnectionNotice } from "./connection-notice";
import type { ConnectionStatus } from "../modules/websocket/connection";
import { FlightSocket } from "../modules/websocket/flights";
import { CONFIGS } from "../modules/configs";
import {
  connectFlightIdToMap,
  connnectFlightBasicToAircraftMap,
  createFlightStore,
} from "../store/flights";
import { useStore } from "zustand";

const LazyPlaneDetailDrawer = lazy(async () => ({
  default: (await import("./plane-detail-drawer")).PlaneDetailDrawer,
}));

export function MainMap() {
  const mapRef = useRef<FlightMapAdapter | null>(null);
  const flightBasicSocketRef = useRef<FlightSocket | null>(null);
  const [flightStore] = useState(() => createFlightStore());

  const selectedFlightId = useStore(
    flightStore,
    (state) => state.selectedFlightId,
  );
  const clearSelectedFlightId = useStore(
    flightStore,
    (state) => state.clearSelectedFlightId,
  );
  const [mapLoaded, setMapLoaded] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");

  useEffect(() => {
    flightBasicSocketRef.current = new FlightSocket(
      `${CONFIGS.wsBaseUrl}/planes/basic`,
      {
        onStatusChange: setConnectionStatus,
        onMessage(message) {
          const { type } = message;

          if (type !== "planes") {
            return;
          }

          const { data } = message;

          const store = flightStore.getState();
          store.updatePosition(data);
        },
      },
    );
    mapRef.current = mapAdapaterFactory();
    mapRef.current.on("mapClick", () => {
      const store = flightStore.getState();
      store.clearSelectedFlightId();
    });
    mapRef.current.on("flightClick", ({ flightId }) => {
      const store = flightStore.getState();
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
  }, [flightStore]);

  useEffect(() => {
    // Connect store to map adapter to avoid depending on it directly
    const unsubscribeFlightBasic = connnectFlightBasicToAircraftMap(
      flightStore,
      mapRef.current!,
    );
    const unsubscribeFlightId = connectFlightIdToMap(
      flightStore,
      mapRef.current!,
    );

    return () => {
      unsubscribeFlightBasic();
      unsubscribeFlightId();
    };
  }, [flightStore]);

  return (
    <div>
      <div id="map">
        {mapLoaded ? null : <span>Loading map resources...</span>}
      </div>
      {mapLoaded && <ConnectionNotice status={connectionStatus} />}
      {selectedFlightId !== "" && (
        <LazyPlaneDetailDrawer
          key={selectedFlightId}
          selectedFlightId={selectedFlightId}
          onClose={clearSelectedFlightId}
        />
      )}
    </div>
  );
}
