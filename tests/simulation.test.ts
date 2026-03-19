import { describe, expect, test } from "bun:test";

import { Simulation } from "../src/simulation";

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
