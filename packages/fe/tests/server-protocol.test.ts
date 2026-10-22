// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { createServer } from "@flight-hero/be/server";
import { Simulation } from "@flight-hero/be/simulation";
import { FlightSocket } from "../src/modules/websocket/flights";
import { once } from "node:events";

let server: ReturnType<typeof createServer> | undefined;
let client: FlightSocket | undefined;

afterEach(async () => {
  client?.disconnect();
  if (server) {
    // Terminate remaining clients so server.close cannot wait on an open socket.
    for (const socket of server.clients) socket.terminate();
    await new Promise<void>((resolve, reject) =>
      server!.close((error) => (error ? reject(error) : resolve())),
    );
  }
  vi.unstubAllGlobals();
});

it("handles the actual backend missing-ID error frame and 1008 close without delivering invalid data or throwing", async () => {
  // Use a real localhost transport while exercising the production flight client.
  vi.stubGlobal("WebSocket", WebSocket);
  const simulation = new Simulation();
  simulation.initialize(1);

  // Port 0 lets the OS choose a free port, avoiding local development conflicts.
  server = createServer(0, simulation, 100, 100);
  await once(server, "listening");
  const address = server.address();
  if (typeof address !== "object" || !address)
    throw new Error("Missing server address");

  const delivered = vi.fn();
  const rawFrames: string[] = [];
  let opens = 0;
  const closed = new Promise<number>((resolve) => {
    client = new FlightSocket(
      `ws://127.0.0.1:${address.port}/ws/planes/details`,
      {
        onOpen: () => {
          opens++;
          client!.send({
            type: "subscribe",
            planeId: "nonexistent-test-plane",
          });
        },
        onMessage: delivered,
        onClose: (event) => resolve(event.code),
      },
    );
    client.init();
    // Capture raw frames separately to prove the backend really sent the error.
    client.socket!.addEventListener("message", (event) =>
      rawFrames.push(String(event.data)),
    );
  });

  // Wait for the real close handshake before checking protocol filtering.
  expect(await closed).toBe(1008);
  expect(rawFrames.map((frame) => JSON.parse(frame))).toEqual([
    { type: "error", message: "Plane nonexistent-test-plane not found" },
  ]);

  expect(delivered).not.toHaveBeenCalled();
  expect(client!.socket).toBeNull();
  expect(opens).toBe(1);
});
