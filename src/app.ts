import "./style.css";

import {
  BALL_SIZE_MAPPING,
  DAMPING_MAPPING,
  GRAVITY_MAPPING,
  TRAIL_WEIGHT_MAPPING,
  translateSimulationValue,
  translateSliderValue,
} from "./controlMapping";
import { BALL_PATTERNS } from "./patterns";
import { CanvasRenderer } from "./rendering";
import { Simulation } from "./simulation";
import { SURFACES } from "./surfaces";
import { buildSvgDocument, downloadSvg } from "./svg";
import type { BallPatternId, SurfaceContext, SurfaceId } from "./types";

const FIXED_TIMESTEP_SECONDS = 1 / 120;
const SIMULATION_SIZE = 900;
const DEFAULT_SURFACE: SurfaceId = "funnel";
const INITIAL_BALL_COUNT = 2;
const DEFAULT_DAMPING = 0.4;
const DEFAULT_GRAVITY = 100000;
const DEFAULT_BALL_SIZE = 12;
const DEFAULT_TRAIL_WEIGHT = 1.15;
const DEFAULT_DAMPING_SLIDER_VALUE = Math.round(translateSimulationValue(DEFAULT_DAMPING, DAMPING_MAPPING));
const DEFAULT_GRAVITY_SLIDER_VALUE = Math.round(translateSimulationValue(DEFAULT_GRAVITY, GRAVITY_MAPPING));
const DEFAULT_BALL_SIZE_SLIDER_VALUE = Math.round(translateSimulationValue(DEFAULT_BALL_SIZE, BALL_SIZE_MAPPING));
const DEFAULT_TRAIL_WEIGHT_SLIDER_VALUE = Math.round(
  translateSimulationValue(DEFAULT_TRAIL_WEIGHT, TRAIL_WEIGHT_MAPPING),
);

export function createApp(root: HTMLElement) {
  root.innerHTML = `
    <main class="shell">
      <aside class="side-panel controls-panel">
        <div class="panel-heading">
          <p class="panel-eyebrow">Inkball Physics</p>
          <h1 class="panel-title">Controls</h1>
          <p class="panel-copy">Adjust the motion, then place balls directly on the canvas.</p>
        </div>

        <section class="control-section">
          <label class="control-group">
            <span>Surface</span>
            <select data-surface></select>
          </label>
        </section>

        <section class="control-section">
          <p class="section-label">Physics</p>
          <label class="control-group slider-group">
            <span>Damping <output data-damping-value></output></span>
            <input
              data-damping
              type="range"
              min="${DAMPING_MAPPING.uiMin}"
              max="${DAMPING_MAPPING.uiMax}"
              step="1"
              value="${DEFAULT_DAMPING_SLIDER_VALUE}"
            />
          </label>
          <label class="control-group slider-group">
            <span>Gravity <output data-gravity-value></output></span>
            <input
              data-gravity
              type="range"
              min="${GRAVITY_MAPPING.uiMin}"
              max="${GRAVITY_MAPPING.uiMax}"
              step="1"
              value="${DEFAULT_GRAVITY_SLIDER_VALUE}"
            />
          </label>
          <label class="control-group slider-group">
            <span>Ball Size <output data-size-value></output></span>
            <input
              data-size
              type="range"
              min="${BALL_SIZE_MAPPING.uiMin}"
              max="${BALL_SIZE_MAPPING.uiMax}"
              step="1"
              value="${DEFAULT_BALL_SIZE_SLIDER_VALUE}"
            />
          </label>
        </section>

        <section class="control-section">
          <p class="section-label">Simulation</p>
          <div class="button-row button-row-primary">
            <button type="button" class="primary-action" data-toggle>Start</button>
            <button type="button" data-reset>Reset</button>
          </div>
          <div class="button-row">
            <button type="button" data-add-ball>Add Ball</button>
            <button type="button" data-remove-ball>Remove Ball</button>
          </div>
        </section>

        <section class="control-section">
          <p class="section-label">Patterns</p>
          <label class="control-group">
            <span>Preset</span>
            <select data-pattern></select>
          </label>
          <div class="button-row button-row-single">
            <button type="button" data-stamp-pattern>Stamp Pattern</button>
          </div>
        </section>

        <section class="control-section">
          <p class="section-label">Display</p>
          <label class="control-group slider-group">
            <span>Trail Weight <output data-trail-weight-value></output></span>
            <input
              data-trail-weight
              type="range"
              min="${TRAIL_WEIGHT_MAPPING.uiMin}"
              max="${TRAIL_WEIGHT_MAPPING.uiMax}"
              step="1"
              value="${DEFAULT_TRAIL_WEIGHT_SLIDER_VALUE}"
            />
          </label>
          <div class="button-row">
            <button type="button" data-collisions>Collisions On</button>
            <button type="button" data-trails>Trails On</button>
          </div>
          <div class="button-row button-row-single">
            <button type="button" data-height-map>Height Map Off</button>
          </div>
          <p class="control-hint">Analysis only. This view does not change the simulation or SVG export.</p>
        </section>

        <section class="control-section">
          <p class="section-label">Export</p>
          <div class="button-row">
            <button type="button" data-export>Export SVG</button>
          </div>
        </section>
      </aside>

      <section class="workspace-panel">
        <div class="canvas-header">
          <div class="status-strip">
            <span class="status-pill" data-status>Paused</span>
            <span class="status-pill" data-ball-count>0 balls</span>
            <span class="status-pill surface-pill" data-surface-description></span>
          </div>
          <p class="canvas-note">Click empty space to place a ball, or click an existing ball to remove it. Press Space to start or pause.</p>
        </div>
        <section class="drawing-panel">
          <canvas class="drawing-canvas" width="${SIMULATION_SIZE}" height="${SIMULATION_SIZE}" data-canvas></canvas>
        </section>
      </section>
    </main>
  `;

  const surfaceSelect = root.querySelector<HTMLSelectElement>("[data-surface]");
  const addBallButton = root.querySelector<HTMLButtonElement>("[data-add-ball]");
  const removeBallButton = root.querySelector<HTMLButtonElement>("[data-remove-ball]");
  const collisionsButton = root.querySelector<HTMLButtonElement>("[data-collisions]");
  const heightMapButton = root.querySelector<HTMLButtonElement>("[data-height-map]");
  const toggleButton = root.querySelector<HTMLButtonElement>("[data-toggle]");
  const resetButton = root.querySelector<HTMLButtonElement>("[data-reset]");
  const patternSelect = root.querySelector<HTMLSelectElement>("[data-pattern]");
  const stampPatternButton = root.querySelector<HTMLButtonElement>("[data-stamp-pattern]");
  const trailsButton = root.querySelector<HTMLButtonElement>("[data-trails]");
  const exportButton = root.querySelector<HTMLButtonElement>("[data-export]");
  const dampingInput = root.querySelector<HTMLInputElement>("[data-damping]");
  const gravityInput = root.querySelector<HTMLInputElement>("[data-gravity]");
  const sizeInput = root.querySelector<HTMLInputElement>("[data-size]");
  const trailWeightInput = root.querySelector<HTMLInputElement>("[data-trail-weight]");
  const dampingValue = root.querySelector<HTMLOutputElement>("[data-damping-value]");
  const gravityValue = root.querySelector<HTMLOutputElement>("[data-gravity-value]");
  const sizeValue = root.querySelector<HTMLOutputElement>("[data-size-value]");
  const trailWeightValue = root.querySelector<HTMLOutputElement>("[data-trail-weight-value]");
  const statusLabel = root.querySelector<HTMLElement>("[data-status]");
  const ballCountLabel = root.querySelector<HTMLElement>("[data-ball-count]");
  const surfaceDescription = root.querySelector<HTMLElement>("[data-surface-description]");
  const canvas = root.querySelector<HTMLCanvasElement>("[data-canvas]");

  if (
    !surfaceSelect ||
    !addBallButton ||
    !removeBallButton ||
    !collisionsButton ||
    !heightMapButton ||
    !toggleButton ||
    !resetButton ||
    !patternSelect ||
    !stampPatternButton ||
    !trailsButton ||
    !exportButton ||
    !dampingInput ||
    !gravityInput ||
    !sizeInput ||
    !trailWeightInput ||
    !dampingValue ||
    !gravityValue ||
    !sizeValue ||
    !trailWeightValue ||
    !statusLabel ||
    !ballCountLabel ||
    !surfaceDescription ||
    !canvas
  ) {
    throw new Error("Failed to create the application UI.");
  }

  const ui = {
    surfaceSelect,
    addBallButton,
    removeBallButton,
    collisionsButton,
    heightMapButton,
    toggleButton,
    resetButton,
    patternSelect,
    stampPatternButton,
    trailsButton,
    exportButton,
    dampingInput,
    gravityInput,
    sizeInput,
    trailWeightInput,
    dampingValue,
    gravityValue,
    sizeValue,
    trailWeightValue,
    statusLabel,
    ballCountLabel,
    surfaceDescription,
    canvas,
  };

  for (const surface of SURFACES) {
    const option = document.createElement("option");
    option.value = surface.id;
    option.textContent = surface.label;
    ui.surfaceSelect.append(option);
  }
  ui.surfaceSelect.value = DEFAULT_SURFACE;

  for (const pattern of BALL_PATTERNS) {
    const option = document.createElement("option");
    option.value = pattern.id;
    option.textContent = pattern.label;
    ui.patternSelect.append(option);
  }
  ui.patternSelect.value = BALL_PATTERNS[0]?.id ?? "circle";

  const simulation = new Simulation(
    {
      width: SIMULATION_SIZE,
      height: SIMULATION_SIZE,
      gravityStrength: translateSliderValue(Number(ui.gravityInput.value), GRAVITY_MAPPING),
      damping: translateSliderValue(Number(ui.dampingInput.value), DAMPING_MAPPING),
      bounce: 0.55,
      collisionRestitution: 0.94,
      trailSpacing: 1.8,
      spawnMargin: 64,
      defaultBallRadius: translateSliderValue(Number(ui.sizeInput.value), BALL_SIZE_MAPPING),
    },
    DEFAULT_SURFACE,
  );

  const renderer = new CanvasRenderer(ui.canvas, simulation.width, simulation.height);
  let running = false;
  let trailsEnabled = true;
  let heightMapEnabled = false;
  let trailStrokeWidth = translateSliderValue(Number(ui.trailWeightInput.value), TRAIL_WEIGHT_MAPPING);
  let accumulator = 0;
  let lastTimestamp = performance.now();

  function seedInitialBalls() {
    for (let index = 0; index < INITIAL_BALL_COUNT; index += 1) {
      simulation.addBall();
    }
  }

  function getSurfaceContext(): SurfaceContext {
    return {
      width: simulation.width,
      height: simulation.height,
      scale: Math.min(simulation.width, simulation.height) * 0.42,
      centerX: simulation.width / 2,
      centerY: simulation.height / 2,
    };
  }

  function updateReadouts() {
    ui.dampingValue.value = `${Math.round(Number(ui.dampingInput.value))}`;
    ui.gravityValue.value = `${Math.round(Number(ui.gravityInput.value))}`;
    ui.sizeValue.value = `${Math.round(Number(ui.sizeInput.value))}`;
    ui.trailWeightValue.value = `${trailStrokeWidth.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}`;
    ui.statusLabel.textContent = running ? "Running" : "Paused";
    ui.statusLabel.dataset.state = running ? "running" : "paused";
    ui.toggleButton.textContent = running ? "Pause" : "Start";
    ui.toggleButton.setAttribute("aria-pressed", running ? "true" : "false");
    ui.collisionsButton.textContent = simulation.collisionsEnabled ? "Collisions On" : "Collisions Off";
    ui.collisionsButton.setAttribute("aria-pressed", simulation.collisionsEnabled ? "true" : "false");
    ui.trailsButton.textContent = trailsEnabled ? "Trails On" : "Trails Off";
    ui.trailsButton.setAttribute("aria-pressed", trailsEnabled ? "true" : "false");
    ui.heightMapButton.textContent = heightMapEnabled ? "Height Map On" : "Height Map Off";
    ui.heightMapButton.setAttribute("aria-pressed", heightMapEnabled ? "true" : "false");
    ui.removeBallButton.disabled = simulation.ballCount === 0;
    ui.ballCountLabel.textContent = `${simulation.ballCount} ${simulation.ballCount === 1 ? "ball" : "balls"}`;
    ui.surfaceDescription.textContent = simulation.surface.description;
  }

  function render() {
    renderer.resize();
    renderer.render(simulation.getBalls(), {
      showTrails: trailsEnabled,
      trailStrokeWidth,
      heightMap: heightMapEnabled
        ? {
            surface: simulation.surface,
            context: getSurfaceContext(),
          }
        : undefined,
    });
  }

  function frame(timestamp: number) {
    const frameDelta = Math.min((timestamp - lastTimestamp) / 1000, 0.08);
    lastTimestamp = timestamp;

    if (running) {
      accumulator += frameDelta;
      while (accumulator >= FIXED_TIMESTEP_SECONDS) {
        simulation.step(FIXED_TIMESTEP_SECONDS);
        accumulator -= FIXED_TIMESTEP_SECONDS;
      }
    }

    updateReadouts();
    render();
    window.requestAnimationFrame(frame);
  }

  ui.surfaceSelect.addEventListener("change", () => {
    simulation.setSurface(ui.surfaceSelect.value as SurfaceId);
    updateReadouts();
  });

  ui.dampingInput.addEventListener("input", () => {
    simulation.setDamping(translateSliderValue(Number(ui.dampingInput.value), DAMPING_MAPPING));
    updateReadouts();
  });

  ui.gravityInput.addEventListener("input", () => {
    simulation.setGravityStrength(translateSliderValue(Number(ui.gravityInput.value), GRAVITY_MAPPING));
    updateReadouts();
  });

  ui.sizeInput.addEventListener("input", () => {
    simulation.setBallRadius(translateSliderValue(Number(ui.sizeInput.value), BALL_SIZE_MAPPING));
    updateReadouts();
  });

  ui.trailWeightInput.addEventListener("input", () => {
    trailStrokeWidth = translateSliderValue(Number(ui.trailWeightInput.value), TRAIL_WEIGHT_MAPPING);
    updateReadouts();
    render();
  });

  ui.addBallButton.addEventListener("click", () => {
    simulation.addBall();
    updateReadouts();
    render();
  });

  ui.removeBallButton.addEventListener("click", () => {
    simulation.removeBall();
    updateReadouts();
    render();
  });

  ui.stampPatternButton.addEventListener("click", () => {
    simulation.addPattern(ui.patternSelect.value as BallPatternId);
    updateReadouts();
    render();
  });

  ui.collisionsButton.addEventListener("click", () => {
    simulation.setBallCollisionsEnabled(!simulation.collisionsEnabled);
    updateReadouts();
    render();
  });

  ui.heightMapButton.addEventListener("click", () => {
    heightMapEnabled = !heightMapEnabled;
    updateReadouts();
    render();
  });

  ui.toggleButton.addEventListener("click", () => {
    running = !running;
    updateReadouts();
  });

  ui.resetButton.addEventListener("click", () => {
    running = false;
    accumulator = 0;
    simulation.reset();
    seedInitialBalls();
    updateReadouts();
    render();
  });

  ui.trailsButton.addEventListener("click", () => {
    trailsEnabled = !trailsEnabled;
    simulation.setTrailsEnabled(trailsEnabled);
    updateReadouts();
    render();
  });

  ui.exportButton.addEventListener("click", () => {
    const svg = buildSvgDocument(simulation.width, simulation.height, simulation.getBalls(), trailStrokeWidth);
    downloadSvg(`inkball-${simulation.surfacePreset}.svg`, svg);
  });

  ui.canvas.addEventListener("click", (event) => {
    const rect = ui.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * simulation.width;
    const y = ((event.clientY - rect.top) / rect.height) * simulation.height;

    if (!simulation.removeBallAt(x, y)) {
      simulation.addBallAt(x, y);
    }

    updateReadouts();
    render();
  });

  window.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || event.repeat) {
      return;
    }

    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLButtonElement ||
      target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    event.preventDefault();
    running = !running;
    updateReadouts();
  });

  window.addEventListener("resize", () => render());

  seedInitialBalls();
  updateReadouts();
  render();
  window.requestAnimationFrame(frame);
}
