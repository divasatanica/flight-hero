import { expect, it, vi } from "vitest";
import {
  createFlightStore,
  connectFlightIdToMap,
  connnectFlightBasicToAircraftMap,
} from "../src/store/flights";
import type { FlightMapAdapter } from "../src/modules/map-adapters/base";
import type { PlaneBasic } from "@flight-hero/contract";

const plane: PlaneBasic = {
  id: "A",
  latitude: 10,
  longitude: 20,
  altitude: 1000,
  heading: 90,
  model: "Boeing 777",
  color: "red",
};

// Observe map output without creating Leaflet layers or requiring a DOM map.
function adapter(): FlightMapAdapter {
  return {
    init: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    updateAircraft: vi.fn(),
    removeAircraft: vi.fn(),
    showTrack: vi.fn(),
    addTrack: vi.fn(),
    clearTrack: vi.fn(),
    clearAllTrack: vi.fn(),
  };
}

it("isolates store instances", () => {
  const a = createFlightStore();
  const b = createFlightStore();
  a.getState().updatePosition([plane]);

  expect(b.getState().positions).toEqual({});
});

it("appends samples while retaining original aircraft metadata", () => {
  const store = createFlightStore();
  store.getState().updatePosition([plane]);
  const previous = store.getState().positions;
  store
    .getState()
    .updatePosition([
      { ...plane, latitude: 11, model: "changed", color: "blue" },
    ]);

  expect(store.getState().positions.A).toMatchObject({
    model: plane.model,
    color: plane.color,
    timeline: [{ latitude: 10 }, { latitude: 11 }],
  });
  // Previously published state must remain unchanged for existing subscribers.
  expect(previous.A.timeline).toHaveLength(1);
});

it("retains only the most recent 300 samples in arrival order", () => {
  const store = createFlightStore();
  store
    .getState()
    .updatePosition(
      Array.from({ length: 301 }, (_, i) => ({ ...plane, latitude: i })),
    );

  // Cross the limit by one sample to check both the cutoff and retained order.
  const samples = store.getState().positions.A.timeline;

  expect(samples).toHaveLength(300);
  expect(samples[0].latitude).toBe(1);
  expect(samples.at(-1)?.latitude).toBe(300);
});

it("does not notify position subscribers for an empty batch", () => {
  const store = createFlightStore();
  const listener = vi.fn();
  store.subscribe(listener);
  store.getState().updatePosition([]);

  expect(listener).not.toHaveBeenCalled();
});

it("removes only the requested aircraft", () => {
  const store = createFlightStore();
  store.getState().updatePosition([plane, { ...plane, id: "B" }]);
  store.getState().removePosition("A");

  expect(Object.keys(store.getState().positions)).toEqual(["B"]);
});

it("renders latest positions and updates the selected trail as samples arrive", () => {
  const store = createFlightStore();
  const map = adapter();
  const stop = connnectFlightBasicToAircraftMap(store, map);
  store.getState().updatePosition([plane]);
  store.getState().updateSelectedFlightId("A");
  store.getState().updatePosition([{ ...plane, latitude: 11 }]);

  expect(map.updateAircraft).toHaveBeenLastCalledWith("A", {
    ...plane,
    latitude: 11,
  });
  expect(map.showTrack).toHaveBeenLastCalledWith([
    [10, 20],
    [11, 20],
  ]);
  stop();
});

it("switches trails immediately and clears the trail when deselected", () => {
  const store = createFlightStore();
  const map = adapter();
  store.getState().updatePosition([plane, { ...plane, id: "B", latitude: 30 }]);
  const stop = connectFlightIdToMap(store, map);
  store.getState().updateSelectedFlightId("A");

  expect(map.showTrack).toHaveBeenLastCalledWith([[10, 20]]);

  // No position update follows selection: the trail must switch immediately.
  store.getState().updateSelectedFlightId("B");

  expect(map.showTrack).toHaveBeenLastCalledWith([[30, 20]]);

  store.getState().clearSelectedFlightId();

  expect(map.clearTrack).toHaveBeenCalled();

  stop();
});

it("stops map updates after unsubscribing", () => {
  const store = createFlightStore();
  const map = adapter();
  const stopPositions = connnectFlightBasicToAircraftMap(store, map);
  const stopSelection = connectFlightIdToMap(store, map);

  // Model unmount cleanup before publishing either kind of state change.
  stopPositions();
  stopSelection();
  store.getState().updatePosition([plane]);
  store.getState().updateSelectedFlightId("A");

  expect(map.updateAircraft).not.toHaveBeenCalled();
  expect(map.showTrack).not.toHaveBeenCalled();
});
