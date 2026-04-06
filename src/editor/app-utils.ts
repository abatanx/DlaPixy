/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import type { PaletteEntry } from './types';

export function hasSamePaletteEntries(left: PaletteEntry[], right: PaletteEntry[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (entry, index) =>
      entry.id === right[index]?.id &&
      entry.color === right[index]?.color &&
      entry.caption === right[index]?.caption &&
      entry.locked === right[index]?.locked
  );
}

export function resolveNextSelectedColor(nextPalette: PaletteEntry[], currentSelectedColor: string): string {
  return nextPalette.some((entry) => entry.color === currentSelectedColor)
    ? currentSelectedColor
    : nextPalette[0]?.color ?? currentSelectedColor;
}

export function getFileNameFromPath(filePath?: string): string | null {
  if (!filePath) {
    return null;
  }

  const parts = filePath.split(/[\\/]/);
  const fileName = parts[parts.length - 1]?.trim();
  return fileName || null;
}

export function replaceFileExtension(fileName: string, nextExtension: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, '') || fileName;
  return `${baseName}${nextExtension}`;
}
