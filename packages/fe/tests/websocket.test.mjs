import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { SocketConnection } from "../src/modules/websocket/connection.ts";

const { EventTarget, Event, MessageEvent } = globalThis;

class FakeSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static instances = [];
  readyState = 0;
  sent = [];
  constructor(url) {
    super();
    this.url = url;
    FakeSocket.instances.push(this);
  }
  open() {
    this.readyState = 1;
    this.dispatchEvent(new Event("open"));
  }
  message(data) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
  send(data) {
    assert.equal(this.readyState, 1);
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.dispatchEvent(new Event("close"));
  }
}
let connection;
const originalSocket = globalThis.WebSocket;
beforeEach(() => {
  FakeSocket.instances = [];
  globalThis.WebSocket = FakeSocket;
  mock.timers.enable({ apis: ["setTimeout"] });
});
afterEach(() => {
  connection?.disconnect();
  mock.timers.reset();
  globalThis.WebSocket = originalSocket;
});
function create(options = {}) {
  connection = new SocketConnection("ws://localhost/test", {
    heartbeatInterval: 100,
    heartbeatTimeout: 50,
    reconnectDelay: 10,
    connectTimeout: 200,
    ...options,
  });
  connection.connect();
  return FakeSocket.instances.at(-1);
}
test("connect is idempotent and send is guarded until open", () => {
  const ws = create();
  connection.connect();
  assert.equal(FakeSocket.instances.length, 1);
  assert.equal(connection.send("data"), false);
  ws.open();
  assert.equal(connection.send("data"), true);
  assert.deepEqual(ws.sent, ["data"]);
});
test("pong keeps the connection alive and is hidden from business messages", () => {
  const messages = [];
  const ws = create({ onMessage: (event) => messages.push(event.data) });
  ws.open();
  mock.timers.tick(100);
  assert.deepEqual(ws.sent, ["ping"]);
  ws.message("pong");
  ws.message("business");
  mock.timers.tick(50);
  assert.equal(ws.readyState, 1);
  assert.deepEqual(messages, ["business"]);
});
test("missing pong replaces the dead connection even without a close event", () => {
  const ws = create();
  ws.open();
  ws.close = () => {
    ws.readyState = 2;
  };
  mock.timers.tick(100);
  mock.timers.tick(50);
  mock.timers.tick(10);
  assert.equal(FakeSocket.instances.length, 2);
  ws.message("pong");
  assert.equal(connection.socket, FakeSocket.instances[1]);
});
test("disconnect cancels a pending reconnect and allows an explicit restart", () => {
  const ws = create();
  ws.close();
  connection.disconnect();
  mock.timers.tick(1000);
  assert.equal(FakeSocket.instances.length, 1);
  connection.connect();
  assert.equal(FakeSocket.instances.length, 2);
});
test("disconnect stops heartbeat timers", () => {
  const ws = create();
  ws.open();
  connection.disconnect();
  mock.timers.tick(1000);
  assert.deepEqual(ws.sent, []);
  assert.equal(FakeSocket.instances.length, 1);
});
test("a connection stuck connecting is retried", () => {
  create();
  mock.timers.tick(200);
  mock.timers.tick(10);
  assert.equal(FakeSocket.instances.length, 2);
});
test("server policy rejection does not retry", () => {
  const ws = create();
  ws.dispatchEvent(Object.assign(new Event("close"), { code: 1008 }));
  mock.timers.tick(1000);
  assert.equal(FakeSocket.instances.length, 1);
});

test("an error followed by close schedules only one reconnect", () => {
  let errors = 0;
  const ws = create({
    onError: () => {
      errors += 1;
    },
  });
  ws.dispatchEvent(new Event("error"));
  ws.close();
  mock.timers.tick(10);
  assert.equal(errors, 1);
  assert.equal(FakeSocket.instances.length, 2);
});
