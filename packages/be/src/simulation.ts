import { Plane } from "./plane";
import type { PlaneBasic, PlaneDetailed } from "@flight-hero/contract";

/**
 * Manages the flight simulation state
 */
export class Simulation {
  private planes: Map<string, Plane> = new Map();

  /**
   * Initialize simulation with specified number of planes
   */
  initialize(planeCount: number): void {
    for (let i = 0; i < planeCount; i++) {
      const plane = new Plane(`plane-${i + 1}`);
      this.planes.set(plane.getId(), plane);
    }
  }

  /**
   * Update all planes (called on each tick)
   */
  update(): void {
    this.planes.forEach((plane) => plane.update());
  }

  /**
   * Get all planes as basic data
   */
  getAllBasic(): PlaneBasic[] {
    return Array.from(this.planes.values()).map((plane) => plane.getBasic());
  }

  /**
   * Get detailed data for a specific plane
   */
  getDetailed(planeId: string): PlaneDetailed | null {
    const plane = this.planes.get(planeId);
    return plane ? plane.getDetailed() : null;
  }

  /**
   * Check if a plane exists
   */
  hasPlane(planeId: string): boolean {
    return this.planes.has(planeId);
  }
}
