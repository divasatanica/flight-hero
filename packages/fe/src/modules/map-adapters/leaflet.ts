import Leaflet, { Marker } from "leaflet";
import type { FeatureCollection } from "geojson";
import type {
  AdapterInitializationOptions,
  FlightMapAdapter,
  MapAdapter,
} from "./base";
import MapCountriesJson from "../../maps/ne_50m_admin_0_countries.json";
import MapAirportsJson from "../../maps/ne_50m_airports.json";
import type { PlaneBasic } from "@flight-hero/contract";

import PlaneDefault from "../../assets/plane-default.svg?raw";

function createPlaneIcon(color: string, size = 64) {
  const container = document.createElement("div");
  // 这里只插入项目内可信的 SVG 文件
  container.innerHTML = PlaneDefault;

  const svg = container.querySelector("svg")!;
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.display = "block";
  svg.style.color = color; // SVG 的 currentColor 使用这个颜色

  // 每个实例使用独立 ID，避免多个飞机的 mask 相互引用
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

export class LeafletAdapter implements MapAdapter, FlightMapAdapter {
  private map: Leaflet.Map | null = null;
  private markers: Map<string, Marker> = new Map();

  init(options: AdapterInitializationOptions): void {
    if (this.map != null) {
      return;
    }
    const { selectorID } = options;
    // Set the center as per backend's mock coordinators range instructed
    this.map = Leaflet.map(selectorID).setView([50, -90], 3.5);
    import("leaflet/dist/leaflet.css")
      .then(() => {
        console.log("Leaflet CSS loaded!");
      })
      .catch(() => {
        console.error("Loading leaflet CSS failed!");
      });

    this.loadMap();
  }

  destroy() {
    if (this.map == null) {
      return;
    }

    this.map.remove();
  }

  updateAircraft(id: string, payload: PlaneBasic): void {
    this.assertMapInstance();
    let marker = this.markers.get(id);

    if (marker == null) {
      marker = Leaflet.marker([payload.latitude, payload.longitude], {
        icon: createPlaneIcon(payload.color),
      });
      marker.addTo(this.map!);
      return;
    }

    marker.setLatLng([payload.latitude, payload.longitude]);
  }

  removeAircraft(id: string): void {
    this.assertMapInstance();
    const marker = this.markers.get(id);

    if (marker == null) {
      return;
    }

    marker.remove();
  }

  addTrack(points: Array<[number, number]>): void {}

  showTrack(points: Array<[number, number]>): void {}

  clearTrack(): void {}

  private assertMapInstance() {
    if (this.map == null) {
      throw new Error("Map instance should be initialized first");
    }
  }

  private loadMap(): void {
    this.assertMapInstance();

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
      pointToLayer: (_feature, latlng) =>
        Leaflet.circleMarker(latlng, {
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
}
