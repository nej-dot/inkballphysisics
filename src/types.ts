export type BuiltInSurfaceId =
  | "flat"
  | "tilted-plane"
  | "bowl"
  | "funnel"
  | "mogul-track"
  | "sink-hole"
  | "gradual-groove"
  | "oldschool-pachinko"
  | "invisible-pinball"
  | "funnel-maze";

export type UploadedSurfaceId = "uploaded-height-map";

export type SurfaceId = BuiltInSurfaceId | UploadedSurfaceId;

export type BallPatternId = "circle" | "cross" | "horizontal-line" | "vertical-line" | "triangle" | "square";

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

export interface ForcePoint {
  id: number;
  kind: "attractor" | "repellor";
  x: number;
  y: number;
  strength: number;
  radius: number;
}

export interface BallGenerator {
  id: number;
  kind: "generator";
  x: number;
  y: number;
  spawnIntervalSeconds: number;
  elapsedSeconds: number;
}

export type MapObject = ForcePoint | BallGenerator;

export interface SurfaceContext {
  width: number;
  height: number;
  scale: number;
  centerX: number;
  centerY: number;
}

export interface SurfaceDefinition<TId extends string = string> {
  id: TId;
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
