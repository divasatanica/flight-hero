import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SocketConnection } from "../src/modules/websocket/connection";
import { FakeWebSocket, installSocket, latestSocket } from "./fake-websocket";

describe("SocketConnection", () => {
  let connection: SocketConnection;

  beforeEach(() => {
    vi.useFakeTimers();
    installSocket();
    // Fix jitter at its 500ms minimum so reconnect boundaries are deterministic.
    vi.spyOn(Math, "random").mockReturnValue(0);
    connection = new SocketConnection("ws://localhost/test", {
      heartbeatInterval: 100,
      heartbeatTimeout: 20,
      connectTimeout: 50,
      reconnectDelay: 10,
    });
  });

  afterEach(() => {
    connection.disconnect();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not create duplicate connections", () => {
    connection.connect();
    connection.connect();

    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("only sends while open", () => {
    expect(connection.send("x")).toBe(false);

    connection.connect();

    expect(connection.send("x")).toBe(false);

    latestSocket().open();

    expect(connection.send("x")).toBe(true);
    expect(latestSocket().send).toHaveBeenCalledWith("x");
  });

  it("retries an opening handshake timeout", () => {
    connection.connect();
    const old = latestSocket();

    // No open event arrives before the configured handshake deadline.
    vi.advanceTimersByTime(50);

    expect(old.close).toHaveBeenCalledWith(4000, expect.any(String));

    // Initial retry delay: 10ms base + 500ms fixed jitter.
    vi.advanceTimersByTime(510);

    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("consumes pong and schedules the next heartbeat", () => {
    const onMessage = vi.fn();
    connection = new SocketConnection("ws://localhost", {
      heartbeatInterval: 100,
      heartbeatTimeout: 20,
      onMessage,
    });
    connection.connect();
    const socket = latestSocket();
    socket.open();
    vi.advanceTimersByTime(100);

    expect(socket.send).toHaveBeenCalledWith("ping");

    // A pong belongs to the transport and must not reach the flight JSON parser.
    socket.message("pong");
    vi.advanceTimersByTime(100);

    expect(socket.send).toHaveBeenCalledTimes(2);
    expect(onMessage).not.toHaveBeenCalled();
    expect(socket.close).not.toHaveBeenCalled();
  });

  it("retries when pong times out", () => {
    connection.connect();
    latestSocket().open();
    // Wait through both the 100ms ping interval and the 20ms pong deadline.
    vi.advanceTimersByTime(120);

    expect(latestSocket().close).toHaveBeenCalled();

    vi.advanceTimersByTime(510);

    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("recovers when sending a heartbeat throws", () => {
    connection.connect();
    latestSocket().open();
    latestSocket().send.mockImplementation(() => {
      throw new Error("closed");
    });
    expect(() => vi.advanceTimersByTime(100)).not.toThrow();

    vi.advanceTimersByTime(510);

    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("backs off exponentially and resets after a successful connection", () => {
    connection.connect();
    latestSocket().serverClose();
    vi.advanceTimersByTime(510);
    latestSocket().serverClose();

    // The second retry needs 20ms base + 500ms jitter; stop 1ms short.
    vi.advanceTimersByTime(519);

    expect(FakeWebSocket.instances).toHaveLength(2);

    vi.advanceTimersByTime(1);

    expect(FakeWebSocket.instances).toHaveLength(3);

    // A successful open resets backoff, so the next retry needs only 510ms.
    latestSocket().open();
    latestSocket().serverClose();
    vi.advanceTimersByTime(510);

    expect(FakeWebSocket.instances).toHaveLength(4);
  });

  it("does not reconnect after a policy rejection (1008)", () => {
    connection.connect();
    latestSocket().open();
    latestSocket().serverClose(1008);
    vi.advanceTimersByTime(120000);

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels a pending reconnect on explicit disconnect", () => {
    connection.connect();
    latestSocket().serverClose();
    connection.disconnect();
    vi.advanceTimersByTime(120000);

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("removes listeners and timers and permits a later explicit connect", () => {
    connection.connect();
    const old = latestSocket();
    old.open();
    connection.disconnect();

    expect(vi.getTimerCount()).toBe(0);

    connection.connect();
    const current = latestSocket();
    current.open();

    // Late events from the released socket must not disturb the new connection.
    old.serverClose();
    old.message("pong");

    expect(connection.socket).toBe(current);
  });

  it("reconnects only once when error is followed by close", () => {
    connection.connect();
    latestSocket().dispatchEvent(new Event("error"));
    latestSocket().serverClose();
    vi.advanceTimersByTime(510);

    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it.each([0, -1, Infinity, NaN])(
    "rejects invalid timing option %s",
    (value) => {
      expect(
        () =>
          new SocketConnection("ws://localhost", { heartbeatInterval: value }),
      ).toThrow(RangeError);
    },
  );
});
