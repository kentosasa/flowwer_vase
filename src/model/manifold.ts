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

// Creates a hollow cylinder with origin at the center of the bottom face
export async function hollowCylinder(
  height: number,
  outerRadius: number,
  wallThickness: number,
): Promise<Manifold> {
  const innerRadius = Math.max(0, outerRadius - wallThickness);

  // Create outer cylinder
  const outer = (await circle(outerRadius)).extrude(height);

  // Create inner cylinder (hollow part)
  const inner = (await circle(innerRadius)).extrude(height);

  // Subtract inner from outer to create hollow cylinder
  return outer.subtract(inner);
}
