/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

export const FLOATING_COMPOSITE_MODES = [
  'replace',
  'blend'
] as const;

export type FloatingCompositeMode = (typeof FLOATING_COMPOSITE_MODES)[number];

export const DEFAULT_FLOATING_COMPOSITE_MODE: FloatingCompositeMode = 'replace';

export const FLOATING_COMPOSITE_MODE_LABELS: Record<FloatingCompositeMode, string> = {
  replace: '置換',
  blend: 'ブレンド'
};

export function isFloatingCompositeMode(value: unknown): value is FloatingCompositeMode {
  return typeof value === 'string' && FLOATING_COMPOSITE_MODES.includes(value as FloatingCompositeMode);
}
