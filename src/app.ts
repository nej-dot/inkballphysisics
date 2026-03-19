import "./style.css";

import { CanvasRenderer } from "./rendering";
import { Simulation } from "./simulation";
import { SURFACES } from "./surfaces";
import { buildSvgDocument, downloadSvg } from "./svg";
import type { SurfaceId } from "./types";

const FIXED_TIMESTEP_SECONDS = 1 / 120;
const SIMULATION_SIZE = 900;
const DEFAULT_SURFACE: SurfaceId = "funnel";
const INITIAL_BALL_COUNT = 2;

function formatNumber(value: number, digits = 2) {
  return value.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

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
            <input data-damping type="range" min="0" max="24" step="0.1" value="0.4" />
          </label>
          <label class="control-group slider-group">
            <span>Gravity <output data-gravity-value></output></span>
            <input data-gravity type="range" min="0" max="120000" step="500" value="100000" />
          </label>
          <label class="control-group slider-group">
            <span>Ball Size <output data-size-value></output></span>
            <input data-size type="range" min="4" max="18" step="1" value="12" />
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
          <p class="section-label">Display</p>
          <div class="button-row">
            <button type="button" data-collisions>Collisions On</button>
            <button type="button" data-trails>Trails On</button>
          </div>
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
          <p class="canvas-note">Click anywhere in the drawing area to place a ball. Press Space to start or pause.</p>
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
  const toggleButton = root.querySelector<HTMLButtonElement>("[data-toggle]");
  const resetButton = root.querySelector<HTMLButtonElement>("[data-reset]");
  const trailsButton = root.querySelector<HTMLButtonElement>("[data-trails]");
  const exportButton = root.querySelector<HTMLButtonElement>("[data-export]");
  const dampingInput = root.querySelector<HTMLInputElement>("[data-damping]");
  const gravityInput = root.querySelector<HTMLInputElement>("[data-gravity]");
  const sizeInput = root.querySelector<HTMLInputElement>("[data-size]");
  const dampingValue = root.querySelector<HTMLOutputElement>("[data-damping-value]");
  const gravityValue = root.querySelector<HTMLOutputElement>("[data-gravity-value]");
  const sizeValue = root.querySelector<HTMLOutputElement>("[data-size-value]");
  const statusLabel = root.querySelector<HTMLElement>("[data-status]");
  const ballCountLabel = root.querySelector<HTMLElement>("[data-ball-count]");
  const surfaceDescription = root.querySelector<HTMLElement>("[data-surface-description]");
  const canvas = root.querySelector<HTMLCanvasElement>("[data-canvas]");

  if (
    !surfaceSelect ||
    !addBallButton ||
    !removeBallButton ||
    !collisionsButton ||
    !toggleButton ||
    !resetButton ||
    !trailsButton ||
    !exportButton ||
    !dampingInput ||
    !gravityInput ||
    !sizeInput ||
    !dampingValue ||
    !gravityValue ||
    !sizeValue ||
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
    toggleButton,
    resetButton,
    trailsButton,
    exportButton,
    dampingInput,
    gravityInput,
    sizeInput,
    dampingValue,
    gravityValue,
    sizeValue,
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

  const simulation = new Simulation(
    {
      width: SIMULATION_SIZE,
      height: SIMULATION_SIZE,
      gravityStrength: Number(ui.gravityInput.value),
      damping: Number(ui.dampingInput.value),
      bounce: 0.55,
      collisionRestitution: 0.94,
      trailSpacing: 1.8,
      spawnMargin: 64,
      defaultBallRadius: Number(ui.sizeInput.value),
    },
    DEFAULT_SURFACE,
  );

  const renderer = new CanvasRenderer(ui.canvas, simulation.width, simulation.height);
  let running = false;
  let trailsEnabled = true;
  let accumulator = 0;
  let lastTimestamp = performance.now();

  function seedInitialBalls() {
    for (let index = 0; index < INITIAL_BALL_COUNT; index += 1) {
      simulation.addBall();
    }
  }

  function updateReadouts() {
    ui.dampingValue.value = formatNumber(Number(ui.dampingInput.value), 1);
    ui.gravityValue.value = `${Math.round(Number(ui.gravityInput.value))}`;
    ui.sizeValue.value = `${Math.round(Number(ui.sizeInput.value))}`;
    ui.statusLabel.textContent = running ? "Running" : "Paused";
    ui.statusLabel.dataset.state = running ? "running" : "paused";
    ui.toggleButton.textContent = running ? "Pause" : "Start";
    ui.toggleButton.setAttribute("aria-pressed", running ? "true" : "false");
    ui.collisionsButton.textContent = simulation.collisionsEnabled ? "Collisions On" : "Collisions Off";
    ui.collisionsButton.setAttribute("aria-pressed", simulation.collisionsEnabled ? "true" : "false");
    ui.trailsButton.textContent = trailsEnabled ? "Trails On" : "Trails Off";
    ui.trailsButton.setAttribute("aria-pressed", trailsEnabled ? "true" : "false");
    ui.removeBallButton.disabled = simulation.ballCount === 0;
    ui.ballCountLabel.textContent = `${simulation.ballCount} ${simulation.ballCount === 1 ? "ball" : "balls"}`;
    ui.surfaceDescription.textContent = simulation.surface.description;
  }

  function render() {
    renderer.resize();
    renderer.render(simulation.getBalls(), trailsEnabled);
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
    simulation.setDamping(Number(ui.dampingInput.value));
    updateReadouts();
  });

  ui.gravityInput.addEventListener("input", () => {
    simulation.setGravityStrength(Number(ui.gravityInput.value));
    updateReadouts();
  });

  ui.sizeInput.addEventListener("input", () => {
    simulation.setBallRadius(Number(ui.sizeInput.value));
    updateReadouts();
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

  ui.collisionsButton.addEventListener("click", () => {
    simulation.setBallCollisionsEnabled(!simulation.collisionsEnabled);
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
    const svg = buildSvgDocument(simulation.width, simulation.height, simulation.getBalls());
    downloadSvg(`inkball-${simulation.surfacePreset}.svg`, svg);
  });

  ui.canvas.addEventListener("click", (event) => {
    const rect = ui.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * simulation.width;
    const y = ((event.clientY - rect.top) / rect.height) * simulation.height;
    simulation.addBallAt(x, y);
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
