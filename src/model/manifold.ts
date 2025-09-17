import type { Vec2, CrossSection, Manifold } from "manifold-3d";
import type { ManifoldToplevel } from "manifold-3d";
import init from "manifold-3d";
import manifold_wasm from "manifold-3d/manifold.wasm?url";

// NOTE: all values are in mm

// Load manifold 3d
class ManifoldModule {
  private static wasm: ManifoldToplevel | undefined = undefined;
  static async get(): Promise<ManifoldToplevel> {
    if (this.wasm !== undefined) {
      return this.wasm;
    }

    this.wasm = await init({ locateFile: () => manifold_wasm });

    await this.wasm.setup();
    return this.wasm;
  }
}

// Creates a circle cross-section centered at (0,0)
async function circle(radius: number): Promise<CrossSection> {
  const { CrossSection } = await ManifoldModule.get();
  const N_SEGMENTS = 64; // High resolution for smooth circle

  const vertices: Vec2[] = [];
  for (let i = 0; i < N_SEGMENTS; i++) {
    const angle = (i * 2 * Math.PI) / N_SEGMENTS;
    vertices.push([
      radius * Math.cos(angle),
      radius * Math.sin(angle),
    ]);
  }

  return new CrossSection(vertices);
}

// Generate strip pattern (vertical strips)
async function createStripPattern(
  outerRadius: number,
  innerRadius: number,
  height: number,
  stripCount: number = 8,
  stripWidth: number = 0.3
): Promise<Manifold> {
  const { Manifold } = await ManifoldModule.get();
  let result = await Manifold.cylinder(height, outerRadius);

  // Create strips to subtract
  for (let i = 0; i < stripCount; i++) {
    const angle = (i * 2 * Math.PI) / stripCount;
    const stripRadius = (outerRadius + innerRadius) / 2;

    // Create a thin box for the strip
    const stripBox = Manifold.cylinder(height * 1.1, stripWidth / 2)
      .translate([stripRadius, 0, 0])
      .rotate([0, 0, (angle * 180) / Math.PI]);

    result = result.subtract(stripBox);
  }

  return result;
}

// Generate Voronoi-like pattern
async function createVoronoiPattern(
  outerRadius: number,
  innerRadius: number,
  height: number,
  cellCount: number = 20
): Promise<Manifold> {
  const { Manifold } = await ManifoldModule.get();
  let result = await Manifold.cylinder(height, outerRadius);

  // Generate random seed points for Voronoi cells
  const seedPoints: Vec2[] = [];
  for (let i = 0; i < cellCount; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
    seedPoints.push([
      radius * Math.cos(angle),
      radius * Math.sin(angle)
    ]);
  }

  // Create holes based on seed points
  for (const point of seedPoints) {
    const holeRadius = 0.8 + Math.random() * 1.2; // Random hole size
    const hole = Manifold.cylinder(height * 1.1, holeRadius)
      .translate([point[0], point[1], 0]);
    result = result.subtract(hole);
  }

  return result;
}

// Generate low poly pattern (faceted surface)
async function createLowPolyPattern(
  outerRadius: number,
  height: number,
  facets: number = 12
): Promise<Manifold> {

  // Create a low-poly cylinder by using fewer segments
  const vertices: Vec2[] = [];
  for (let i = 0; i < facets; i++) {
    const angle = (i * 2 * Math.PI) / facets;
    // Add some randomness to radius for more organic look
    const radiusVariation = 0.9 + Math.random() * 0.2;
    const radius = outerRadius * radiusVariation;
    vertices.push([
      radius * Math.cos(angle),
      radius * Math.sin(angle),
    ]);
  }

  const lowPolySection = new (await ManifoldModule.get()).CrossSection(vertices);
  const result = lowPolySection.extrude(height);

  return result;
}

// Pattern types for cylinder sides
export type SidePattern = "normal" | "strip" | "voronoi" | "lowpoly";

// Creates a hollow cylinder with origin at the center of the bottom face
export async function hollowCylinder(
  height: number,
  outerRadius: number,
  wallThickness: number,
  closedBottom: boolean = true,
  sidePattern: SidePattern = "normal",
): Promise<Manifold> {
  const innerRadius = Math.max(0, outerRadius - wallThickness);

  // Create outer cylinder with pattern
  let outer: Manifold;
  switch (sidePattern) {
    case "strip":
      outer = await createStripPattern(outerRadius, innerRadius, height);
      break;
    case "voronoi":
      outer = await createVoronoiPattern(outerRadius, innerRadius, height);
      break;
    case "lowpoly":
      outer = await createLowPolyPattern(outerRadius, height);
      break;
    case "normal":
    default:
      outer = (await circle(outerRadius)).extrude(height);
      break;
  }

  // Create inner cylinder (hollow part)
  // If bottom is closed, start the inner cylinder from wallThickness height
  // If bottom is open, start from 0 (bottom)
  const innerHeight = closedBottom ? height - wallThickness : height;
  const innerStartZ = closedBottom ? wallThickness : 0;

  const inner = (await circle(innerRadius))
    .extrude(innerHeight)
    .translate([0, 0, innerStartZ]);

  // Subtract inner from outer to create hollow cylinder
  return outer.subtract(inner);
}
