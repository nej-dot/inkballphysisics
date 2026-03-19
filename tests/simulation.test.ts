import { describe, expect, test } from "bun:test";

import { Simulation } from "../src/simulation";
import { SURFACES } from "../src/surfaces";
import type { SurfaceContext } from "../src/types";

function createSimulation() {
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
    },
    "bowl",
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
});
