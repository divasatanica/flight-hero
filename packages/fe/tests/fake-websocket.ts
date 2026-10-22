import { vi } from "vitest";

/** Controllable browser transport boundary; production connection/protocol code stays real. */
export class FakeWebSocket extends EventTarget {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readyState = 0;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
  });

  constructor(readonly url: string) {
    super();
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = 1;
    this.dispatchEvent(new Event("open"));
  }

  message(data: string) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }

  // Only this helper emits a server close; client close merely records shutdown.
  serverClose(code = 1006) {
    this.readyState = 3;
    this.dispatchEvent(new CloseEvent("close", { code }));
  }
}

export function installSocket() {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
}

export function latestSocket() {
  return FakeWebSocket.instances.at(-1)!;
}
