import type { BallPatternId, Point } from "./types";

const TRIANGLE_ROW_HEIGHT = Math.sqrt(3) / 2;

export const BALL_PATTERNS: Array<{ id: BallPatternId; label: string }> = [
  { id: "circle", label: "Circle" },
  { id: "cross", label: "Cross" },
  { id: "horizontal-line", label: "Horizontal Line" },
  { id: "vertical-line", label: "Vertical Line" },
  { id: "triangle", label: "Triangle" },
  { id: "square", label: "Square" },
];

function createLine(count: number, stepX: number, stepY: number) {
  const start = -(count - 1) / 2;
  return Array.from({ length: count }, (_, index) => ({
    x: (start + index) * stepX,
    y: (start + index) * stepY,
  }));
}

function createTriangle(rows: number) {
  const points: Point[] = [];

  for (let row = 0; row < rows; row += 1) {
    const count = row + 1;
    const y = (row - (rows - 1) / 2) * TRIANGLE_ROW_HEIGHT;

    for (let column = 0; column < count; column += 1) {
      points.push({
        x: column - (count - 1) / 2,
        y,
      });
    }
  }

  return points;
}

function createSquare(size: number) {
  const points: Point[] = [];
  const start = -(size - 1) / 2;

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      points.push({
        x: start + column,
        y: start + row,
      });
    }
  }

  return points;
}

function createCircle(count: number, radius: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });
}

export function getPatternOffsets(patternId: BallPatternId, spacing: number) {
  const scalePoint = (point: Point) => ({
    x: point.x * spacing,
    y: point.y * spacing,
  });

  switch (patternId) {
    case "circle":
      return createCircle(12, 2.4).map(scalePoint);
    case "cross":
      return [
        { x: 0, y: -2 },
        { x: 0, y: -1 },
        { x: -2, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
      ].map(scalePoint);
    case "horizontal-line":
      return createLine(7, 1, 0).map(scalePoint);
    case "vertical-line":
      return createLine(7, 0, 1).map(scalePoint);
    case "triangle":
      return createTriangle(4).map(scalePoint);
    case "square":
      return createSquare(3).map(scalePoint);
  }
}
