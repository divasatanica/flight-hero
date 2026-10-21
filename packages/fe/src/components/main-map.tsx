import { useEffect, useRef } from "react";
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

export function MainMap() {
  const mapRef = useRef<FlightMapAdapter | null>(null);
  const flightBasicSocketRef = useRef<FlightSocket | null>(null);
  const store = useFlightStore();

  useEffect(() => {
    mapRef.current = mapAdapaterFactory();
    mapRef.current.init({
      type: "leaflet",
      selectorID: "map",
    });
    mapRef.current.onMapClick(() => {
      store.clearSelectedFlightId();
    });
    mapRef.current.onFlightClick(({ flightId }) => {
      console.log("✈️ Selected:", flightId);
      store.updateSelectedFlightId(flightId);
    });

    return () => {
      if (mapRef.current == null) {
        return;
      }
      mapRef.current.destroy();
      mapRef.current = null;
    };
  }, []);

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

          data.forEach((planeBasic) => {
            store.updatePosition(planeBasic.id, planeBasic);
          });
        },
      },
    );
    flightBasicSocketRef.current.init();

    const unsubscribeFlightBasic = connnectFlightBasicToAircraftMap(
      useFlightStore,
      mapRef.current!,
    );
    const unsubscribeFlightId = connectFlightIdToMap(
      useFlightStore,
      mapRef.current!,
    );

    return () => {
      flightBasicSocketRef.current?.disconnect();
      unsubscribeFlightBasic();
      unsubscribeFlightId();
    };
  }, []);

  return (
    <div>
      <div id="map"></div>
    </div>
  );
}
