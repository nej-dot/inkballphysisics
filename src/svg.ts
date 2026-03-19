import type { Ball } from "./types";

const EXPORT_WIDTH_MM = 200;
const EXPORT_STROKE_WIDTH = 1.15;

function pathFromTrailSegment(segment: Ball["trailSegments"][number]) {
  if (segment.length < 2) {
    return "";
  }

  return segment
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");
}

export function buildSvgDocument(width: number, height: number, balls: Ball[], trailStrokeWidth = EXPORT_STROKE_WIDTH) {
  const exportHeightMm = (height / width) * EXPORT_WIDTH_MM;
  const paths = balls
    .flatMap((ball) => ball.trailSegments.map((segment) => pathFromTrailSegment(segment)))
    .filter(Boolean)
    .map(
      (pathData) =>
        `  <path d="${pathData}" fill="none" stroke="#000000" stroke-width="${trailStrokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`,
    )
    .join("\n");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${EXPORT_WIDTH_MM}mm" height="${exportHeightMm.toFixed(2)}mm" viewBox="0 0 ${width} ${height}">`,
    paths,
    `</svg>`,
  ].join("\n");
}

export function downloadSvg(filename: string, svgMarkup: string) {
  const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
