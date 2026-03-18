import type { Gradient, SurfaceContext, SurfaceDefinition, SurfaceId } from "./types";

function toNormalized(x: number, y: number, context: SurfaceContext) {
  return {
    nx: (x - context.centerX) / context.scale,
    ny: (y - context.centerY) / context.scale,
  };
}

function createGradient(dx: number, dy: number): Gradient {
  return { dx, dy };
}

export const SURFACES: SurfaceDefinition[] = [
  {
    id: "tilted-plane",
    label: "Tilted Plane",
    description: "A constant downhill slope that pushes balls across the page.",
    heightAt: (x, y, context) => {
      const { nx, ny } = toNormalized(x, y, context);
      return 0.55 * nx + 0.22 * ny;
    },
    gradientAt: (_x, _y, context) =>
      createGradient(0.55 / context.scale, 0.22 / context.scale),
  },
  {
    id: "bowl",
    label: "Bowl",
    description: "A quadratic basin that curves everything back toward the middle.",
    heightAt: (x, y, context) => {
      const { nx, ny } = toNormalized(x, y, context);
      return 0.7 * (nx * nx + ny * ny);
    },
    gradientAt: (x, y, context) => {
      const { nx, ny } = toNormalized(x, y, context);
      return createGradient((1.4 * nx) / context.scale, (1.4 * ny) / context.scale);
    },
  },
  {
    id: "funnel",
    label: "Cone / Funnel",
    description: "A conical funnel that strongly pulls paths into the center.",
    heightAt: (x, y, context) => {
      const { nx, ny } = toNormalized(x, y, context);
      return 1.05 * Math.sqrt(nx * nx + ny * ny + 1e-6);
    },
    gradientAt: (x, y, context) => {
      const { nx, ny } = toNormalized(x, y, context);
      const length = Math.sqrt(nx * nx + ny * ny + 1e-6);
      return createGradient(
        (1.05 * nx) / (length * context.scale),
        (1.05 * ny) / (length * context.scale),
      );
    },
  },
];

export function getSurface(surfaceId: SurfaceId): SurfaceDefinition {
  return SURFACES.find((surface) => surface.id === surfaceId) ?? SURFACES[0];
}
