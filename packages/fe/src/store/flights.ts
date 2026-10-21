import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { PlaneBasic } from "@flight-hero/contract";
import type { FlightMapAdapter } from "../modules/map-adapters/base";

type TimelineKey = "altitude" | "latitude" | "longitude" | "heading";
type FlightLatLng = [number, number];
type FlightPosition = Pick<PlaneBasic, TimelineKey>;
type FlightTimeline = Omit<PlaneBasic, TimelineKey> & {
  timeline: Array<FlightPosition>;
};

interface IFlightStore {
  selectedFlightId: string;
  positions: Record<string, FlightTimeline>;

  updatePosition(payloads: PlaneBasic[]): void;
  removePosition(id: string): void;

  updateSelectedFlightId(id: string): void;
  clearSelectedFlightId(): void;
}

export const useFlightStore = create<IFlightStore>()(
  subscribeWithSelector((set) => {
    return {
      selectedFlightId: "",
      positions: {},

      updatePosition(payloads) {
        if (payloads.length === 0) return;

        return set((state) => {
          const positions = { ...state.positions };

          for (const payload of payloads) {
            const existing = positions[payload.id];
            const timeline = [
              ...(existing?.timeline ?? []),
              {
                altitude: payload.altitude,
                latitude: payload.latitude,
                longitude: payload.longitude,
                heading: payload.heading,
              },
            ].slice(-300);

            positions[payload.id] = {
              id: payload.id,
              color: existing?.color ?? payload.color,
              model: existing?.model ?? payload.model,
              timeline,
            };
          }

          return { positions };
        });
      },

      removePosition(id) {
        return set((state) => {
          const { positions } = state;

          const { [id]: _position, ...restPosition } = positions;

          return {
            positions: restPosition,
          };
        });
      },

      updateSelectedFlightId(id) {
        return set(() => {
          return {
            selectedFlightId: id,
          };
        });
      },

      clearSelectedFlightId() {
        return set(() => {
          return {
            selectedFlightId: "",
          };
        });
      },
    };
  }),
);

export function connectFlightIdToMap(
  store: typeof useFlightStore,
  mapAdapter: FlightMapAdapter,
) {
  const unsubscribe = store.subscribe(
    (store) => store.selectedFlightId,
    (currSelectedFlightId) => {
      const { positions } = store.getState();

      if (currSelectedFlightId === "") {
        mapAdapter.clearTrack();
      } else {
        const basic = positions[currSelectedFlightId];
        const latLng = basic.timeline.map((item) => [
          item.latitude,
          item.longitude,
        ]) as Array<[number, number]>;
        console.log("flight", currSelectedFlightId, latLng);
        mapAdapter.showTrack(latLng);
      }
    },
  );

  return unsubscribe;
}

export function connnectFlightBasicToAircraftMap(
  store: typeof useFlightStore,
  mapAdapter: FlightMapAdapter,
) {
  return store.subscribe(
    (store) => store.positions,
    (currPositions) => {
      Object.keys(currPositions).forEach((flightId) => {
        const { timeline, ...restBasic } = currPositions[flightId];
        const newestPosition = timeline[timeline.length - 1];

        mapAdapter.updateAircraft(flightId, {
          ...newestPosition,
          ...restBasic,
        });
      });

      const { selectedFlightId } = store.getState();

      if (selectedFlightId === "") {
        return;
      }

      const position = currPositions[selectedFlightId];

      if (position == null) {
        return;
      }

      const { timeline = [] } = position;

      const latLngList = timeline.map((item) => [
        item.latitude,
        item.longitude,
      ]) as FlightLatLng[];

      mapAdapter.clearTrack();

      mapAdapter.showTrack(latLngList);
    },
  );
}
