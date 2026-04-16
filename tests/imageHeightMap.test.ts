import { describe, expect, test } from "bun:test";

import {
  createHeightMapPixels,
  createUploadedHeightMapSurface,
  UPLOADED_HEIGHT_MAP_SURFACE_ID,
} from "../src/imageHeightMap";
import { Simulation } from "../src/simulation";
import type { SimulationConfig, SurfaceContext } from "../src/types";

const SURFACE_CONTEXT: SurfaceContext = {
  width: 9,
  height: 9,
  scale: 9,
  centerX: 4.5,
  centerY: 4.5,
};

function createSimulation(overrides: Partial<SimulationConfig> = {}) {
  return new Simulation(
    {
      width: 9,
      height: 9,
      gravityStrength: 120,
      damping: 0,
      bounce: 1,
      collisionRestitution: 1,
      trailSpacing: 1.8,
      spawnMargin: 1,
      defaultBallRadius: 1,
      ...overrides,
    },
    "funnel",
  );
}

describe("Uploaded height map conversion", () => {
  test("converts color pixels to grayscale luminance", () => {
    const pixels = createHeightMapPixels({
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([
        255,
        0,
        0,
        255,
        0,
        0,
        0,
        0,
      ]),
    });

    expect(pixels.width).toBe(2);
    expect(pixels.height).toBe(1);
    expect(pixels.values[0]).toBeCloseTo(0.2126, 4);
    expect(pixels.values[1]).toBe(1);
  });

  test("samples uploaded images as smooth surfaces", () => {
    const pixels = createHeightMapPixels({
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        255,
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        255,
      ]),
    });
    const surface = createUploadedHeightMapSurface(pixels, "checker.png");

    expect(surface.id).toBe(UPLOADED_HEIGHT_MAP_SURFACE_ID);
    expect(surface.heightAt(0, 0, SURFACE_CONTEXT)).toBeCloseTo(0, 6);
    expect(surface.heightAt(8, 0, SURFACE_CONTEXT)).toBeCloseTo(1, 6);
    expect(surface.heightAt(4, 4, SURFACE_CONTEXT)).toBeCloseTo(0.5, 6);

    const gradient = surface.gradientAt(4, 4, SURFACE_CONTEXT);
    expect(gradient.dx).toBeGreaterThan(0);
    expect(Math.abs(gradient.dy)).toBeLessThan(1e-6);
  });
});

describe("Simulation uploaded surfaces", () => {
  test("uses an uploaded height map as the active simulation surface", () => {
    const simulation = createSimulation();
    const pixels = createHeightMapPixels({
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        255,
        0,
        0,
        0,
        255,
        255,
        255,
        255,
        255,
      ]),
    });

    simulation.setCustomSurface(createUploadedHeightMapSurface(pixels, "slope.png"));
    simulation.addBallAt(4.5, 4.5, 0, 0);

    const [ball] = simulation.getBalls();
    expect(ball).toBeDefined();

    simulation.step(1 / 60);

    expect(simulation.surfacePreset).toBe(UPLOADED_HEIGHT_MAP_SURFACE_ID);
    expect(ball!.vx).toBeLessThan(0);
    expect(ball!.x).toBeLessThan(4.5);
  });
});
