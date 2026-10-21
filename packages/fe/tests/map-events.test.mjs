import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "../src/modules/map-adapters/event-emitter.ts";

test("dispatches payloads to multiple listeners and isolates event names", () => {
  const emitter = new EventEmitter();
  const received = [];
  emitter.on("flightClick", (event) => received.push(event.flightId));
  emitter.on("flightClick", () => received.push("second"));
  emitter.on("mapClick", () => received.push("map"));
  emitter.emit("flightClick", { flightId: "AB123" });
  assert.deepEqual(received, ["AB123", "second"]);
});

test("off and returned cleanup remove only the selected listener", () => {
  const emitter = new EventEmitter();
  let calls = 0;
  const handler = () => calls++;
  emitter.on("mapClick", handler);
  const unsubscribe = emitter.on("mapClick", () => (calls += 10));
  emitter.off("mapClick", handler);
  emitter.emit("mapClick");
  unsubscribe();
  unsubscribe();
  emitter.emit("mapClick");
  assert.equal(calls, 10);
});

test("once removes itself before recursive emissions and can be cancelled", () => {
  const emitter = new EventEmitter();
  let calls = 0;
  emitter.once("mapClick", () => {
    calls++;
    emitter.emit("mapClick");
  });
  emitter.emit("mapClick");
  emitter.once("mapClick", () => calls++)();
  emitter.emit("mapClick");
  assert.equal(calls, 1);
});

test("new listeners wait until the next emission and clear removes all events", () => {
  const emitter = new EventEmitter();
  const received = [];
  emitter.once("mapClick", () =>
    emitter.on("mapClick", () => received.push("new")),
  );
  emitter.emit("mapClick");
  assert.deepEqual(received, []);
  emitter.emit("mapClick");
  assert.deepEqual(received, ["new"]);
  emitter.clear();
  emitter.emit("mapClick");
  assert.deepEqual(received, ["new"]);
});

test("map-loaded carries no arguments and supports independent subscriptions", () => {
  const emitter = new EventEmitter();
  let calls = 0;
  emitter.once("map-loaded", (...args) => {
    assert.deepEqual(args, []);
    calls++;
  });
  emitter.emit("map-loaded");
  emitter.emit("map-loaded");
  assert.equal(calls, 1);
});
