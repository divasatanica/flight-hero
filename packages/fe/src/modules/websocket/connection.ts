export interface SocketConnectionOptions {
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  reconnectDelay?: number;
  connectTimeout?: number;
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
}

/** Transport lifecycle only. The server must answer text "ping" with "pong". */
export class SocketConnection {
  private currentSocket: WebSocket | null = null;
  private stopped = true;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private heartbeatTimer?: ReturnType<typeof setTimeout>;
  private timeoutTimer?: ReturnType<typeof setTimeout>;
  private removeListeners?: () => void;
  private readonly options: Required<
    Pick<
      SocketConnectionOptions,
      | "heartbeatInterval"
      | "heartbeatTimeout"
      | "reconnectDelay"
      | "connectTimeout"
    >
  > &
    SocketConnectionOptions;

  readonly url: string;

  constructor(url: string, options: SocketConnectionOptions = {}) {
    this.url = url;
    this.options = {
      heartbeatInterval: 15_000,
      heartbeatTimeout: 5_000,
      reconnectDelay: 2_000,
      connectTimeout: 10_000,
      ...options,
    };
    for (const key of [
      "heartbeatInterval",
      "heartbeatTimeout",
      "reconnectDelay",
      "connectTimeout",
    ] as const) {
      if (!Number.isFinite(this.options[key]) || this.options[key] <= 0) {
        throw new RangeError(`${key} must be a positive finite number`);
      }
    }
  }

  get socket(): WebSocket | null {
    return this.currentSocket;
  }

  connect(): void {
    if (this.currentSocket || this.reconnectTimer !== undefined) return;
    this.stopped = false;
    // Invalid URLs throw synchronously so callers can fix configuration errors.
    const socket = new WebSocket(this.url);
    this.currentSocket = socket;

    const onOpen = (event: Event) => {
      clearTimeout(this.timeoutTimer);
      this.scheduleHeartbeat(socket);
      this.options.onOpen?.(event);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.data === "pong") {
        clearTimeout(this.timeoutTimer);
        this.scheduleHeartbeat(socket);
        return;
      }
      this.options.onMessage?.(event);
    };
    const onClose = (event: CloseEvent) => {
      // 1008 means an invalid path/subscription; retries cannot fix it.
      if (event.code === 1008) this.stopped = true;
      this.releaseSocket();
      this.scheduleReconnect();
      this.options.onClose?.(event);
    };
    const onError = (event: Event) => {
      // Browser WebSockets emit close after error; retry from that single path.
      this.options.onError?.(event);
    };
    socket.addEventListener("open", onOpen);
    socket.addEventListener("message", onMessage);
    socket.addEventListener("close", onClose);
    socket.addEventListener("error", onError);
    this.removeListeners = () => {
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("close", onClose);
      socket.removeEventListener("error", onError);
    };
    this.timeoutTimer = setTimeout(
      () => this.retry(socket),
      this.options.connectTimeout,
    );
  }

  disconnect(): void {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    const socket = this.currentSocket;
    this.releaseSocket();
    socket?.close(1000, "Client disconnected");
  }

  /** No queue: callers can resend subscriptions in onOpen after reconnection. */
  send(data: string): boolean {
    if (this.currentSocket?.readyState !== WebSocket.OPEN) return false;
    this.currentSocket.send(data);
    return true;
  }

  private scheduleHeartbeat(socket: WebSocket): void {
    clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = setTimeout(() => {
      if (socket !== this.currentSocket || socket.readyState !== WebSocket.OPEN)
        return;
      this.timeoutTimer = setTimeout(
        () => this.retry(socket),
        this.options.heartbeatTimeout,
      );
      try {
        socket.send("ping");
      } catch {
        this.retry(socket);
      }
    }, this.options.heartbeatInterval);
  }

  private retry(socket: WebSocket): void {
    if (socket !== this.currentSocket) return;
    // Do not wait for the close handshake on a dead connection.
    this.releaseSocket();
    socket.close(4000, "Connection timed out");
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer !== undefined) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, this.options.reconnectDelay);
  }

  private releaseSocket(): void {
    clearTimeout(this.heartbeatTimer);
    clearTimeout(this.timeoutTimer);
    this.removeListeners?.();
    this.removeListeners = undefined;
    this.currentSocket = null;
  }
}
