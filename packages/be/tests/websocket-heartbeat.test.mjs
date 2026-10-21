import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { WebSocket } from "ws";
import handlers from "../src/websocket-handlers.ts";
const { handleBasicPlanesConnection, handlePlaneDetailsConnection } = handlers;

class FakeSocket extends EventEmitter {
  readyState = WebSocket.OPEN;
  sent = [];
  send(data) {
    this.sent.push(data);
  }
}

for (const [name, handler] of [
  ["basic", handleBasicPlanesConnection],
  ["details", handlePlaneDetailsConnection],
]) {
  test(`${name}: replies to repeated text pings and removes the listener on cleanup`, () => {
    const socket = new FakeSocket();
    const cleanup = handler(socket, { getAllBasic: () => [] }, 60_000);
    try {
      socket.sent = [];
      socket.emit("message", Buffer.from("ping"));
      socket.emit("message", Buffer.from("ping"));
      assert.deepEqual(socket.sent, ["pong", "pong"]);
      socket.readyState = WebSocket.CLOSING;
      socket.emit("message", Buffer.from("ping"));
      assert.deepEqual(socket.sent, ["pong", "pong"]);
    } finally {
      cleanup();
    }
    assert.equal(socket.listenerCount("message"), 0);
  });
}

test("details: heartbeat does not replace the active subscription or mask invalid JSON", (context) => {
  context.mock.timers.enable({ apis: ["setInterval"] });
  const socket = new FakeSocket();
  const plane = { id: "plane-1" };
  const cleanup = handlePlaneDetailsConnection(
    socket,
    {
      hasPlane: (id) => id === plane.id,
      getDetailed: () => plane,
    },
    100,
  );
  try {
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({ type: "subscribe", planeId: plane.id })),
    );
    socket.emit("message", Buffer.from("ping"));
    context.mock.timers.tick(100);
    assert.deepEqual(socket.sent, [
      JSON.stringify({ type: "plane-details", data: plane }),
      "pong",
      JSON.stringify({ type: "plane-details", data: plane }),
    ]);
    socket.emit("message", Buffer.from("invalid"));
    assert.equal(JSON.parse(socket.sent.at(-1)).type, "error");
  } finally {
    cleanup();
  }
});
