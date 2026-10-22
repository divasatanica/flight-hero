import { useEffect, useId, useRef, useState } from "react";
import type { ConnectionStatus } from "../modules/websocket/connection";

const labels: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting… Positions may be outdated.",
  disconnected: "Disconnected. Reload to connect again.",
};

export function ConnectionNotice({ status }: { status: ConnectionStatus }) {
  const toast = useRef<HTMLDivElement>(null);
  const toastId = useId();
  const [notice, setNotice] = useState({
    status,
    wasLive: status === "live",
    restored: false,
  });
  if (notice.status !== status) {
    setNotice({
      status,
      wasLive: notice.wasLive || status === "live",
      restored: status === "live" && notice.wasLive,
    });
  }
  const restored = notice.restored && status === "live";

  useEffect(() => {
    if (!restored) return;
    const timer = setTimeout(
      () => setNotice((current) => ({ ...current, restored: false })),
      4000,
    );
    return () => clearTimeout(timer);
  }, [restored]);

  useEffect(() => {
    const element = toast.current;
    if (!restored || !element || !("popover" in HTMLElement.prototype)) return;
    element.showPopover();
    return () => {
      if (element.matches(":popover-open")) element.hidePopover();
    };
  }, [restored]);

  return (
    <>
      <div className="connection-status" data-state={status} role="status">
        <span className="connection-status__dot" aria-hidden="true" />
        {labels[status]}
      </div>
      {restored && (
        <div
          ref={toast}
          id={toastId}
          popover="manual"
          className="connection-toast"
          role="status"
        >
          Connection restored
          <button
            type="button"
            aria-label="Dismiss connection notification"
            popoverTarget={toastId}
            popoverTargetAction="hide"
            onClick={() =>
              setNotice((current) => ({ ...current, restored: false }))
            }
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
