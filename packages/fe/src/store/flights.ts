import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { PlaneDetailed, PlaneBasic } from "@flight-hero/contract";
import type { FlightMapAdapter } from "../modules/map-adapters/base";

type TimelineKey = "altitude" | "latitude" | "longitude" | "heading";
type FlightLatLng = [number, number];
type FlightPosition = Pick<PlaneBasic, TimelineKey>;
type FlightTimeline = Omit<PlaneBasic, TimelineKey> & {
  timeline: Array<FlightPosition>;
};

interface IFlightStore {
  selectedFlightId: string;
  flights: Record<string, PlaneDetailed>;
  positions: Record<string, FlightTimeline>;

  updateFlight(id: string, detail: PlaneDetailed): void;
  removeFlight(id: string): void;

  updatePosition(id: string, payload: PlaneBasic): void;
  removePosition(id: string): void;

  updateSelectedFlightId(id: string): void;
  clearSelectedFlightId(): void;
}

export const useFlightStore = create<IFlightStore>()(
  subscribeWithSelector((set) => {
    return {
      selectedFlightId: "",
      flights: {},
      positions: {},

      updateFlight(id, detail) {
        return set((state) => {
          const { flights = {} } = state;

          return {
            flights: {
              ...flights,
              [id]: detail,
            },
          };
        });
      },

      removeFlight(id) {
        return set((state) => {
          const { flights } = state;

          const { [id]: _target, ...rest } = flights;

          return {
            flights: rest,
          };
        });
      },

      updatePosition(id, payload) {
        return set((state) => {
          const { positions } = state;

          const existedTimeline = positions[id] || {
            id: payload.id,
            color: payload.color,
            model: payload.model,
            timeline: [],
          };

          // Display polyline with maximum 300 history points
          if (existedTimeline.timeline.length >= 300) {
            existedTimeline.timeline.shift();
          }

          existedTimeline.timeline.push({
            altitude: payload.altitude,
            latitude: payload.latitude,
            longitude: payload.longitude,
            heading: payload.heading,
          });

          return {
            positions: {
              ...positions,
              [id]: {
                ...existedTimeline,
              },
            },
          };
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
