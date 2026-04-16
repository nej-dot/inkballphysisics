import { describe, expect, test } from "bun:test";

import { Simulation } from "../src/simulation";
import { SURFACES } from "../src/surfaces";
import type { SimulationConfig, SurfaceContext, SurfaceId } from "../src/types";

function createSimulation(overrides: Partial<SimulationConfig> = {}, surfaceId: SurfaceId = "bowl") {
  return new Simulation(
    {
      width: 900,
      height: 900,
      gravityStrength: 0,
      damping: 0,
      bounce: 1,
      collisionRestitution: 1,
      trailSpacing: 1.8,
      spawnMargin: 64,
      defaultBallRadius: 7,
      ...overrides,
    },
    surfaceId,
  );
}

function createBall(x: number, y: number, vx: number, vy: number) {
  const simulation = createSimulation();
  simulation.addBallAt(x, y);
  const ball = simulation.getBalls()[0];

  if (!ball) {
    throw new Error("Expected a ball to be created.");
  }

  ball.vx = vx;
  ball.vy = vy;

  return { simulation, ball };
}

describe("Simulation ball management", () => {
  test("all balls use the same default initial velocity", () => {
    const simulation = createSimulation();

    simulation.addBall();
    simulation.addBall();
    simulation.addBallAt(300, 400);

    const [firstBall, secondBall, thirdBall] = simulation.getBalls();

    expect(firstBall).toBeDefined();
    expect(secondBall).toBeDefined();
    expect(thirdBall).toBeDefined();
    expect(firstBall?.vx).not.toBe(0);
    expect(firstBall?.vy).not.toBe(0);
    expect(secondBall?.vx).toBe(firstBall?.vx);
    expect(secondBall?.vy).toBe(firstBall?.vy);
    expect(thirdBall?.vx).toBe(firstBall?.vx);
    expect(thirdBall?.vy).toBe(firstBall?.vy);
  });

  test("removeBall removes the most recently added ball", () => {
    const simulation = createSimulation();

    simulation.addBallAt(200, 200);
    simulation.addBallAt(300, 300);

    expect(simulation.ballCount).toBe(2);
    expect(simulation.removeBall()).toBe(true);
    expect(simulation.ballCount).toBe(1);
    expect(simulation.getBalls().map((ball) => ball.id)).toEqual([1]);
    expect(simulation.removeBall()).toBe(true);
    expect(simulation.removeBall()).toBe(false);
    expect(simulation.ballCount).toBe(0);
  });

  test("removeBallAt removes the clicked ball without affecting the others", () => {
    const simulation = createSimulation();

    simulation.addBallAt(200, 200);
    simulation.addBallAt(320, 320);

    expect(simulation.removeBallAt(200, 200)).toBe(true);
    expect(simulation.getBalls().map((ball) => ball.id)).toEqual([2]);
    expect(simulation.removeBallAt(200, 200)).toBe(false);
  });

  test("addPattern stamps the requested layout with stationary balls", () => {
    const expectedCounts = {
      circle: 12,
      cross: 9,
      "horizontal-line": 7,
      "vertical-line": 7,
      triangle: 10,
      square: 9,
    } as const;

    for (const [patternId, count] of Object.entries(expectedCounts)) {
      const simulation = createSimulation();

      simulation.addPattern(patternId as keyof typeof expectedCounts);

      expect(simulation.ballCount).toBe(count);
      expect(simulation.getBalls().every((ball) => ball.vx === 0 && ball.vy === 0)).toBe(true);
    }
  });

  test("patterns scale to fill as much of the canvas as possible", () => {
    const simulation = createSimulation();

    simulation.addPattern("horizontal-line");
    const horizontalXs = simulation.getBalls().map((ball) => ball.x);
    expect(Math.min(...horizontalXs)).toBe(7);
    expect(Math.max(...horizontalXs)).toBe(893);

    simulation.reset();
    simulation.addPattern("vertical-line");
    const verticalYs = simulation.getBalls().map((ball) => ball.y);
    expect(Math.min(...verticalYs)).toBe(7);
    expect(Math.max(...verticalYs)).toBe(893);
  });

  test("disabled ball collisions let balls pass through each other", () => {
    const simulation = createSimulation();

    simulation.addBallAt(300, 450, 60, 0);
    simulation.addBallAt(340, 450, -60, 0);
    simulation.setBallCollisionsEnabled(false);

    for (let index = 0; index < 60; index += 1) {
      simulation.step(1 / 120);
    }

    const [firstBall, secondBall] = simulation.getBalls();
    expect(firstBall).toBeDefined();
    expect(secondBall).toBeDefined();
    expect(firstBall!.x).toBeGreaterThan(secondBall!.x);
  });

  test("verlet integration can be switched on and matches constant-acceleration motion", () => {
    const simulation = createSimulation({ gravityStrength: 378 }, "tilted-plane");

    simulation.addBallAt(450, 450, 20, -10);
    simulation.setVerletIntegrationEnabled(true);

    const [ball] = simulation.getBalls();
    expect(ball).toBeDefined();

    simulation.step(1);

    expect(simulation.verletIntegrationEnabled).toBe(true);
    expect(ball!.x).toBeCloseTo(469.725, 6);
    expect(ball!.y).toBeCloseTo(439.89, 6);
    expect(ball!.vx).toBeCloseTo(19.45, 6);
    expect(ball!.vy).toBeCloseTo(-10.22, 6);
  });

  test("turning verlet off falls back to the original semi-implicit euler step", () => {
    const simulation = createSimulation({ gravityStrength: 378 }, "tilted-plane");

    simulation.addBallAt(450, 450, 20, -10);
    simulation.setVerletIntegrationEnabled(true);
    simulation.setVerletIntegrationEnabled(false);

    const [ball] = simulation.getBalls();
    expect(ball).toBeDefined();

    simulation.step(1);

    expect(simulation.verletIntegrationEnabled).toBe(false);
    expect(ball!.x).toBeCloseTo(469.45, 6);
    expect(ball!.y).toBeCloseTo(439.78, 6);
    expect(ball!.vx).toBeCloseTo(19.45, 6);
    expect(ball!.vy).toBeCloseTo(-10.22, 6);
  });

  test("erase mode can remove map objects before overlapping balls", () => {
    const simulation = createSimulation({}, "flat");

    simulation.addBallAt(300, 300, 0, 0);
    simulation.addGenerator(300, 300);

    expect(simulation.removeElementAt(300, 300)).toBe(true);
    expect(simulation.getMapObjects()).toHaveLength(0);
    expect(simulation.ballCount).toBe(1);

    expect(simulation.removeElementAt(300, 300)).toBe(true);
    expect(simulation.ballCount).toBe(0);
  });
});

describe("Simulation trails", () => {
  test("slow movement still accumulates visible trail points", () => {
    const { simulation, ball } = createBall(450, 450, 60, 0);

    for (let index = 0; index < 240; index += 1) {
      simulation.step(1 / 120);
    }

    expect(ball.x).toBeGreaterThan(560);
    expect(ball.trailSegments).toHaveLength(1);
    expect(ball.trailSegments[0]?.length).toBeGreaterThan(1);
  });

  test("re-enabled trails start a new segment that grows at low speed", () => {
    const { simulation, ball } = createBall(450, 450, 60, 0);

    for (let index = 0; index < 240; index += 1) {
      simulation.step(1 / 120);
    }

    simulation.setTrailsEnabled(false);

    for (let index = 0; index < 120; index += 1) {
      simulation.step(1 / 120);
    }

    simulation.setTrailsEnabled(true);
    expect(ball.trailSegments).toHaveLength(2);
    expect(ball.trailSegments[1]).toEqual([{ x: ball.x, y: ball.y }]);

    for (let index = 0; index < 240; index += 1) {
      simulation.step(1 / 120);
    }

    expect(ball.trailSegments[1]?.length).toBeGreaterThan(1);
  });

  test("ball size changes break the trail instead of drawing a jump line", () => {
    const { simulation, ball } = createBall(7, 450, 60, 0);

    for (let index = 0; index < 24; index += 1) {
      simulation.step(1 / 120);
    }

    expect(ball.trailSegments[0]?.length).toBeGreaterThan(1);

    simulation.setBallRadius(40);

    expect(ball.x).toBe(40);
    expect(ball.trailSegments).toHaveLength(2);
    expect(ball.trailSegments[1]).toEqual([{ x: 40, y: 450 }]);
  });
});

describe("Simulation map objects", () => {
  test("attractors pull balls toward their position on the flat surface", () => {
    const simulation = createSimulation({}, "flat");

    simulation.addBallAt(300, 450, 0, 0);
    simulation.addAttractor(600, 450);

    const [ball] = simulation.getBalls();
    expect(ball).toBeDefined();

    simulation.step(0.5);

    expect(ball!.x).toBeGreaterThan(300);
    expect(ball!.vx).toBeGreaterThan(0);
  });

  test("repellors push balls away from their position on the flat surface", () => {
    const simulation = createSimulation({}, "flat");

    simulation.addBallAt(300, 450, 0, 0);
    simulation.addRepellor(600, 450);

    const [ball] = simulation.getBalls();
    expect(ball).toBeDefined();

    simulation.step(0.5);

    expect(ball!.x).toBeLessThan(300);
    expect(ball!.vx).toBeLessThan(0);
  });

  test("generators emit one stationary ball per second of simulation time", () => {
    const simulation = createSimulation({}, "flat");

    simulation.addGenerator(450, 450);

    simulation.step(0.99);
    expect(simulation.ballCount).toBe(0);

    simulation.step(0.02);
    expect(simulation.ballCount).toBe(1);

    const [ball] = simulation.getBalls();
    expect(ball).toBeDefined();
    expect(ball!.vx).toBe(0);
    expect(ball!.vy).toBe(0);
  });

  test("reset clears balls but keeps placed map objects and generator timing", () => {
    const simulation = createSimulation({}, "flat");

    simulation.addGenerator(450, 450);
    simulation.step(0.75);
    simulation.reset();

    expect(simulation.ballCount).toBe(0);
    expect(simulation.getMapObjects()).toHaveLength(1);

    simulation.step(0.5);
    expect(simulation.ballCount).toBe(0);

    simulation.step(0.5);
    expect(simulation.ballCount).toBe(1);
  });
});

describe("Surface presets", () => {
  test("surface ids remain unique", () => {
    const ids = SURFACES.map((surface) => surface.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("all surfaces return finite heights and gradients at representative points", () => {
    const context: SurfaceContext = {
      width: 900,
      height: 900,
      scale: 900 * 0.42,
      centerX: 450,
      centerY: 450,
    };
    const samplePoints = [
      { x: 450, y: 450 },
      { x: 225, y: 180 },
      { x: 690, y: 260 },
      { x: 180, y: 720 },
      { x: 740, y: 710 },
    ];

    for (const surface of SURFACES) {
      for (const point of samplePoints) {
        const height = surface.heightAt(point.x, point.y, context);
        const gradient = surface.gradientAt(point.x, point.y, context);

        expect(Number.isFinite(height)).toBe(true);
        expect(Number.isFinite(gradient.dx)).toBe(true);
        expect(Number.isFinite(gradient.dy)).toBe(true);
      }
    }
  });

  test("the flat surface has no height field", () => {
    const flatSurface = SURFACES.find((surface) => surface.id === "flat");

    expect(flatSurface).toBeDefined();
    expect(flatSurface!.heightAt(100, 200, {
      width: 900,
      height: 900,
      scale: 900 * 0.42,
      centerX: 450,
      centerY: 450,
    })).toBe(0);
    expect(flatSurface!.gradientAt(100, 200, {
      width: 900,
      height: 900,
      scale: 900 * 0.42,
      centerX: 450,
      centerY: 450,
    })).toEqual({ dx: 0, dy: 0 });
  });
});
