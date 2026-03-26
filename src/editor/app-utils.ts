import type { PaletteEntry } from './types';

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
