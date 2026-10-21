export type EventListener<Args extends unknown[]> = (...args: Args) => void;

/** Synchronous, typed events. Listeners added during emission run next time. */
export class EventEmitter<Events extends { [K in keyof Events]: unknown[] }> {
  private listeners: { [K in keyof Events]?: Set<EventListener<Events[K]>> } =
    {};

  on<K extends keyof Events>(
    event: K,
    listener: EventListener<Events[K]>,
  ): () => void {
    const listeners = (this.listeners[event] ??= new Set());
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  off<K extends keyof Events>(
    event: K,
    listener: EventListener<Events[K]>,
  ): void {
    this.listeners[event]?.delete(listener);
  }

  once<K extends keyof Events>(
    event: K,
    listener: EventListener<Events[K]>,
  ): () => void {
    const unsubscribe = this.on(event, (...args) => {
      unsubscribe();
      listener(...args);
    });
    return unsubscribe;
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]): void {
    for (const listener of [...(this.listeners[event] ?? [])]) {
      listener(...args);
    }
  }

  clear(): void {
    for (const listeners of Object.values(this.listeners)) {
      (listeners as Set<unknown>).clear();
    }
  }
}
