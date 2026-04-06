/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import type { PaletteEntry } from './types';
import { resolveNextSelectedColor } from './app-utils';
import { clonePixels, hexToRgba } from './utils';

export type MergePaletteColorsInput = {
  palette: PaletteEntry[];
  pixels: Uint8ClampedArray;
  selectedColors: string[];
  destinationColor: string;
  currentSelectedColor: string;
};

export type MergePaletteColorsResult = {
  nextPalette: PaletteEntry[];
  nextPixels: Uint8ClampedArray;
  nextSelectedColor: string;
  mergedColorCount: number;
  replacedPixelCount: number;
  removedColorCount: number;
  preservedLockedColorCount: number;
};

function rgbaToUint32(r: number, g: number, b: number, a: number): number {
  return ((((r << 24) | (g << 16) | (b << 8) | a) >>> 0) & 0xffffffff) >>> 0;
}

export function mergePaletteColorsIntoDestination({
  palette,
  pixels,
  selectedColors,
  destinationColor,
  currentSelectedColor,
}: MergePaletteColorsInput): MergePaletteColorsResult | null {
  const normalizedDestinationColor = destinationColor.toLowerCase();
  const normalizedSelectedColors = Array.from(new Set(selectedColors.map((color) => color.toLowerCase()))).filter((color) =>
    palette.some((entry) => entry.color === color)
  );

  if (normalizedSelectedColors.length < 2 || !normalizedSelectedColors.includes(normalizedDestinationColor)) {
    return null;
  }

  const colorsToMerge = normalizedSelectedColors.filter((color) => color !== normalizedDestinationColor);
  if (colorsToMerge.length === 0) {
    return null;
  }

  const colorsToMergeSet = new Set(colorsToMerge);
  const lockedColorsToPreserveSet = new Set(
    palette
      .filter((entry) => colorsToMergeSet.has(entry.color) && entry.locked)
      .map((entry) => entry.color)
  );
  const removableColorsToMergeSet = new Set(
    colorsToMerge.filter((color) => !lockedColorsToPreserveSet.has(color))
  );
  const mergeSourceKeys = new Set(
    colorsToMerge.map((color) => {
      const rgba = hexToRgba(color);
      return rgbaToUint32(rgba.r, rgba.g, rgba.b, rgba.a);
    })
  );
  const destinationRgba = hexToRgba(normalizedDestinationColor);
  const nextPixels = clonePixels(pixels);
  let replacedPixelCount = 0;

  for (let index = 0; index < nextPixels.length; index += 4) {
    const alpha = nextPixels[index + 3];
    if (alpha === 0) {
      continue;
    }

    const pixelKey = rgbaToUint32(nextPixels[index], nextPixels[index + 1], nextPixels[index + 2], alpha);
    if (!mergeSourceKeys.has(pixelKey)) {
      continue;
    }

    nextPixels[index] = destinationRgba.r;
    nextPixels[index + 1] = destinationRgba.g;
    nextPixels[index + 2] = destinationRgba.b;
    nextPixels[index + 3] = destinationRgba.a;
    replacedPixelCount += 1;
  }

  const nextPalette = palette.filter((entry) => !removableColorsToMergeSet.has(entry.color));
  const nextSelectedColor = colorsToMergeSet.has(currentSelectedColor.toLowerCase())
    ? normalizedDestinationColor
    : resolveNextSelectedColor(nextPalette, currentSelectedColor);

  return {
    nextPalette,
    nextPixels,
    nextSelectedColor,
    mergedColorCount: normalizedSelectedColors.length,
    replacedPixelCount,
    removedColorCount: removableColorsToMergeSet.size,
    preservedLockedColorCount: lockedColorsToPreserveSet.size,
  };
}
