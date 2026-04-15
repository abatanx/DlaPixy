/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { generatePaletteEntryId, normalizePaletteEntries, type PaletteEntry } from '../../shared/palette';
import type { CanvasSize } from './types';
import { rgbaToHex8 } from './utils';

export type PaletteUsageEntry = {
  color: string;
  count: number;
  firstX: number;
  firstY: number;
};

export type PaletteUsageAnalysis = {
  orderedColors: string[];
  byColor: Record<string, PaletteUsageEntry>;
};

export type PaletteSyncOptions = {
  removeUnusedColors?: boolean;
  addUsedColors?: boolean;
};

export type UnusedPaletteCleanupOptions = {
  removeLocked?: boolean;
  removeCaptioned?: boolean;
};

export function collectPaletteUsageFromPixels(
  pixels: Uint8ClampedArray,
  canvasSize: CanvasSize
): PaletteUsageAnalysis {
  const orderedColors: string[] = [];
  const byColor: Record<string, PaletteUsageEntry> = {};

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha === 0) {
      continue;
    }

    const color = rgbaToHex8(pixels[index], pixels[index + 1], pixels[index + 2], alpha);
    const existing = byColor[color];
    if (existing) {
      existing.count += 1;
      continue;
    }

    const pixelIndex = index / 4;
    const firstY = Math.floor(pixelIndex / canvasSize.width);
    const firstX = pixelIndex % canvasSize.width;

    byColor[color] = {
      color,
      count: 1,
      firstX,
      firstY
    };
    orderedColors.push(color);
  }

  return {
    orderedColors,
    byColor
  };
}

export function syncPaletteEntriesWithUsage(
  currentPalette: PaletteEntry[],
  usage: PaletteUsageAnalysis,
  options: PaletteSyncOptions = {}
): PaletteEntry[] {
  const normalizedCurrentPalette = normalizePaletteEntries(currentPalette);
  const removeUnusedColors = options.removeUnusedColors === true;
  const addUsedColors = options.addUsedColors !== false;
  const removableUnusedColors = new Set(collectUnusedPaletteEntries(normalizedCurrentPalette, usage).map((entry) => entry.color));

  const nextPalette = removeUnusedColors
    ? normalizedCurrentPalette.filter((entry) => !removableUnusedColors.has(entry.color))
    : normalizedCurrentPalette.map((entry) => ({ ...entry }));

  if (!addUsedColors) {
    return normalizePaletteEntries(nextPalette);
  }

  const seenColors = new Set(nextPalette.map((entry) => entry.color));
  for (const color of usage.orderedColors) {
    if (seenColors.has(color)) {
      continue;
    }
    seenColors.add(color);
    nextPalette.push({
      id: generatePaletteEntryId(),
      color,
      caption: '',
      locked: false
    });
  }

  return normalizePaletteEntries(nextPalette);
}

export function syncPaletteEntriesFromPixels(
  currentPalette: PaletteEntry[],
  pixels: Uint8ClampedArray,
  canvasSize: CanvasSize,
  options: PaletteSyncOptions = {}
): { palette: PaletteEntry[]; usage: PaletteUsageAnalysis } {
  const usage = collectPaletteUsageFromPixels(pixels, canvasSize);
  return {
    palette: syncPaletteEntriesWithUsage(currentPalette, usage, options),
    usage
  };
}

export function collectUnusedPaletteEntries(
  currentPalette: PaletteEntry[],
  usage: PaletteUsageAnalysis,
  options: UnusedPaletteCleanupOptions = {}
): PaletteEntry[] {
  const normalizedCurrentPalette = normalizePaletteEntries(currentPalette);
  const removeLocked = options.removeLocked === true;
  const removeCaptioned = options.removeCaptioned === true;

  return normalizedCurrentPalette.filter((entry) => {
    if (usage.byColor[entry.color]) {
      return false;
    }
    if (!removeLocked && entry.locked) {
      return false;
    }
    if (!removeCaptioned && entry.caption.length > 0) {
      return false;
    }
    return true;
  });
}

export function formatPaletteUsageLabel(count: number): string {
  if (count <= 999) {
    return String(count);
  }

  const units = [
    { suffix: 'T', value: 1_000_000_000_000 },
    { suffix: 'G', value: 1_000_000_000 },
    { suffix: 'M', value: 1_000_000 },
    { suffix: 'K', value: 1_000 }
  ] as const;

  for (const unit of units) {
    if (count >= unit.value) {
      return `~${Math.max(1, Math.floor(count / unit.value))}${unit.suffix}`;
    }
  }

  return String(count);
}
