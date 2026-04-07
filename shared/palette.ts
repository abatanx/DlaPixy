/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

export type PaletteEntry = {
  id: string;
  color: string;
  caption: string;
  locked: boolean;
};

export const PALETTE_CAPTION_MAX_LENGTH = 100;
const PALETTE_ENTRY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPaletteEntryId(value: unknown): value is string {
  return typeof value === 'string' && PALETTE_ENTRY_ID_PATTERN.test(value);
}

export function generatePaletteEntryId(): string {
  return globalThis.crypto.randomUUID().toLowerCase();
}

export function normalizeColorHex(value: string): string | null {
  const normalized = value.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `#${normalized.toLowerCase()}ff`;
  }
  if (/^[0-9a-fA-F]{8}$/.test(normalized)) {
    return `#${normalized.toLowerCase()}`;
  }
  return null;
}

export function normalizePaletteCaption(value: string): string {
  return Array.from(value.trim()).slice(0, PALETTE_CAPTION_MAX_LENGTH).join('');
}

export function normalizePaletteEntries(entries: PaletteEntry[]): PaletteEntry[] {
  const seenColors = new Set<string>();
  const normalizedEntries: PaletteEntry[] = [];

  for (const entry of entries) {
    const color =
      entry && typeof entry === 'object' && typeof entry.color === 'string'
        ? normalizeColorHex(entry.color)
        : null;
    if (!color || seenColors.has(color)) {
      continue;
    }

    seenColors.add(color);
    normalizedEntries.push({
      id: isPaletteEntryId(entry?.id) ? entry.id.toLowerCase() : generatePaletteEntryId(),
      color,
      caption: typeof entry.caption === 'string' ? normalizePaletteCaption(entry.caption) : '',
      locked: entry?.locked === true
    });
  }

  return normalizedEntries;
}
