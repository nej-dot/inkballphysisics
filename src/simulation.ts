import { getPatternOffsets } from "./patterns";
import { UPLOADED_HEIGHT_MAP_SURFACE_ID } from "./imageHeightMap";
import { getSurface } from "./surfaces";
import type {
  Ball,
  BallPatternId,
  BuiltInSurfaceId,
  ForcePoint,
  MapObject,
  Point,
  SimulationConfig,
  SurfaceContext,
  SurfaceDefinition,
  SurfaceId,
  UploadedSurfaceId,
} from "./types";

const DEFAULT_SEED = 0xdecafbad;
const DEFAULT_FALLBACK_SURFACE: BuiltInSurfaceId = "funnel";
const DEFAULT_INITIAL_VELOCITY = {
  vx: 41.87310486828857,
  vy: 15.708513766353324,
};
const DEFAULT_FORCE_POINT_RADIUS = 140;
const DEFAULT_FORCE_POINT_STRENGTH = 320;
const DEFAULT_GENERATOR_INTERVAL_SECONDS = 1;
const MAP_OBJECT_HIT_RADIUS = 18;

interface Acceleration {
  ax: number;
  ay: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distanceSquared(a: Point, b: Point) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function createMulberry32(seed: number) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Simulation {
  private readonly context: SurfaceContext;
  private readonly initialSeed: number;
  private rng: () => number;
  private nextBallId = 1;
  private nextMapObjectId = 1;
  private surfaceId: SurfaceId;
  private customSurface: SurfaceDefinition<UploadedSurfaceId> | null = null;
  private balls: Ball[] = [];
  private mapObjects: MapObject[] = [];
  private config: SimulationConfig;
  private trailsEnabled = true;
  private ballCollisionsEnabled = true;
  private verletEnabled = false;

  constructor(config: SimulationConfig, surfaceId: SurfaceId, seed = DEFAULT_SEED) {
    this.config = config;
    this.surfaceId = surfaceId;
    this.initialSeed = seed;
    this.rng = createMulberry32(seed);
    this.context = {
      width: config.width,
      height: config.height,
      scale: Math.min(config.width, config.height) * 0.42,
      centerX: config.width / 2,
      centerY: config.height / 2,
    };
  }

  get width() {
    return this.config.width;
  }

  get height() {
    return this.config.height;
  }

  get surface() {
    if (this.surfaceId === UPLOADED_HEIGHT_MAP_SURFACE_ID && this.customSurface) {
      return this.customSurface;
    }

    return getSurface(this.getBuiltInSurfaceId());
  }

  get surfacePreset() {
    return this.surfaceId;
  }

  get hasCustomSurface() {
    return this.customSurface !== null;
  }

  get ballCount() {
    return this.balls.length;
  }

  get collisionsEnabled() {
    return this.ballCollisionsEnabled;
  }

  get verletIntegrationEnabled() {
    return this.verletEnabled;
  }

  getBalls() {
    return this.balls;
  }

  getMapObjects() {
    return this.mapObjects;
  }

  getConfig() {
    return { ...this.config };
  }

  setSurface(surfaceId: SurfaceId) {
    if (surfaceId === UPLOADED_HEIGHT_MAP_SURFACE_ID && !this.customSurface) {
      return;
    }

    this.surfaceId = surfaceId;
  }

  setCustomSurface(surface: SurfaceDefinition<UploadedSurfaceId>) {
    this.customSurface = surface;
    this.surfaceId = surface.id;
  }

  clearCustomSurface() {
    this.customSurface = null;

    if (this.surfaceId === UPLOADED_HEIGHT_MAP_SURFACE_ID) {
      this.surfaceId = DEFAULT_FALLBACK_SURFACE;
    }
  }

  setGravityStrength(value: number) {
    this.config.gravityStrength = value;
  }

  setDamping(value: number) {
    this.config.damping = value;
  }

  setBallRadius(value: number) {
    this.config.defaultBallRadius = value;

    for (const ball of this.balls) {
      ball.radius = value;
      ball.mass = Math.PI * value * value;
      this.keepBallInsideBounds(ball);
    }

    if (this.ballCollisionsEnabled) {
      this.resolveBallCollisions();
    }

    if (!this.trailsEnabled) {
      return;
    }

    for (const ball of this.balls) {
      this.startTrailSegment(ball);
    }
  }

  setTrailsEnabled(enabled: boolean) {
    this.trailsEnabled = enabled;

    if (!enabled) {
      return;
    }

    for (const ball of this.balls) {
      this.startTrailSegment(ball);
    }
  }

  setBallCollisionsEnabled(enabled: boolean) {
    this.ballCollisionsEnabled = enabled;

    if (enabled) {
      this.resolveBallCollisions();
    }
  }

  setVerletIntegrationEnabled(enabled: boolean) {
    this.verletEnabled = enabled;
  }

  reset() {
    this.balls = [];
    this.nextBallId = 1;
    this.rng = createMulberry32(this.initialSeed);

    for (const object of this.mapObjects) {
      if (object.kind === "generator") {
        object.elapsedSeconds = 0;
      }
    }
  }

  addBall(vx = DEFAULT_INITIAL_VELOCITY.vx, vy = DEFAULT_INITIAL_VELOCITY.vy) {
    const radius = this.config.defaultBallRadius;
    const margin = Math.max(this.config.spawnMargin, radius + 4);
    let x = margin + this.rng() * (this.config.width - margin * 2);
    let y = margin + this.rng() * (this.config.height - margin * 2);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (!this.isOverlappingExistingBall(x, y, radius)) {
        break;
      }

      x = margin + this.rng() * (this.config.width - margin * 2);
      y = margin + this.rng() * (this.config.height - margin * 2);
    }

    const ball = this.createBall(x, y, radius, vx, vy);

    this.balls.push(ball);
    this.keepBallInsideBounds(ball);
    this.separateNewBall(ball);
  }

  addBallAt(x: number, y: number, vx = DEFAULT_INITIAL_VELOCITY.vx, vy = DEFAULT_INITIAL_VELOCITY.vy) {
    const radius = this.config.defaultBallRadius;
    const ball = this.createBall(x, y, radius, vx, vy);
    this.keepBallInsideBounds(ball);
    this.balls.push(ball);
    this.separateNewBall(ball);
  }

  addPattern(patternId: BallPatternId, centerX = this.config.width / 2, centerY = this.config.height / 2) {
    const offsets = getPatternOffsets(patternId);
    const radius = this.config.defaultBallRadius;
    const availableHalfWidth = Math.max(0, Math.min(centerX - radius, this.config.width - centerX - radius));
    const availableHalfHeight = Math.max(0, Math.min(centerY - radius, this.config.height - centerY - radius));
    const maxOffsetX = Math.max(...offsets.map((offset) => Math.abs(offset.x)), 0);
    const maxOffsetY = Math.max(...offsets.map((offset) => Math.abs(offset.y)), 0);

    let scale = Number.POSITIVE_INFINITY;

    if (maxOffsetX > 0) {
      scale = Math.min(scale, availableHalfWidth / maxOffsetX);
    }

    if (maxOffsetY > 0) {
      scale = Math.min(scale, availableHalfHeight / maxOffsetY);
    }

    if (!Number.isFinite(scale)) {
      scale = 0;
    }

    for (const offset of offsets) {
      this.addBallAt(centerX + offset.x * scale, centerY + offset.y * scale, 0, 0);
    }
  }

  addAttractor(x: number, y: number) {
    this.mapObjects.push(this.createForcePoint("attractor", x, y));
  }

  addRepellor(x: number, y: number) {
    this.mapObjects.push(this.createForcePoint("repellor", x, y));
  }

  addGenerator(x: number, y: number) {
    const clamped = this.clampMapObjectPosition(x, y);
    this.mapObjects.push({
      id: this.nextMapObjectId++,
      kind: "generator",
      x: clamped.x,
      y: clamped.y,
      spawnIntervalSeconds: DEFAULT_GENERATOR_INTERVAL_SECONDS,
      elapsedSeconds: 0,
    });
  }

  removeBall() {
    return this.balls.pop() !== undefined;
  }

  removeBallAt(x: number, y: number) {
    for (let index = this.balls.length - 1; index >= 0; index -= 1) {
      const ball = this.balls[index];

      if (distanceSquared(ball, { x, y }) > ball.radius * ball.radius) {
        continue;
      }

      this.balls.splice(index, 1);
      return true;
    }

    return false;
  }

  removeMapObjectAt(x: number, y: number) {
    for (let index = this.mapObjects.length - 1; index >= 0; index -= 1) {
      const object = this.mapObjects[index];
      const hitRadius = object.kind === "generator" ? MAP_OBJECT_HIT_RADIUS : Math.max(16, object.radius * 0.14);

      if (distanceSquared(object, { x, y }) > hitRadius * hitRadius) {
        continue;
      }

      this.mapObjects.splice(index, 1);
      return true;
    }

    return false;
  }

  removeElementAt(x: number, y: number) {
    return this.removeMapObjectAt(x, y) || this.removeBallAt(x, y);
  }

  step(dt: number) {
    const surface = this.surface;
    const minDistanceSquared = this.config.trailSpacing * this.config.trailSpacing;

    for (const ball of this.balls) {
      if (this.verletEnabled) {
        this.stepBallWithVelocityVerlet(ball, dt, surface);
      } else {
        this.stepBallWithSemiImplicitEuler(ball, dt, surface);
      }

      this.resolveBoundaryCollision(ball);
    }

    if (this.ballCollisionsEnabled) {
      this.resolveBallCollisions();
    }

    this.stepGenerators(dt);

    for (const ball of this.balls) {
      if (!this.trailsEnabled) {
        continue;
      }

      const currentSegment = this.getCurrentTrailSegment(ball);
      const lastPoint = currentSegment[currentSegment.length - 1];
      if (!lastPoint || distanceSquared(lastPoint, ball) >= minDistanceSquared) {
        currentSegment.push({ x: ball.x, y: ball.y });
      }
    }
  }

  private createBall(x: number, y: number, radius: number, vx: number, vy: number): Ball {
    return {
      id: this.nextBallId++,
      x,
      y,
      vx,
      vy,
      radius,
      mass: Math.PI * radius * radius,
      trailSegments: [[{ x, y }]],
    };
  }

  private createForcePoint(kind: ForcePoint["kind"], x: number, y: number): ForcePoint {
    const clamped = this.clampMapObjectPosition(x, y);

    return {
      id: this.nextMapObjectId++,
      kind,
      x: clamped.x,
      y: clamped.y,
      radius: DEFAULT_FORCE_POINT_RADIUS,
      strength: DEFAULT_FORCE_POINT_STRENGTH,
    };
  }

  private clampMapObjectPosition(x: number, y: number) {
    return {
      x: clamp(x, MAP_OBJECT_HIT_RADIUS, this.config.width - MAP_OBJECT_HIT_RADIUS),
      y: clamp(y, MAP_OBJECT_HIT_RADIUS, this.config.height - MAP_OBJECT_HIT_RADIUS),
    };
  }

  private isOverlappingExistingBall(x: number, y: number, radius: number) {
    return this.balls.some((ball) => {
      const minDistance = ball.radius + radius + 2;
      return distanceSquared(ball, { x, y }) < minDistance * minDistance;
    });
  }

  private separateNewBall(ball: Ball) {
    for (let iteration = 0; iteration < 6; iteration += 1) {
      let moved = false;

      for (const other of this.balls) {
        if (other.id === ball.id) {
          continue;
        }

        const dx = ball.x - other.x;
        const dy = ball.y - other.y;
        const distance = Math.hypot(dx, dy);
        const minDistance = ball.radius + other.radius + 1;

        if (distance >= minDistance) {
          continue;
        }

        moved = true;
        const nx = distance > 1e-6 ? dx / distance : 1;
        const ny = distance > 1e-6 ? dy / distance : 0;
        const overlap = minDistance - distance;
        ball.x += nx * overlap;
        ball.y += ny * overlap;
        this.keepBallInsideBounds(ball);
      }

      if (!moved) {
        break;
      }
    }

    const currentSegment = this.getCurrentTrailSegment(ball);
    if (currentSegment.length === 0) {
      currentSegment.push({ x: ball.x, y: ball.y });
    } else {
      currentSegment[0] = { x: ball.x, y: ball.y };
    }
  }

  private getBuiltInSurfaceId(): BuiltInSurfaceId {
    return this.surfaceId === UPLOADED_HEIGHT_MAP_SURFACE_ID ? DEFAULT_FALLBACK_SURFACE : this.surfaceId;
  }

  private keepBallInsideBounds(ball: Ball) {
    const minX = ball.radius;
    const maxX = this.config.width - ball.radius;
    const minY = ball.radius;
    const maxY = this.config.height - ball.radius;

    ball.x = clamp(ball.x, minX, maxX);
    ball.y = clamp(ball.y, minY, maxY);
  }

  private resolveBoundaryCollision(ball: Ball) {
    const minX = ball.radius;
    const maxX = this.config.width - ball.radius;
    const minY = ball.radius;
    const maxY = this.config.height - ball.radius;

    if (ball.x < minX) {
      ball.x = minX;
      ball.vx = Math.abs(ball.vx) * this.config.bounce;
    } else if (ball.x > maxX) {
      ball.x = maxX;
      ball.vx = -Math.abs(ball.vx) * this.config.bounce;
    }

    if (ball.y < minY) {
      ball.y = minY;
      ball.vy = Math.abs(ball.vy) * this.config.bounce;
    } else if (ball.y > maxY) {
      ball.y = maxY;
      ball.vy = -Math.abs(ball.vy) * this.config.bounce;
    }

    ball.x = clamp(ball.x, minX, maxX);
    ball.y = clamp(ball.y, minY, maxY);
  }

  private stepBallWithSemiImplicitEuler(ball: Ball, dt: number, surface = this.surface) {
    const acceleration = this.getAccelerationAt(ball.x, ball.y, surface);

    ball.vx += acceleration.ax * dt;
    ball.vy += acceleration.ay * dt;

    const dampingScale = this.getDampingScale(dt);
    ball.vx *= dampingScale;
    ball.vy *= dampingScale;

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
  }

  private stepBallWithVelocityVerlet(ball: Ball, dt: number, surface = this.surface) {
    const initialAcceleration = this.getAccelerationAt(ball.x, ball.y, surface);
    const nextX = ball.x + ball.vx * dt + 0.5 * initialAcceleration.ax * dt * dt;
    const nextY = ball.y + ball.vy * dt + 0.5 * initialAcceleration.ay * dt * dt;
    const nextAcceleration = this.getAccelerationAt(nextX, nextY, surface);
    const dampingScale = this.getDampingScale(dt);

    ball.x = nextX;
    ball.y = nextY;
    ball.vx = (ball.vx + 0.5 * (initialAcceleration.ax + nextAcceleration.ax) * dt) * dampingScale;
    ball.vy = (ball.vy + 0.5 * (initialAcceleration.ay + nextAcceleration.ay) * dt) * dampingScale;
  }

  private getAccelerationAt(x: number, y: number, surface = this.surface): Acceleration {
    const slope = surface.gradientAt(x, y, this.context);
    let ax = -this.config.gravityStrength * slope.dx;
    let ay = -this.config.gravityStrength * slope.dy;

    for (const object of this.mapObjects) {
      if (object.kind === "generator") {
        continue;
      }

      const dx = object.x - x;
      const dy = object.y - y;
      const distance = Math.hypot(dx, dy);

      if (distance <= 1e-6) {
        continue;
      }

      const normalizedDistance = distance / object.radius;
      const magnitude = object.strength / (0.35 + normalizedDistance * normalizedDistance);
      const direction = object.kind === "attractor" ? 1 : -1;

      ax += direction * (dx / distance) * magnitude;
      ay += direction * (dy / distance) * magnitude;
    }

    return { ax, ay };
  }

  private getDampingScale(dt: number) {
    return 1 / (1 + this.config.damping * dt);
  }

  private stepGenerators(dt: number) {
    for (const object of this.mapObjects) {
      if (object.kind !== "generator") {
        continue;
      }

      object.elapsedSeconds += dt;

      while (object.elapsedSeconds >= object.spawnIntervalSeconds) {
        object.elapsedSeconds -= object.spawnIntervalSeconds;
        this.addBallAt(object.x, object.y, 0, 0);
      }
    }
  }

  private resolveBallCollisions() {
    for (let pass = 0; pass < 2; pass += 1) {
      for (let index = 0; index < this.balls.length; index += 1) {
        const a = this.balls[index];

        for (let otherIndex = index + 1; otherIndex < this.balls.length; otherIndex += 1) {
          const b = this.balls[otherIndex];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distanceSquaredValue = dx * dx + dy * dy;
          const minDistance = a.radius + b.radius;

          if (distanceSquaredValue >= minDistance * minDistance) {
            continue;
          }

          const distance = Math.sqrt(distanceSquaredValue);
          const nx = distance > 1e-6 ? dx / distance : 1;
          const ny = distance > 1e-6 ? dy / distance : 0;
          const overlap = minDistance - distance;
          const inverseMassA = 1 / a.mass;
          const inverseMassB = 1 / b.mass;
          const inverseMassSum = inverseMassA + inverseMassB;

          a.x -= nx * overlap * (inverseMassA / inverseMassSum);
          a.y -= ny * overlap * (inverseMassA / inverseMassSum);
          b.x += nx * overlap * (inverseMassB / inverseMassSum);
          b.y += ny * overlap * (inverseMassB / inverseMassSum);

          this.keepBallInsideBounds(a);
          this.keepBallInsideBounds(b);

          const relativeVelocityX = b.vx - a.vx;
          const relativeVelocityY = b.vy - a.vy;
          const velocityAlongNormal = relativeVelocityX * nx + relativeVelocityY * ny;

          if (velocityAlongNormal >= 0) {
            continue;
          }

          const impulseMagnitude =
            (-(1 + this.config.collisionRestitution) * velocityAlongNormal) / inverseMassSum;
          const impulseX = impulseMagnitude * nx;
          const impulseY = impulseMagnitude * ny;

          a.vx -= impulseX * inverseMassA;
          a.vy -= impulseY * inverseMassA;
          b.vx += impulseX * inverseMassB;
          b.vy += impulseY * inverseMassB;
        }
      }
    }
  }

  private getCurrentTrailSegment(ball: Ball) {
    const currentSegment = ball.trailSegments[ball.trailSegments.length - 1];

    if (currentSegment) {
      return currentSegment;
    }

    const newSegment = [{ x: ball.x, y: ball.y }];
    ball.trailSegments.push(newSegment);
    return newSegment;
  }

  private startTrailSegment(ball: Ball) {
    const currentSegment = this.getCurrentTrailSegment(ball);
    const currentPoint = { x: ball.x, y: ball.y };

    if (currentSegment.length <= 1) {
      currentSegment[0] = currentPoint;
      currentSegment.length = 1;
      return;
    }

    ball.trailSegments.push([currentPoint]);
  }
}
