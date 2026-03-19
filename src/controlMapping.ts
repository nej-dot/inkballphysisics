export interface SliderMapping {
  uiMin: number;
  uiMax: number;
  simulationMin: number;
  simulationMax: number;
}

export const DAMPING_MAPPING: SliderMapping = {
  uiMin: 1,
  uiMax: 100,
  simulationMin: 0,
  simulationMax: 16,
};

export const GRAVITY_MAPPING: SliderMapping = {
  uiMin: 1,
  uiMax: 100,
  simulationMin: 0,
  simulationMax: 120000,
};

export const BALL_SIZE_MAPPING: SliderMapping = {
  uiMin: 1,
  uiMax: 20,
  simulationMin: 1,
  simulationMax: 20,
};

export const TRAIL_WEIGHT_MAPPING: SliderMapping = {
  uiMin: 1,
  uiMax: 100,
  simulationMin: 0.25,
  simulationMax: 4,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function translateSliderValue(value: number, mapping: SliderMapping) {
  const clampedValue = clamp(value, mapping.uiMin, mapping.uiMax);
  const uiSpan = mapping.uiMax - mapping.uiMin;

  if (uiSpan === 0) {
    return mapping.simulationMin;
  }

  const ratio = (clampedValue - mapping.uiMin) / uiSpan;
  return mapping.simulationMin + ratio * (mapping.simulationMax - mapping.simulationMin);
}

export function translateSimulationValue(value: number, mapping: SliderMapping) {
  const clampedValue = clamp(value, mapping.simulationMin, mapping.simulationMax);
  const simulationSpan = mapping.simulationMax - mapping.simulationMin;

  if (simulationSpan === 0) {
    return mapping.uiMin;
  }

  const ratio = (clampedValue - mapping.simulationMin) / simulationSpan;
  return mapping.uiMin + ratio * (mapping.uiMax - mapping.uiMin);
}
