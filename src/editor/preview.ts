/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import type { CanvasSize } from './types';

type PreviewRegion = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type PreviewLayerSource = {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
};

// RGBAピクセル配列から PNG Data URL を生成する。
export function createImagePreviewDataUrl(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  repeatX = 1,
  repeatY = 1
): string {
  if (width <= 0 || height <= 0) {
    return '';
  }

  const requiredLength = width * height * 4;
  if (pixels.length < requiredLength) {
    return '';
  }

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceContext = sourceCanvas.getContext('2d');
  if (!sourceContext) {
    return '';
  }

  sourceContext.putImageData(new ImageData(pixels.slice(), width, height), 0, 0);

  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = width * Math.max(1, repeatX);
  previewCanvas.height = height * Math.max(1, repeatY);
  const previewContext = previewCanvas.getContext('2d');
  if (!previewContext) {
    return sourceCanvas.toDataURL('image/png');
  }

  previewContext.imageSmoothingEnabled = false;
  for (let ty = 0; ty < Math.max(1, repeatY); ty += 1) {
    for (let tx = 0; tx < Math.max(1, repeatX); tx += 1) {
      previewContext.drawImage(sourceCanvas, tx * width, ty * height);
    }
  }

  return previewCanvas.toDataURL('image/png');
}

// キャンバス全体から指定矩形だけ切り出して PNG Data URL を生成する。
export function createRegionPreviewDataUrl(
  pixels: Uint8ClampedArray,
  canvasSize: CanvasSize,
  region: PreviewRegion,
  repeatX = 1,
  repeatY = 1
): string {
  if (region.w <= 0 || region.h <= 0) {
    return '';
  }

  const regionPixels = new Uint8ClampedArray(region.w * region.h * 4);
  for (let y = 0; y < region.h; y += 1) {
    for (let x = 0; x < region.w; x += 1) {
      const sourceIndex = ((region.y + y) * canvasSize.width + (region.x + x)) * 4;
      const targetIndex = (y * region.w + x) * 4;
      regionPixels[targetIndex] = pixels[sourceIndex];
      regionPixels[targetIndex + 1] = pixels[sourceIndex + 1];
      regionPixels[targetIndex + 2] = pixels[sourceIndex + 2];
      regionPixels[targetIndex + 3] = pixels[sourceIndex + 3];
    }
  }

  return createImagePreviewDataUrl(regionPixels, region.w, region.h, repeatX, repeatY);
}

function normalizePreviewLayerPixels(
  layer: PreviewLayerSource,
  targetWidth: number,
  targetHeight: number
): Uint8ClampedArray {
  const normalizedPixels = new Uint8ClampedArray(targetWidth * targetHeight * 4);
  const copyWidth = Math.min(layer.width, targetWidth);
  const copyHeight = Math.min(layer.height, targetHeight);

  for (let y = 0; y < copyHeight; y += 1) {
    for (let x = 0; x < copyWidth; x += 1) {
      const sourceIndex = (y * layer.width + x) * 4;
      const targetIndex = (y * targetWidth + x) * 4;
      normalizedPixels[targetIndex] = layer.pixels[sourceIndex];
      normalizedPixels[targetIndex + 1] = layer.pixels[sourceIndex + 1];
      normalizedPixels[targetIndex + 2] = layer.pixels[sourceIndex + 2];
      normalizedPixels[targetIndex + 3] = layer.pixels[sourceIndex + 3];
    }
  }

  return normalizedPixels;
}

function compositePreviewLayer(
  destinationPixels: Uint8ClampedArray,
  sourcePixels: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const totalPixels = width * height;

  for (let index = 0; index < totalPixels; index += 1) {
    const offset = index * 4;
    const sourceAlpha = sourcePixels[offset + 3] / 255;
    if (sourceAlpha <= 0) {
      continue;
    }

    const destinationAlpha = destinationPixels[offset + 3] / 255;
    const outAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);

    if (outAlpha <= 0) {
      destinationPixels[offset] = 0;
      destinationPixels[offset + 1] = 0;
      destinationPixels[offset + 2] = 0;
      destinationPixels[offset + 3] = 0;
      continue;
    }

    const sourceRed = sourcePixels[offset] / 255;
    const sourceGreen = sourcePixels[offset + 1] / 255;
    const sourceBlue = sourcePixels[offset + 2] / 255;
    const destinationRed = destinationPixels[offset] / 255;
    const destinationGreen = destinationPixels[offset + 1] / 255;
    const destinationBlue = destinationPixels[offset + 2] / 255;

    const outRed = (sourceRed * sourceAlpha + destinationRed * destinationAlpha * (1 - sourceAlpha)) / outAlpha;
    const outGreen = (sourceGreen * sourceAlpha + destinationGreen * destinationAlpha * (1 - sourceAlpha)) / outAlpha;
    const outBlue = (sourceBlue * sourceAlpha + destinationBlue * destinationAlpha * (1 - sourceAlpha)) / outAlpha;

    destinationPixels[offset] = Math.round(outRed * 255);
    destinationPixels[offset + 1] = Math.round(outGreen * 255);
    destinationPixels[offset + 2] = Math.round(outBlue * 255);
    destinationPixels[offset + 3] = Math.round(outAlpha * 255);
  }
}

export function createTilePreviewLayerDataUrl(
  layers: PreviewLayerSource[],
  candidateLayer?: PreviewLayerSource | null,
  repeatX = 3,
  repeatY = 3
): string {
  const baseLayer = layers[0] ?? candidateLayer ?? null;
  if (!baseLayer || baseLayer.width <= 0 || baseLayer.height <= 0) {
    return '';
  }

  const composedPixels = new Uint8ClampedArray(baseLayer.width * baseLayer.height * 4);
  const sources = candidateLayer ? [...layers, candidateLayer] : layers;

  for (const sourceLayer of sources) {
    const normalizedLayerPixels =
      sourceLayer.width === baseLayer.width && sourceLayer.height === baseLayer.height
        ? sourceLayer.pixels
        : normalizePreviewLayerPixels(sourceLayer, baseLayer.width, baseLayer.height);
    compositePreviewLayer(composedPixels, normalizedLayerPixels, baseLayer.width, baseLayer.height);
  }

  return createImagePreviewDataUrl(composedPixels, baseLayer.width, baseLayer.height, repeatX, repeatY);
}

export function createTilePreviewLayerThumbnailDataUrl(
  layer: PreviewLayerSource,
  targetWidth: number,
  targetHeight: number
): string {
  if (targetWidth <= 0 || targetHeight <= 0) {
    return '';
  }

  const normalizedPixels =
    layer.width === targetWidth && layer.height === targetHeight
      ? layer.pixels
      : normalizePreviewLayerPixels(layer, targetWidth, targetHeight);

  return createImagePreviewDataUrl(normalizedPixels, targetWidth, targetHeight);
}
