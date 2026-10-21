import Leaflet, { Marker, Polyline } from "leaflet";
import type { FeatureCollection } from "geojson";
import type {
  AdapterInitializationOptions,
  FlightClickEvent,
  FlightClickHandler,
  FlightMapAdapter,
} from "./base";
import MapCountriesJson from "../../maps/ne_50m_admin_0_countries.json";
import MapAirportsJson from "../../maps/ne_50m_airports.json";
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

export class LeafletAdapter implements FlightMapAdapter {
  private map: Leaflet.Map | null = null;
  private flightMarkers: Map<string, Marker> = new Map();
  private flightTrails: Map<string, Polyline> = new Map();
  private flightClickHandlers = new Set<FlightClickHandler>();
  private mapClickHandlers = new Set<() => void>();

  onMapClick(handler: () => void): () => void {
    this.mapClickHandlers.add(handler);

    return () => {
      this.mapClickHandlers.delete(handler);
    };
  }

  onFlightClick(handler: FlightClickHandler): () => void {
    this.flightClickHandlers.add(handler);

    return () => {
      this.flightClickHandlers.delete(handler);
    };
  }

  init(options: AdapterInitializationOptions): void {
    if (this.map != null) {
      return;
    }
    const { selectorID } = options;
    // Set the center as per backend's mock coordinators range instructed
    this.map = Leaflet.map(selectorID).setView([50, -90], 3.5);
    this.map.on("zoomend", this.updateMarkerSizes);
    // Bind click event listener to map
    this.map.addEventListener("click", () => {
      this.emitMapClick();
    });
    import("leaflet/dist/leaflet.css")
      .then(() => {
        console.log("Leaflet CSS loaded!");
      })
      .catch(() => {
        console.error("Loading leaflet CSS failed!");
      });

    this.loadMap();

    const dimmerPane = this.map.createPane("basemapDimmer");
    dimmerPane.classList.add("flight-basemap-dimmer");
    dimmerPane.setAttribute("aria-hidden", "true");
    this.map.on("move zoom resize viewreset", this.updateDimmerBounds);
    this.updateDimmerBounds();
  }

  destroy() {
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

      marker.addEventListener("click", () => {
        this.emitFlightClick({ flightId: id });
      });
      return;
    }

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

  // Currently support displaying of one track
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

    trail.setLatLngs([]);
  }

  private emitMapClick(): void {
    this.mapClickHandlers.forEach((handler) => handler());
  }

  private emitFlightClick(event: FlightClickEvent): void {
    this.flightClickHandlers.forEach((handler) => handler(event));
  }

  private assertMapInstance() {
    if (this.map == null) {
      throw new Error("Map instance should be initialized first");
    }
  }

  private loadMap(): void {
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

    // Fill color into country blocks
    Leaflet.geoJSON(MapCountriesJson as FeatureCollection, {
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

    Leaflet.geoJSON(MapAirportsJson as FeatureCollection, {
      pane: "basemap",
      pointToLayer: (_feature, latlng) =>
        Leaflet.circleMarker(latlng, {
          pane: "basemap",
          radius: 4,
          color: "#ffffff",
          weight: 1,
          fillColor: "#f59e0b",
          fillOpacity: 1,
        }),

      onEachFeature: (feature, layer) => {
        const name = feature.properties?.name;
        if (name) layer.bindTooltip(String(name));
      },
    }).addTo(this.map!);
  }

  private updateDimmerBounds = (): void => {
    if (!this.map) return;

    const pane = this.map.getPane("basemapDimmer");
    if (!pane) return;

    const size = this.map.getSize();
    const topLeft = this.map.containerPointToLayerPoint([0, 0]);
    Leaflet.DomUtil.setPosition(pane, topLeft);
    pane.style.width = `${size.x}px`;
    pane.style.height = `${size.y}px`;
  };

  private getMarkerSize(): number {
    const zoom = this.map!.getZoom();
    return Math.max(64, Math.min(96, 64 * 1.2 ** (zoom - 5)));
  }

  private updateMarkerSizes = (): void => {
    const size = this.getMarkerSize();

    this.flightMarkers.forEach((marker) => {
      const element = marker.getElement();
      if (!element) return;

      element.style.width = `${size}px`;
      element.style.height = `${size}px`;
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

    // Use unique ID to avoid multiple plane icons shares duplicate ids
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
