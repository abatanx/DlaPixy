/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

export type EditorSlice = {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export const SLICE_NAME_MAX_LENGTH = 100;
const SLICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isEditorSliceId(value: unknown): value is string {
  return typeof value === 'string' && SLICE_ID_PATTERN.test(value);
}

export function generateEditorSliceId(): string {
  return globalThis.crypto.randomUUID().toLowerCase();
}

export function normalizeSliceName(value: string): string {
  return Array.from(value.trim()).slice(0, SLICE_NAME_MAX_LENGTH).join('');
}
