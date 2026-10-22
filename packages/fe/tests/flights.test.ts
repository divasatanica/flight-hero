import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FlightSocket } from "../src/modules/websocket/flights";
import { FakeWebSocket, installSocket, latestSocket } from "./fake-websocket";

let client: FlightSocket;
const onMessage = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  installSocket();
  onMessage.mockClear();
  client = new FlightSocket("ws://localhost", { onMessage });
  client.init();
  latestSocket().open();
});

afterEach(() => {
  client.disconnect();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("dispatches recognized flight messages", () => {
  const message = { type: "planes", data: [] };
  latestSocket().message(JSON.stringify(message));

  expect(onMessage).toHaveBeenCalledWith(message);
});

it("ignores malformed JSON and unknown message shapes without stopping subsequent updates", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  for (const data of ["{", "null", "42", "{}", '{"type":"other"}'])
    latestSocket().message(data);

  expect(onMessage).not.toHaveBeenCalled();

  // Invalid input must not prevent a later valid frame from being delivered.
  latestSocket().message('{"type":"planes","data":[]}');

  expect(onMessage).toHaveBeenCalledTimes(1);
});

it("encodes subscription messages", () => {
  expect(client.send({ type: "subscribe", planeId: "missing" })).toBe(true);
  expect(latestSocket().send).toHaveBeenCalledWith(
    '{"type":"subscribe","planeId":"missing"}',
  );
});

it("discards the nonexistent-plane error frame without throwing, then stops retries on server close 1008", () => {
  client.send({ type: "subscribe", planeId: "missing" });

  expect(() =>
    latestSocket().message(
      '{"type":"error","message":"Plane missing not found"}',
    ),
  ).not.toThrow();
  expect(onMessage).not.toHaveBeenCalled();

  // The frame is ignored, but the close code independently controls retry policy.
  latestSocket().serverClose(1008);
  vi.advanceTimersByTime(120000);

  expect(FakeWebSocket.instances).toHaveLength(1);
});

it("discards an error frame but still reconnects and resubscribes after a transient close", () => {
  client.disconnect();
  vi.spyOn(Math, "random").mockReturnValue(0);
  client = new FlightSocket("ws://localhost", {
    onMessage,
    onOpen: () => {
      client.send({ type: "subscribe", planeId: "A" });
    },
  });
  client.init();
  latestSocket().open();
  latestSocket().message('{"type":"error","message":"temporary failure"}');
  latestSocket().serverClose(1011);

  // Default reconnect delay: 2000ms + 500ms fixed jitter.
  vi.advanceTimersByTime(2500);

  // Includes the initial client from beforeEach, which this scenario disconnects.
  expect(FakeWebSocket.instances).toHaveLength(3);

  latestSocket().open();

  expect(latestSocket().send).toHaveBeenCalledWith(
    '{"type":"subscribe","planeId":"A"}',
  );
  expect(onMessage).not.toHaveBeenCalled();
});
