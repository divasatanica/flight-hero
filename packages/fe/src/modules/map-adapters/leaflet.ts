import { EventEmitter } from "./event-emitter";
import Leaflet, { Marker, Polyline } from "leaflet";
import type { FeatureCollection } from "geojson";
import type {
  AdapterInitializationOptions,
  FlightMapEvents,
  FlightMapAdapter,
} from "./base";
import type { PlaneBasic } from "@flight-hero/contract";

import PlaneDefault from "../../assets/plane-default.svg?raw";
import AirbusA320 from "../../assets/airbus-a320.svg?raw";
import AirbusA350 from "../../assets/airbus-a350.svg?raw";
import AirbusA380 from "../../assets/airbus-a380.svg?raw";
import Boeing737 from "../../assets/boeing-737.svg?raw";
import Boeing777 from "../../assets/boeing-777.svg?raw";
import Boeing787 from "../../assets/boeing-787.svg?raw";
import EmbraerE190 from "../../assets/embraer-e190.svg?raw";
import BombardierCRJ from "../../assets/bombardier-crj.svg?raw";

const planeIcons: Readonly<Partial<Record<string, string>>> = {
  "Airbus A320": AirbusA320,
  "Airbus A350": AirbusA350,
  "Airbus A380": AirbusA380,
  "Boeing 737": Boeing737,
  "Boeing 777": Boeing777,
  "Boeing 787": Boeing787,
  "Embraer E190": EmbraerE190,
  "Bombardier CRJ": BombardierCRJ,
};

export class LeafletAdapter
  extends EventEmitter<FlightMapEvents>
  implements FlightMapAdapter
{
  private map: Leaflet.Map | null = null;
  // Reuse layers by flight ID so position updates move existing markers instead of rebuilding DOM.
  private flightMarkers: Map<string, Marker> = new Map();
  private flightTrails: Map<string, Polyline> = new Map();
  async init(options: AdapterInitializationOptions): Promise<void> {
    if (options.type !== "leaflet") {
      throw new Error("Unmatched adapater type");
    }
    if (this.map != null) {
      return;
    }
    const { selectorID } = options;
    // Set the center as per backend's mock coordinators range instructed
    this.map = Leaflet.map(selectorID).setView([50, -90], 3.5);
    this.map.on("zoomend", this.updateMarkerSizes);
    // Bind click event listener to map
    this.map.addEventListener("click", () => {
      this.emit("mapClick");
    });
    import("leaflet/dist/leaflet.css")
      .then(() => {
        console.log("Leaflet CSS loaded!");
      })
      .catch(() => {
        console.error("Loading leaflet CSS failed!");
      });

    await this.loadMap();

    // loadMap may return after destruction; skip the remaining initialization.
    if (this.map == null) {
      return;
    }

    const dimmerPane = this.map.createPane("basemapDimmer");
    dimmerPane.classList.add("flight-basemap-dimmer");
    dimmerPane.setAttribute("aria-hidden", "true");
    this.map.on("move zoom resize viewreset", this.updateDimmerBounds);
    this.updateDimmerBounds();
    this.emit("mapLoaded");
  }

  destroy() {
    this.clear();
    if (this.map == null) {
      return;
    }

    this.map.off("zoomend", this.updateMarkerSizes);
    this.map.off("move zoom resize viewreset", this.updateDimmerBounds);
    this.map.remove();
    this.map = null;
    this.flightMarkers.clear();
    this.flightTrails.clear();
  }

  updateAircraft(id: string, payload: PlaneBasic): void {
    this.assertMapInstance();
    let marker = this.flightMarkers.get(id);

    if (marker == null) {
      marker = Leaflet.marker([payload.latitude, payload.longitude], {
        icon: LeafletAdapter.createPlaneIcon(
          payload.color,
          payload.model,
          payload.heading,
          this.getMarkerSize(),
        ),
        alt: `Plane: ${id}`,
        title: id,
      });
      marker.addTo(this.map!);
      this.flightMarkers.set(id, marker);
      const svg = marker.getElement()?.querySelector("svg");
      if (svg) {
        svg.style.transform = `rotate(${payload.heading}deg)`;
      }

      marker.addEventListener("click", () => {
        this.emit("flightClick", { flightId: id });
      });
      return;
    }

    // Model and color are fixed at creation; position updates preserve the icon and change only location and heading.
    marker.setLatLng([payload.latitude, payload.longitude]);

    const svg = marker.getElement()?.querySelector("svg");
    if (svg) {
      svg.style.transform = `rotate(${payload.heading}deg)`;
    }
  }

  removeAircraft(id: string): void {
    this.assertMapInstance();
    const marker = this.flightMarkers.get(id);

    if (marker == null) {
      return;
    }

    marker.remove();
    this.flightMarkers.delete(id);
  }

  addTrack(key: string, points: Array<[number, number]>): void {
    if (!this.flightTrails.has(key)) {
      const selectedTrail = Leaflet.polyline([], {
        color: "#38bdf8",
        weight: 2,
      });

      this.flightTrails.set(key, selectedTrail);
      selectedTrail.addTo(this.map!);
    }

    const trail = this.flightTrails.get(key)!;

    trail.setLatLngs(points);
  }

  // Selected flights share the DEFAULT layer; replacing its points prevents old trails from accumulating.
  showTrack(points: Array<[number, number]>): void {
    this.addTrack("DEFAULT", points);
  }

  clearAllTrack(): void {
    const keys = this.flightTrails.keys();

    for (const key of keys) {
      this.clearTrack(key);
    }
  }

  clearTrack(key = "DEFAULT"): void {
    if (!this.flightTrails.has(key)) {
      return;
    }

    const trail = this.flightTrails.get(key)!;

    // Clear points but retain the layer for reuse when the same key is shown again.
    trail.setLatLngs([]);
  }

  private assertMapInstance() {
    if (this.map == null) {
      throw new Error("Map instance should be initialized first");
    }
  }

  private async loadMap(): Promise<void> {
    this.assertMapInstance();

    const basemapPane = this.map!.createPane("basemap");
    basemapPane.classList.add("flight-basemap-pane");
    basemapPane.style.zIndex = "300";

    const colors = [
      "#cbd5e1",
      "#bfdbfe",
      "#a7f3d0",
      "#fde68a",
      "#fecaca",
      "#ddd6fe",
      "#fed7aa",
    ];

    // Load country boundaries on demand; geoJSON handles coordinate order without manual conversion.
    const imported = await import("../../maps/ne_50m_admin_0_countries.json");

    // The map may have been destroyed while importing; skip adding the basemap.
    if (this.map == null) {
      return;
    }
    // Fill color into country blocks
    Leaflet.geoJSON(imported.default as FeatureCollection, {
      pane: "basemap",
      style: (feature) => {
        const index = Number(feature?.properties?.MAPCOLOR7) - 1;

        return {
          fillColor: colors[index] ?? "#cbd5e1",
          fillOpacity: 0.8,
          color: "#64748b",
          weight: 1,
        };
      },
    }).addTo(this.map!);
  }

  private updateDimmerBounds = (): void => {
    if (!this.map) return;

    const pane = this.map.getPane("basemapDimmer");
    if (!pane) return;

    const size = this.map.getSize();
    // Panes use layer coordinates; reposition the dimmer after map movement to keep it covering the viewport.
    const topLeft = this.map.containerPointToLayerPoint([0, 0]);
    Leaflet.DomUtil.setPosition(pane, topLeft);
    pane.style.width = `${size.x}px`;
    pane.style.height = `${size.y}px`;
  };

  private getMarkerSize(): number {
    const zoom = this.map!.getZoom();
    // Scale with zoom within fixed bounds to balance clickable targets and map readability.
    return Math.max(32, Math.min(96, 48 * 1.2 ** (zoom - 5)));
  }

  private updateMarkerSizes = (): void => {
    const size = this.getMarkerSize();

    this.flightMarkers.forEach((marker) => {
      const element = marker.getElement();
      if (!element) return;

      element.style.width = `${size}px`;
      element.style.height = `${size}px`;
      // Update anchor offsets with the size so the aircraft center stays on its geographic position.
      element.style.marginLeft = `${-size / 2}px`;
      element.style.marginTop = `${-size / 2}px`;
    });
  };

  static createPlaneIcon(color: string, model: string, heading = 0, size = 64) {
    const container = document.createElement("div");
    container.innerHTML = planeIcons[model] ?? PlaneDefault;

    const svg = container.querySelector("svg")!;
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.display = "block";
    svg.style.color = color;
    svg.style.transformOrigin = "50% 50%";
    svg.style.transform = `rotate(${heading}deg)`;

    // Inline SVG IDs share the document namespace; rewrite definitions and references to prevent mask collisions.
    const prefix = `plane-${crypto.randomUUID()}`;
    const mask = svg.querySelector("mask")!;
    const maskId = `${prefix}-mask`;

    mask.id = maskId;
    svg.querySelector("[mask]")!.setAttribute("mask", `url(#${maskId})`);

    const title = svg.querySelector("title")!;
    title.id = `${prefix}-title`;
    svg.setAttribute("aria-labelledby", title.id);

    return Leaflet.divIcon({
      html: container,
      className: "plane-marker",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }
}
