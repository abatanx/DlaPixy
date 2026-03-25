export const TRANSPARENT_BACKGROUND_MODES = [
  'white-check',
  'black-check',
  'white',
  'black',
  'magenta'
] as const;

export type TransparentBackgroundMode = (typeof TRANSPARENT_BACKGROUND_MODES)[number];

export const DEFAULT_TRANSPARENT_BACKGROUND_MODE: TransparentBackgroundMode = 'white-check';

export const TRANSPARENT_BACKGROUND_LABELS: Record<TransparentBackgroundMode, string> = {
  'white-check': '白チェック',
  'black-check': '黒チェック',
  white: '白',
  black: '黒',
  magenta: 'マゼンタ'
};

export function isTransparentBackgroundMode(value: unknown): value is TransparentBackgroundMode {
  return typeof value === 'string' && TRANSPARENT_BACKGROUND_MODES.includes(value as TransparentBackgroundMode);
}
