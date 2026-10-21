import { WebSocket } from "ws";
import { Simulation } from "./simulation";
import type {
  BasicPlanesMessage,
  PlaneDetailsMessage,
  SubscribeMessage,
} from "@flight-hero/contract";

/**
 * Handle basic planes WebSocket connection
 * Broadcasts all planes at regular intervals
 */
export function handleBasicPlanesConnection(
  ws: WebSocket,
  simulation: Simulation,
  updateInterval: number,
): () => void {
  let intervalId: NodeJS.Timeout | null = null;

  const sendUpdate = () => {
    if (ws.readyState === WebSocket.OPEN) {
      const message: BasicPlanesMessage = {
        type: "planes",
        data: simulation.getAllBasic(),
      };
      ws.send(JSON.stringify(message));
    }
  };

  // Send initial data immediately
  sendUpdate();

  // Set up periodic updates
  intervalId = setInterval(sendUpdate, updateInterval);

  // Cleanup function
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
}

/**
 * Handle detailed plane WebSocket connection
 * Sends updates for a single subscribed plane
 */
export function handlePlaneDetailsConnection(
  ws: WebSocket,
  simulation: Simulation,
  updateInterval: number,
): () => void {
  let subscribedPlaneId: string | null = null;
  let intervalId: NodeJS.Timeout | null = null;

  const sendUpdate = () => {
    if (ws.readyState === WebSocket.OPEN && subscribedPlaneId) {
      const planeData = simulation.getDetailed(subscribedPlaneId);
      if (planeData) {
        const message: PlaneDetailsMessage = {
          type: "plane-details",
          data: planeData,
        };
        ws.send(JSON.stringify(message));
      } else {
        // Plane not found, close connection
        ws.close(1008, "Plane not found");
      }
    }
  };

  // Handle incoming messages
  ws.on("message", (data: Buffer) => {
    try {
      const message: SubscribeMessage = JSON.parse(data.toString());

      if (message.type === "subscribe" && message.planeId) {
        // Validate plane exists
        if (!simulation.hasPlane(message.planeId)) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: `Plane ${message.planeId} not found`,
            }),
          );
          ws.close(1008, "Plane not found");
          return;
        }

        // Clear previous subscription interval
        if (intervalId) {
          clearInterval(intervalId);
        }

        // Subscribe to new plane
        subscribedPlaneId = message.planeId;

        // Send initial data immediately
        sendUpdate();

        // Set up periodic updates
        intervalId = setInterval(sendUpdate, updateInterval);
      } else {
        ws.send(
          JSON.stringify({
            type: "error",
            message:
              "Invalid message format. Expected { type: 'subscribe', planeId: string }",
          }),
        );
      }
    } catch (error) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid JSON message",
        }),
      );
    }
  });

  // Cleanup function
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
}
