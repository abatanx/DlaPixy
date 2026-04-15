/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import type { PaletteEntry } from './types';
import { normalizeColorHex } from './utils';

export type PaletteTextImportPreview = {
  extractedColors: string[];
  addableColors: string[];
  existingColors: string[];
};

const PALETTE_TEXT_COLOR_PATTERN =
  /(^|[^#0-9a-fA-F])(#[0-9a-fA-F]{8}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g;

export function normalizePaletteTextImportColor(value: string): string | null {
  const normalized = value.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(normalized)) {
    const expanded = normalized
      .split('')
      .map((channel) => `${channel}${channel}`)
      .join('');
    return normalizeColorHex(expanded);
  }

  return normalizeColorHex(normalized);
}

export function extractPaletteTextImportColors(text: string): string[] {
  const extractedColors: string[] = [];
  const seenColors = new Set<string>();

  for (const match of text.matchAll(PALETTE_TEXT_COLOR_PATTERN)) {
    const candidate = match[2];
    if (!candidate) {
      continue;
    }

    const color = normalizePaletteTextImportColor(candidate);
    if (!color || seenColors.has(color)) {
      continue;
    }

    seenColors.add(color);
    extractedColors.push(color);
  }

  return extractedColors;
}

export function resolvePaletteTextImportPreview(text: string, palette: PaletteEntry[]): PaletteTextImportPreview {
  const extractedColors = extractPaletteTextImportColors(text);
  const existingColors = new Set(palette.map((entry) => entry.color));
  const addableColors: string[] = [];
  const alreadyExistingColors: string[] = [];

  for (const color of extractedColors) {
    if (existingColors.has(color)) {
      alreadyExistingColors.push(color);
      continue;
    }
    addableColors.push(color);
  }

  return {
    extractedColors,
    addableColors,
    existingColors: alreadyExistingColors
  };
}
