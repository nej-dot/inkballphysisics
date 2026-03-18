export type SurfaceId = "tilted-plane" | "bowl" | "funnel";

export interface Point {
  x: number;
  y: number;
}

export interface Gradient {
  dx: number;
  dy: number;
}

export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  trailSegments: Point[][];
}

export interface SurfaceContext {
  width: number;
  height: number;
  scale: number;
  centerX: number;
  centerY: number;
}

export interface SurfaceDefinition {
  id: SurfaceId;
  label: string;
  description: string;
  heightAt: (x: number, y: number, context: SurfaceContext) => number;
  gradientAt: (x: number, y: number, context: SurfaceContext) => Gradient;
}

export interface SimulationConfig {
  width: number;
  height: number;
  gravityStrength: number;
  damping: number;
  bounce: number;
  collisionRestitution: number;
  trailSpacing: number;
  spawnMargin: number;
  defaultBallRadius: number;
}
