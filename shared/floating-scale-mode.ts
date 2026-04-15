/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

export const FLOATING_SCALE_MODES = [
  'crisp',
  'alpha-smooth'
] as const;

export type FloatingScaleMode = (typeof FLOATING_SCALE_MODES)[number];

export const DEFAULT_FLOATING_SCALE_MODE: FloatingScaleMode = 'crisp';

export const FLOATING_SCALE_MODE_LABELS: Record<FloatingScaleMode, string> = {
  crisp: 'きっちり',
  'alpha-smooth': 'αなめらか'
};

export function isFloatingScaleMode(value: unknown): value is FloatingScaleMode {
  return typeof value === 'string' && FLOATING_SCALE_MODES.includes(value as FloatingScaleMode);
}
