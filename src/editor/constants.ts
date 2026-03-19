import { PALETTE_CAPTION_MAX_LENGTH as SHARED_PALETTE_CAPTION_MAX_LENGTH, type PaletteEntry } from '../../shared/palette';

export const PALETTE_CAPTION_MAX_LENGTH = SHARED_PALETTE_CAPTION_MAX_LENGTH;

// グリッド線の選択肢（ピクセル間隔）。0 は「なし」を表す。
export const GRID_SPACING_OPTIONS = [0, 8, 16, 32] as const;
// 初期グリッド間隔（なし）。
export const DEFAULT_GRID_SPACING = 0;
// 初期キャンバスサイズ（正方形）。
export const DEFAULT_CANVAS_SIZE = 256;
// 初期表示倍率。
export const DEFAULT_ZOOM = 3;
// 表示倍率の下限。
export const MIN_ZOOM = 1;
// 表示倍率の上限。
export const MAX_ZOOM = 12;
// Undo履歴の保持上限件数。
export const MAX_UNDO = 40;
// キャンバスサイズの下限。
export const MIN_CANVAS_SIZE = 8;
// キャンバスサイズの上限。
export const MAX_CANVAS_SIZE = 1024;
const WEB_SAFE_CHANNELS = ['00', '33', '66', '99', 'CC', 'FF'] as const;

// 初期パレットカラーは Web Safe Color 216 色。
export const DEFAULT_PALETTE = WEB_SAFE_CHANNELS.flatMap((r) =>
  WEB_SAFE_CHANNELS.flatMap((g) =>
    WEB_SAFE_CHANNELS.map(
      (b): PaletteEntry => ({
        color: `#${r}${g}${b}`.toLowerCase(),
        caption: ''
      })
    )
  )
);
