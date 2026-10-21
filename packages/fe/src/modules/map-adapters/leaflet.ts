import Leaflet from "leaflet";
import type { FeatureCollection } from "geojson";
import type { AdapterInitializationOptions, MapAdapter } from "./base";
import MapCountriesJson from "../../maps/ne_50m_admin_0_countries.json";
import MapAirportsJson from "../../maps/ne_50m_airports.json";

export class LeafletAdapter implements MapAdapter {
  map: Leaflet.Map | null = null;

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

  private loadMap(): void {
    if (this.map == null) {
      throw new Error("Map instance not initialized");
    }

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
