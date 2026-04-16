import type { SurfaceContext, SurfaceDefinition, UploadedSurfaceId } from "./types";

export const UPLOADED_HEIGHT_MAP_SURFACE_ID: UploadedSurfaceId = "uploaded-height-map";
const DEFAULT_LABEL = "Uploaded Height Map";

export interface HeightMapPixels {
  width: number;
  height: number;
  values: Float32Array;
}

interface ImageLikeData {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getPixelIndex(x: number, y: number, width: number) {
  return y * width + x;
}

function sampleHeight(pixels: HeightMapPixels, x: number, y: number) {
  const sampleX = clamp(x, 0, pixels.width - 1);
  const sampleY = clamp(y, 0, pixels.height - 1);
  const x0 = Math.floor(sampleX);
  const y0 = Math.floor(sampleY);
  const x1 = Math.min(x0 + 1, pixels.width - 1);
  const y1 = Math.min(y0 + 1, pixels.height - 1);
  const tx = sampleX - x0;
  const ty = sampleY - y0;

  const topLeft = pixels.values[getPixelIndex(x0, y0, pixels.width)] ?? 0;
  const topRight = pixels.values[getPixelIndex(x1, y0, pixels.width)] ?? topLeft;
  const bottomLeft = pixels.values[getPixelIndex(x0, y1, pixels.width)] ?? topLeft;
  const bottomRight = pixels.values[getPixelIndex(x1, y1, pixels.width)] ?? topLeft;

  const top = topLeft + (topRight - topLeft) * tx;
  const bottom = bottomLeft + (bottomRight - bottomLeft) * tx;

  return top + (bottom - top) * ty;
}

function toPixelSpace(x: number, y: number, context: SurfaceContext, pixels: HeightMapPixels) {
  const widthDenominator = Math.max(1, context.width - 1);
  const heightDenominator = Math.max(1, context.height - 1);

  return {
    px: (clamp(x, 0, context.width - 1) / widthDenominator) * Math.max(0, pixels.width - 1),
    py: (clamp(y, 0, context.height - 1) / heightDenominator) * Math.max(0, pixels.height - 1),
  };
}

export function createHeightMapPixels(imageData: ImageLikeData): HeightMapPixels {
  const pixelCount = imageData.width * imageData.height;
  const values = new Float32Array(pixelCount);

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    const red = Number(imageData.data[offset] ?? 0);
    const green = Number(imageData.data[offset + 1] ?? 0);
    const blue = Number(imageData.data[offset + 2] ?? 0);
    const alpha = Number(imageData.data[offset + 3] ?? 255) / 255;
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;

    values[index] = luminance * alpha + (1 - alpha);
  }

  return {
    width: imageData.width,
    height: imageData.height,
    values,
  };
}

export function createUploadedHeightMapSurface(
  pixels: HeightMapPixels,
  sourceLabel = DEFAULT_LABEL,
): SurfaceDefinition<UploadedSurfaceId> {
  return {
    id: UPLOADED_HEIGHT_MAP_SURFACE_ID,
    label: DEFAULT_LABEL,
    description: `Grayscale height map generated from ${sourceLabel}.`,
    heightAt: (x, y, context) => {
      const { px, py } = toPixelSpace(x, y, context, pixels);
      return sampleHeight(pixels, px, py);
    },
    gradientAt: (x, y, context) => {
      const stepX = context.width / Math.max(1, pixels.width - 1);
      const stepY = context.height / Math.max(1, pixels.height - 1);
      const sampleStepX = Math.max(1, stepX);
      const sampleStepY = Math.max(1, stepY);
      const left = createUploadedHeightMapSurfaceSample(pixels, x - sampleStepX, y, context);
      const right = createUploadedHeightMapSurfaceSample(pixels, x + sampleStepX, y, context);
      const top = createUploadedHeightMapSurfaceSample(pixels, x, y - sampleStepY, context);
      const bottom = createUploadedHeightMapSurfaceSample(pixels, x, y + sampleStepY, context);

      return {
        dx: (right - left) / (2 * sampleStepX),
        dy: (bottom - top) / (2 * sampleStepY),
      };
    },
  };
}

function createUploadedHeightMapSurfaceSample(
  pixels: HeightMapPixels,
  x: number,
  y: number,
  context: SurfaceContext,
) {
  const { px, py } = toPixelSpace(x, y, context, pixels);
  return sampleHeight(pixels, px, py);
}
