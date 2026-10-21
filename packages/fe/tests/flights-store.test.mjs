import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { useFlightStore } from "../src/store/flights.ts";

const plane = (id, latitude = 0) => ({
  id,
  latitude,
  longitude: 10,
  altitude: 1000,
  heading: 90,
  color: "blue",
  model: "Boeing 737",
});

beforeEach(() =>
  useFlightStore.setState({ positions: {}, selectedFlightId: "" }),
);

test("publishes a complete batch in one positions notification", () => {
  const snapshots = [];
  const unsubscribe = useFlightStore.subscribe(
    (state) => state.positions,
    (positions) => snapshots.push(positions),
  );
  try {
    useFlightStore.getState().updatePosition([plane("A"), plane("B")]);
    assert.equal(snapshots.length, 1);
    assert.deepEqual(Object.keys(snapshots[0]), ["A", "B"]);
    assert.equal(snapshots[0].A.timeline[0].latitude, 0);
    assert.equal(snapshots[0].B.model, "Boeing 737");
  } finally {
    unsubscribe();
  }
});

test("retains the latest 300 points in order without mutating previous state", () => {
  const { updatePosition } = useFlightStore.getState();
  updatePosition([plane("B"), plane("A", -1)]);
  const previous = useFlightStore.getState().positions;
  updatePosition(Array.from({ length: 301 }, (_, index) => plane("A", index)));
  const positions = useFlightStore.getState().positions;
  assert.deepEqual(
    positions.A.timeline.map((point) => point.latitude),
    Array.from({ length: 300 }, (_, index) => index + 1),
  );
  assert.equal(previous.A.timeline.length, 1);
  assert.equal(previous.A.timeline[0].latitude, -1);
  assert.equal(positions.B, previous.B);
});

test("an empty batch does not notify subscribers", () => {
  const previous = useFlightStore.getState();
  useFlightStore.getState().updatePosition([]);
  assert.equal(useFlightStore.getState(), previous);
});
