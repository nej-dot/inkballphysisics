import type { Ball, SurfaceContext, SurfaceDefinition } from "./types";

const TRAIL_STROKE = "#111111";
const BALL_STROKE = "#111111";
const BALL_FILL = "#ffffff";
const CANVAS_BACKGROUND = "#ffffff";
const DEFAULT_TRAIL_STROKE_WIDTH = 1.15;
const HEIGHT_MAP_CELL_SIZE = 12;
const HEIGHT_MAP_LEVELS = 6;
const HEIGHT_MAP_LIGHTNESS_MIN = 152;
const HEIGHT_MAP_LIGHTNESS_MAX = 244;

interface HeightMapRenderOptions {
  surface: SurfaceDefinition;
  context: SurfaceContext;
}

interface CanvasRenderOptions {
  showTrails?: boolean;
  trailStrokeWidth?: number;
  heightMap?: HeightMapRenderOptions;
}

export class CanvasRenderer {
  private readonly context: CanvasRenderingContext2D;
  private heightMapCacheKey: string | null = null;
  private heightMapCanvas: HTMLCanvasElement | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly width: number, private readonly height: number) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context is unavailable.");
    }

    this.context = context;
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const displayHeight = Math.max(1, Math.round(this.canvas.clientHeight * dpr));

    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
    }

    this.context.setTransform(displayWidth / this.width, 0, 0, displayHeight / this.height, 0, 0);
  }

  render(balls: Ball[], options: CanvasRenderOptions = {}) {
    const { showTrails = true, trailStrokeWidth = DEFAULT_TRAIL_STROKE_WIDTH, heightMap } = options;

    this.context.fillStyle = CANVAS_BACKGROUND;
    this.context.clearRect(0, 0, this.width, this.height);
    this.context.fillRect(0, 0, this.width, this.height);

    if (heightMap) {
      this.drawHeightMap(heightMap.surface, heightMap.context);
    }

    this.context.strokeStyle = "#111111";
    this.context.lineWidth = 1;
    this.context.strokeRect(0.5, 0.5, this.width - 1, this.height - 1);

    if (showTrails) {
      this.context.strokeStyle = TRAIL_STROKE;
      this.context.lineWidth = trailStrokeWidth;
      this.context.lineCap = "round";
      this.context.lineJoin = "round";

      for (const ball of balls) {
        for (const segment of ball.trailSegments) {
          if (segment.length < 2) {
            continue;
          }

          this.context.beginPath();
          this.context.moveTo(segment[0].x, segment[0].y);
          for (let index = 1; index < segment.length; index += 1) {
            const point = segment[index];
            this.context.lineTo(point.x, point.y);
          }
          this.context.stroke();
        }
      }
    }

    this.context.strokeStyle = BALL_STROKE;
    this.context.fillStyle = BALL_FILL;
    this.context.lineWidth = 1.6;
    for (const ball of balls) {
      this.context.beginPath();
      this.context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      this.context.fill();
      this.context.stroke();
    }
  }

  private drawHeightMap(surface: SurfaceDefinition, surfaceContext: SurfaceContext) {
    const cacheKey = [
      surface.id,
      surfaceContext.width,
      surfaceContext.height,
      surfaceContext.scale,
      surfaceContext.centerX,
      surfaceContext.centerY,
      this.width,
      this.height,
    ].join(":");

    if (cacheKey !== this.heightMapCacheKey || !this.heightMapCanvas) {
      const canvas = document.createElement("canvas");
      canvas.width = this.width;
      canvas.height = this.height;

      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      const columns = Math.max(1, Math.ceil(this.width / HEIGHT_MAP_CELL_SIZE));
      const rows = Math.max(1, Math.ceil(this.height / HEIGHT_MAP_CELL_SIZE));
      const cellWidth = this.width / columns;
      const cellHeight = this.height / rows;
      const heights: number[] = [];
      let minHeight = Number.POSITIVE_INFINITY;
      let maxHeight = Number.NEGATIVE_INFINITY;

      for (let row = 0; row < rows; row += 1) {
        const sampleY = Math.min(this.height, (row + 0.5) * cellHeight);

        for (let column = 0; column < columns; column += 1) {
          const sampleX = Math.min(this.width, (column + 0.5) * cellWidth);
          const value = surface.heightAt(sampleX, sampleY, surfaceContext);
          heights.push(value);
          minHeight = Math.min(minHeight, value);
          maxHeight = Math.max(maxHeight, value);
        }
      }

      const span = maxHeight - minHeight;
      let index = 0;
      for (let row = 0; row < rows; row += 1) {
        const y = row * cellHeight;

        for (let column = 0; column < columns; column += 1) {
          const x = column * cellWidth;
          const height = heights[index];
          index += 1;

          const normalized = span > Number.EPSILON ? (height - minHeight) / span : 0.5;
          const quantized = Math.round(normalized * (HEIGHT_MAP_LEVELS - 1)) / (HEIGHT_MAP_LEVELS - 1);
          const lightness = Math.round(
            HEIGHT_MAP_LIGHTNESS_MAX - quantized * (HEIGHT_MAP_LIGHTNESS_MAX - HEIGHT_MAP_LIGHTNESS_MIN),
          );

          context.fillStyle = `rgb(${lightness}, ${lightness}, ${lightness})`;
          context.fillRect(x, y, cellWidth + 1, cellHeight + 1);
        }
      }

      this.heightMapCanvas = canvas;
      this.heightMapCacheKey = cacheKey;
    }

    if (this.heightMapCanvas) {
      this.context.drawImage(this.heightMapCanvas, 0, 0, this.width, this.height);
    }
  }
}
