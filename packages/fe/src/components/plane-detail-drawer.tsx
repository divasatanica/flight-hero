import { useEffect, useId, useRef, useState } from "react";
import type { PlaneDetailed } from "@flight-hero/contract";
import "../styles/plane-detail-drawer.css";
import { detailFields } from "../modules/tools/detail-fields";
import { CONFIGS } from "../modules/configs";
import type { ConnectionStatus } from "../modules/websocket/connection";
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
  const [error, setError] = useState("");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");

  useEffect(() => {
    if (!selectedFlightId) return;

    const socket = new FlightSocket(`${CONFIGS.wsBaseUrl}/planes/details`, {
      // Subscriptions belong to each connection; resubscribe to the selected flight after every reconnect.
      onStatusChange: setConnectionStatus,
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
          setError(`Flight ${selectedFlightId} is no longer available.`);
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

  const fields = detailFields(planeDetail);

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
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <>
          <p role="status">
            {connectionStatus === "reconnecting"
              ? "Reconnecting… Details may be outdated."
              : !planeDetail.id
                ? "Loading aircraft details…"
                : "Live aircraft details"}
          </p>
          <dl className="plane-detail-drawer__grid">
            {fields.map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </dialog>
  );
}
