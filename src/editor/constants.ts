// グリッド線の選択肢（ピクセル間隔）。
export const GRID_SPACING_OPTIONS = [8, 16, 32] as const;
// 初期グリッド間隔。
export const DEFAULT_GRID_SPACING = 16;
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

// 初期パレットカラー。
export const DEFAULT_PALETTE = ['#000000', '#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#0ea5e9'];
