import type {
  BasicPlanesMessage,
  PlaneDetailsMessage,
  SubscribeMessage,
} from "@flight-hero/contract";
import { SocketConnection, type SocketConnectionOptions } from "./connection";

type FlightMessage = BasicPlanesMessage | PlaneDetailsMessage;
export interface FlightSocketOptions extends Omit<
  SocketConnectionOptions,
  "onMessage"
> {
  onMessage?: (message: FlightMessage) => void;
}

/** Flight protocol layer: encode/decode JSON and delegate connection, heartbeat, and retry handling to SocketConnection. */
export class FlightSocket {
  readonly connection: SocketConnection;

  constructor(
    readonly url: string,
    options: FlightSocketOptions = {},
  ) {
    this.connection = new SocketConnection(url, {
      ...options,
      onMessage: (event) => {
        let response: unknown;
        try {
          response = JSON.parse(event.data);
        } catch (error) {
          console.error("Invalid JSON response message", error);
          return;
        }
        if (
          typeof response !== "object" ||
          response === null ||
          !("type" in response)
        )
          return;
        // Only filter message types here; payload fields are assumed to follow the shared contract.
        switch (response.type) {
          case "plane-details":
          case "planes":
            options.onMessage?.(response as FlightMessage);
            return;
        }
      },
    });
  }

  get socket(): WebSocket | null {
    return this.connection.socket;
  }

  /** Call after construction; safe to call more than once. */
  init(): void {
    this.connection.connect();
  }

  disconnect(): void {
    this.connection.disconnect();
  }

  send(message: SubscribeMessage): boolean {
    return this.connection.send(JSON.stringify(message));
  }
}
