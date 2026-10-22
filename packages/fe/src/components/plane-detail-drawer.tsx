import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { PlaneDetailed } from "@flight-hero/contract";
import "../styles/plane-detail-drawer.css";
import { CONFIGS } from "../modules/configs";
import { FlightSocket } from "../modules/websocket/flights";

type PlaneDetailDrawerProps = {
  selectedFlightId: string;
  onClose: () => void;
};

export function PlaneDetailDrawer({
  selectedFlightId,
  onClose,
}: PlaneDetailDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [planeDetail, setPlaneDetail] = useState<PlaneDetailed>(
    {} as PlaneDetailed,
  );
  const titleId = useId();
  const estimatedArrival = useMemo(() => {
    if (typeof planeDetail.estimatedArrival !== "number") {
      return "-";
    }
    return new Date(planeDetail.estimatedArrival).toISOString();
  }, [planeDetail.estimatedArrival]);

  useEffect(() => {
    if (!selectedFlightId) return;

    const socket = new FlightSocket(`${CONFIGS.wsBaseUrl}/planes/details`, {
      // Subscriptions belong to each connection; resubscribe to the selected flight after every reconnect.
      onOpen() {
        socket.send({ type: "subscribe", planeId: selectedFlightId });
      },
      onMessage(message) {
        if (
          message.type === "plane-details" &&
          message.data.id === selectedFlightId
        ) {
          setPlaneDetail(message.data);
        }
      },
      onClose(event) {
        const { code } = event;

        if (code === 1008) {
          alert(`Flight ${selectedFlightId} does not exist`);
          dialogRef.current?.close();
        }
      },
    });
    socket.init();
    return () => socket.disconnect();
  }, [selectedFlightId]);

  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const fields = Object.entries(planeDetail).flatMap(([key, value]) =>
    typeof value === "object" && value !== null
      ? Object.entries(value).map(([childKey, childValue]) => [
          `${key}.${childKey}`,
          childValue,
        ])
      : [[key, value]],
  );

  return (
    <dialog
      ref={dialogRef}
      className="plane-detail-drawer"
      closedby="any"
      aria-labelledby={titleId}
      onClose={(event) => {
        // StrictMode can reopen the dialog before cleanup's queued close event.
        if (!event.currentTarget.open) onClose();
      }}
      onClick={(event) => {
        const dialog = event.currentTarget;
        if (
          "closedBy" in HTMLDialogElement.prototype ||
          event.target !== dialog
        )
          return;
        const rect = dialog.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        ) {
          dialog.close();
        }
      }}
    >
      <header className="plane-detail-drawer__header">
        <div>
          <h2 id={titleId}>Aircraft details</h2>
          <p>{planeDetail.flightNumber}</p>
        </div>
        <button
          type="button"
          aria-label="Close aircraft details"
          onClick={() => dialogRef.current?.close()}
        >
          ×
        </button>
      </header>
      <dl className="plane-detail-drawer__grid">
        {fields.map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            {key === "estimatedArrival" ? (
              <dd>{typeof value === "number" ? estimatedArrival : "-"}</dd>
            ) : (
              <dd>{String(value ?? "—")}</dd>
            )}
          </div>
        ))}
      </dl>
    </dialog>
  );
}
