import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PlaneDetailDrawer } from "../src/components/plane-detail-drawer";
import { MainMap } from "../src/components/main-map";
import { EventEmitter } from "../src/modules/map-adapters/event-emitter";
import type { FlightMapEvents } from "../src/modules/map-adapters/base";
import { installSocket, latestSocket, FakeWebSocket } from "./fake-websocket";

// Replace the map engine boundary; keep real store and WebSocket lifecycle code.
const boundary = vi.hoisted(() => ({ map: null as unknown }));
vi.mock("../src/modules/map-adapters", () => ({
  mapAdapaterFactory: () => boundary.map,
}));
class TestMap extends EventEmitter<FlightMapEvents> {
  init = vi.fn();
  destroy = vi.fn(() => this.clear());
  updateAircraft = vi.fn();
  showTrack = vi.fn();
  clearTrack = vi.fn();
}

let map: TestMap;

beforeEach(() => {
  installSocket();
  map = new TestMap();
  boundary.map = map;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function detail(id: string, flightNumber = "FH100") {
  return JSON.stringify({
    type: "plane-details",
    data: {
      id,
      flightNumber,
      estimatedArrival: 0,
      origin: { airport: "DXB", city: "Dubai" },
    },
  });
}

it("subscribes on every open including reconnect and ignores another aircraft detail", () => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
  const view = render(
    <PlaneDetailDrawer selectedFlightId="A" onClose={vi.fn()} />,
  );
  const socket = latestSocket();
  act(() => socket.open());

  expect(socket.send).toHaveBeenCalledWith(
    '{"type":"subscribe","planeId":"A"}',
  );
  act(() => socket.message(detail("B", "WRONG")));

  expect(screen.queryByText("WRONG")).not.toBeInTheDocument();
  act(() => socket.message(detail("A")));

  expect(screen.getByText("FH100", { selector: "p" })).toBeInTheDocument();
  expect(screen.getByText("1970-01-01T00:00:00.000Z")).toBeInTheDocument();
  expect(screen.getByText("Dubai")).toBeInTheDocument();

  // Exercise an actual reconnect rather than emitting open twice on one socket.
  act(() => socket.serverClose(1006));
  act(() => vi.advanceTimersByTime(2500));

  expect(latestSocket()).not.toBe(socket);
  act(() => latestSocket().open());

  expect(latestSocket().send).toHaveBeenCalledWith(
    '{"type":"subscribe","planeId":"A"}',
  );
  view.unmount();

  expect(latestSocket().close).toHaveBeenCalled();
});

it("disconnects the old subscription when the selected aircraft changes", () => {
  const view = render(
    <PlaneDetailDrawer key="A" selectedFlightId="A" onClose={vi.fn()} />,
  );
  const old = latestSocket();

  // MainMap keys the drawer by aircraft ID, so selection replaces its instance.
  view.rerender(
    <PlaneDetailDrawer key="B" selectedFlightId="B" onClose={vi.fn()} />,
  );
  expect(old.close).toHaveBeenCalled();
  act(() => latestSocket().open());

  expect(latestSocket().send).toHaveBeenCalledWith(
    '{"type":"subscribe","planeId":"B"}',
  );
});

it("closes the dialog through its accessible close button", async () => {
  const onClose = vi.fn();
  render(<PlaneDetailDrawer selectedFlightId="A" onClose={onClose} />);
  await userEvent.click(
    screen.getByRole("button", { name: "Close aircraft details" }),
  );
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("survives StrictMode setup-cleanup-setup without treating cleanup as a user close", async () => {
  const onClose = vi.fn();
  const view = render(
    <StrictMode>
      <PlaneDetailDrawer selectedFlightId="A" onClose={onClose} />
    </StrictMode>,
  );
  expect(screen.getByRole("dialog")).toBeInTheDocument();

  // Flush the queued close from StrictMode cleanup after setup reopens the dialog.
  await act(async () => {});

  expect(onClose).not.toHaveBeenCalled();

  view.unmount();

  expect(
    FakeWebSocket.instances.every((s) => s.close.mock.calls.length > 0),
  ).toBe(true);
});

it("waits for map resources before connecting and cleans up map and socket on unmount", () => {
  const view = render(<MainMap />);

  expect(screen.getByText("Loading map resources...")).toBeInTheDocument();
  expect(FakeWebSocket.instances).toHaveLength(0);

  // The position stream starts only once map resources are ready to render it.
  act(() => map.emit("mapLoaded"));

  expect(FakeWebSocket.instances).toHaveLength(1);
  expect(
    screen.queryByText("Loading map resources..."),
  ).not.toBeInTheDocument();
  view.unmount();

  expect(map.destroy).toHaveBeenCalledTimes(1);
  expect(latestSocket().close).toHaveBeenCalled();
});

it("connects real store and protocol to map updates and clears selection on map click", async () => {
  render(<MainMap />);
  act(() => map.emit("mapLoaded"));
  const basic = latestSocket();
  act(() => {
    basic.open();
    basic.message(
      JSON.stringify({
        type: "planes",
        data: [
          {
            id: "A",
            latitude: 10,
            longitude: 20,
            altitude: 100,
            heading: 0,
            color: "red",
            model: "Boeing 777",
          },
        ],
      }),
    );
  });
  expect(map.updateAircraft).toHaveBeenCalledWith(
    "A",
    expect.objectContaining({ latitude: 10 }),
  );
  act(() => map.emit("flightClick", { flightId: "A" }));

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  const details = latestSocket();

  // Clicking the map clears selection and releases the drawer-owned connection.
  act(() => map.emit("mapClick"));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(details.close).toHaveBeenCalled();
  expect(map.clearTrack).toHaveBeenCalled();
});
