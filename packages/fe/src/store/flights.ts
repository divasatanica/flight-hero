import { create } from "zustand";
import type { PlaneDetailed, PlaneBasic } from "@flight-hero/contract";

interface IFlightStore {
  tracks: Record<string, Array<[number, number]>>;
  flights: Record<string, PlaneDetailed>;
  positions: Record<string, PlaneBasic>;

  updateFlight(id: string, detail: PlaneDetailed): void;
  removeFlight(id: string): void;

  updatePosition(id: string, payload: PlaneBasic): void;
  removePosition(id: string): void;
}

export const useFlightStore = create<IFlightStore>((set) => {
  return {
    tracks: {},
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
        const { positions, tracks } = state;

        const existedTrack = tracks[id] || [];

        existedTrack.push([payload.latitude, payload.longitude]);

        return {
          positions: {
            ...positions,
            [id]: payload,
          },
          tracks: {
            ...tracks,
            [id]: [...existedTrack],
          },
        };
      });
    },

    removePosition(id) {
      return set((state) => {
        const { positions, tracks } = state;

        const { [id]: _position, ...restPosition } = positions;
        const { [id]: _tracks, ...restTracks } = tracks;

        return {
          positions: restPosition,
          tracks: restTracks,
        };
      });
    },
  };
});
