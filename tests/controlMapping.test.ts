import { describe, expect, test } from "bun:test";

import {
  BALL_SIZE_MAPPING,
  DAMPING_MAPPING,
  GRAVITY_MAPPING,
  TRAIL_WEIGHT_MAPPING,
  translateSimulationValue,
  translateSliderValue,
} from "../src/controlMapping";

describe("Control mappings", () => {
  test("damping slider maps to a reduced maximum internal range", () => {
    expect(translateSliderValue(1, DAMPING_MAPPING)).toBe(0);
    expect(translateSliderValue(100, DAMPING_MAPPING)).toBe(16);
    expect(translateSliderValue(50.5, DAMPING_MAPPING)).toBe(8);
  });

  test("gravity slider maps the normalized range onto the simulation range", () => {
    expect(translateSliderValue(1, GRAVITY_MAPPING)).toBe(0);
    expect(translateSliderValue(100, GRAVITY_MAPPING)).toBe(120000);
    expect(translateSliderValue(50.5, GRAVITY_MAPPING)).toBe(60000);
  });

  test("ball size slider preserves a 1 to 20 size range", () => {
    expect(translateSliderValue(1, BALL_SIZE_MAPPING)).toBe(1);
    expect(translateSliderValue(20, BALL_SIZE_MAPPING)).toBe(20);
    expect(translateSimulationValue(12, BALL_SIZE_MAPPING)).toBe(12);
  });

  test("trail weight slider supports lighter and heavier strokes", () => {
    expect(translateSliderValue(1, TRAIL_WEIGHT_MAPPING)).toBe(0.25);
    expect(translateSliderValue(20, TRAIL_WEIGHT_MAPPING)).toBe(4);
    expect(translateSimulationValue(1.15, TRAIL_WEIGHT_MAPPING)).toBeCloseTo(5.56, 2);
  });

  test("simulation values can be translated back into slider values", () => {
    expect(translateSimulationValue(0, DAMPING_MAPPING)).toBe(1);
    expect(translateSimulationValue(16, DAMPING_MAPPING)).toBe(100);
    expect(translateSimulationValue(120000, GRAVITY_MAPPING)).toBe(100);
  });
});
