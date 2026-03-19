import type { Ball } from "./types";

const TRAIL_STROKE = "#111111";
const BALL_STROKE = "#111111";
const BALL_FILL = "#ffffff";
const CANVAS_BACKGROUND = "#ffffff";
const DEFAULT_TRAIL_STROKE_WIDTH = 1.15;

export class CanvasRenderer {
  private readonly context: CanvasRenderingContext2D;

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

  render(balls: Ball[], showTrails = true, trailStrokeWidth = DEFAULT_TRAIL_STROKE_WIDTH) {
    this.context.fillStyle = CANVAS_BACKGROUND;
    this.context.clearRect(0, 0, this.width, this.height);
    this.context.fillRect(0, 0, this.width, this.height);

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
}
