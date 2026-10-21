import { WebSocketServer, WebSocket } from "ws";
import { Simulation } from "./simulation";
import {
  handleBasicPlanesConnection,
  handlePlaneDetailsConnection,
} from "./websocket-handlers";

/**
 * Create and configure WebSocket server
 */
export function createServer(
  port: number,
  simulation: Simulation,
  basicUpdateInterval: number,
  detailedUpdateInterval: number,
): WebSocketServer {
  const wss = new WebSocketServer({ port });

  // Update simulation on regular interval
  const simulationInterval = setInterval(() => {
    simulation.update();
  }, 100); // Update simulation every 100ms for smooth movement

  // Track cleanup functions for all connections
  const cleanupFunctions = new Map<WebSocket, () => void>();

  wss.on("connection", (ws: WebSocket, req: { url?: string }) => {
    const path = req.url;

    // Route based on path
    if (path === "/ws/planes/basic") {
      const cleanup = handleBasicPlanesConnection(
        ws,
        simulation,
        basicUpdateInterval,
      );
      cleanupFunctions.set(ws, cleanup);
    } else if (path === "/ws/planes/details") {
      const cleanup = handlePlaneDetailsConnection(
        ws,
        simulation,
        detailedUpdateInterval,
      );
      cleanupFunctions.set(ws, cleanup);
    } else {
      ws.close(1008, "Invalid path");
      return;
    }

    // Handle client disconnect
    ws.on("close", () => {
      const cleanup = cleanupFunctions.get(ws);
      if (cleanup) {
        cleanup();
        cleanupFunctions.delete(ws);
      }
    });

    // Handle errors
    ws.on("error", (error: Error) => {
      console.error("WebSocket error:", error);
      const cleanup = cleanupFunctions.get(ws);
      if (cleanup) {
        cleanup();
        cleanupFunctions.delete(ws);
      }
    });
  });

  // Cleanup on server close
  wss.on("close", () => {
    clearInterval(simulationInterval);
    cleanupFunctions.forEach((cleanup) => cleanup());
    cleanupFunctions.clear();
  });

  return wss;
}
