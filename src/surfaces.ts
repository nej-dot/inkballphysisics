import type { BuiltInSurfaceId, Gradient, SurfaceContext, SurfaceDefinition } from "./types";

const PACHINKO_PEGS = [
  { x: -0.48, y: -0.7 },
  { x: 0, y: -0.7 },
  { x: 0.48, y: -0.7 },
  { x: -0.72, y: -0.33 },
  { x: -0.24, y: -0.33 },
  { x: 0.24, y: -0.33 },
  { x: 0.72, y: -0.33 },
  { x: -0.48, y: 0.04 },
  { x: 0, y: 0.04 },
  { x: 0.48, y: 0.04 },
  { x: -0.72, y: 0.41 },
  { x: -0.24, y: 0.41 },
  { x: 0.24, y: 0.41 },
  { x: 0.72, y: 0.41 },
] as const;

function toNormalized(x: number, y: number, context: SurfaceContext) {
  return {
    nx: (x - context.centerX) / context.scale,
    ny: (y - context.centerY) / context.scale,
  };
}

function createGradient(dx: number, dy: number): Gradient {
  return { dx, dy };
}

function fromNormalizedGradient(dnx: number, dny: number, context: SurfaceContext): Gradient {
  return createGradient(dnx / context.scale, dny / context.scale);
}

function gaussianContribution(
  nx: number,
  ny: number,
  centerX: number,
  centerY: number,
  spread: number,
  amplitude: number,
) {
  const dx = nx - centerX;
  const dy = ny - centerY;
  const exponent = Math.exp(-((dx * dx + dy * dy) / spread));
  const value = amplitude * exponent;
  const derivativeScale = (-2 * value) / spread;

  return {
    value,
    dnx: derivativeScale * dx,
    dny: derivativeScale * dy,
  };
}

export const SURFACES: SurfaceDefinition<BuiltInSurfaceId>[] = [
  {
    id: "flat",
    label: "Flat / Clean",
    description: "A clean map with no built-in height field.",
    heightAt: () => 0,
    gradientAt: () => createGradient(0, 0),
  },
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
  {
    id: "mogul-track",
    label: "Mogul Track",
    description: "A downhill ski run with wavy moguls and a snaking center groove.",
    heightAt: (x, y, context) => {
      const { nx, ny } = toNormalized(x, y, context);
      const centerline = nx - 0.18 * Math.sin(2.8 * ny);
      return -0.72 * ny + 0.34 * centerline * centerline + 0.08 * Math.sin(18 * ny) * Math.cos(6 * nx);
    },
    gradientAt: (x, y, context) => {
      const { nx, ny } = toNormalized(x, y, context);
      const wobble = 0.18 * Math.sin(2.8 * ny);
      const centerline = nx - wobble;
      const dnx = 0.68 * centerline - 0.48 * Math.sin(18 * ny) * Math.sin(6 * nx);
      const dny =
        -0.72 -
        0.34272 * centerline * Math.cos(2.8 * ny) +
        1.44 * Math.cos(18 * ny) * Math.cos(6 * nx);
      return fromNormalizedGradient(dnx, dny, context);
    },
  },
  {
    id: "sink-hole",
    label: "Sink Hole",
    description: "A deep collapsing pocket with a sharp lip that slings balls into the center.",
    heightAt: (x, y, context) => {
      const { nx, ny } = toNormalized(x, y, context);
      const radiusSquared = nx * nx + ny * ny;
      return 0.1 * radiusSquared - 1.4 * Math.exp(-(radiusSquared / 0.12));
    },
    gradientAt: (x, y, context) => {
      const { nx, ny } = toNormalized(x, y, context);
      const contribution = gaussianContribution(nx, ny, 0, 0, 0.12, -1.4);
      return fromNormalizedGradient(0.2 * nx + contribution.dnx, 0.2 * ny + contribution.dny, context);
    },
  },
  {
    id: "gradual-groove",
    label: "Gradual Groove",
    description: "A gentle meandering channel that slowly gathers motion into a carved groove.",
    heightAt: (x, y, context) => {
      const { nx, ny } = toNormalized(x, y, context);
      const grooveOffset = ny + 0.28 * Math.sin(1.7 * nx);
      return -0.28 * nx + 0.22 * grooveOffset * grooveOffset + 0.05 * Math.sin(5.6 * nx);
    },
    gradientAt: (x, y, context) => {
      const { nx, ny } = toNormalized(x, y, context);
      const grooveOffset = ny + 0.28 * Math.sin(1.7 * nx);
      const dnx = -0.28 + 0.20944 * grooveOffset * Math.cos(1.7 * nx) + 0.28 * Math.cos(5.6 * nx);
      const dny = 0.44 * grooveOffset;
      return fromNormalizedGradient(dnx, dny, context);
    },
  },
  {
    id: "oldschool-pachinko",
    label: "Oldskool Pachinko",
    description: "A tilted field of invisible pegs that knocks trajectories into staggered lanes.",
    heightAt: (x, y, context) => {
      const { nx, ny } = toNormalized(x, y, context);
      let height = -0.84 * ny;

      for (const peg of PACHINKO_PEGS) {
        height += gaussianContribution(nx, ny, peg.x, peg.y, 0.022, 0.18).value;
      }

      return height;
    },
    gradientAt: (x, y, context) => {
      const { nx, ny } = toNormalized(x, y, context);
      let dnx = 0;
      let dny = -0.84;

      for (const peg of PACHINKO_PEGS) {
        const contribution = gaussianContribution(nx, ny, peg.x, peg.y, 0.022, 0.18);
        dnx += contribution.dnx;
        dny += contribution.dny;
      }

      return fromNormalizedGradient(dnx, dny, context);
    },
  },
  {
    id: "invisible-pinball",
    label: "Invisible Pinball",
    description: "Hidden wave ridges kick balls around like unseen bumpers under the page.",
    heightAt: (x, y, context) => {
      const { nx, ny } = toNormalized(x, y, context);
      const radiusSquared = nx * nx + ny * ny;
      return (
        0.14 * radiusSquared +
        0.22 * Math.sin(4.8 * nx + 1.9 * ny) +
        0.18 * Math.sin(3.6 * ny - 5.4 * nx)
      );
    },
    gradientAt: (x, y, context) => {
      const { nx, ny } = toNormalized(x, y, context);
      const firstWave = Math.cos(4.8 * nx + 1.9 * ny);
      const secondWave = Math.cos(3.6 * ny - 5.4 * nx);
      const dnx = 0.28 * nx + 1.056 * firstWave - 0.972 * secondWave;
      const dny = 0.28 * ny + 0.418 * firstWave + 0.648 * secondWave;
      return fromNormalizedGradient(dnx, dny, context);
    },
  },
  {
    id: "funnel-maze",
    label: "Funnel Maze",
    description: "A central funnel wrapped in spiral ridges, so paths have to orbit before escaping inward.",
    heightAt: (x, y, context) => {
      const { nx, ny } = toNormalized(x, y, context);
      const radius = Math.sqrt(nx * nx + ny * ny + 1e-6);
      const angle = Math.atan2(ny, nx);
      return 0.78 * radius + 0.18 * Math.sin(5 * angle + 7 * radius);
    },
    gradientAt: (x, y, context) => {
      const { nx, ny } = toNormalized(x, y, context);
      const radiusSquared = nx * nx + ny * ny + 1e-6;
      const radius = Math.sqrt(radiusSquared);
      const angle = Math.atan2(ny, nx);
      const phase = 5 * angle + 7 * radius;
      const radial = 0.78 + 1.26 * Math.cos(phase);
      const angular = 0.9 * Math.cos(phase);
      const dnx = radial * (nx / radius) - angular * (ny / radiusSquared);
      const dny = radial * (ny / radius) + angular * (nx / radiusSquared);
      return fromNormalizedGradient(dnx, dny, context);
    },
  },
];

export function getSurface(surfaceId: BuiltInSurfaceId): SurfaceDefinition<BuiltInSurfaceId> {
  return SURFACES.find((surface) => surface.id === surfaceId) ?? SURFACES[0];
}
