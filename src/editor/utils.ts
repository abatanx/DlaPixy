import type { Selection } from './types';

// RGBA値を16進カラー文字列（#rrggbb）に変換する。
export function rgbaToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

// キャンバスサイズを最小値〜最大値の範囲に丸める。
export function clampCanvasSize(size: number, minCanvasSize: number, maxCanvasSize: number): number {
  return Math.max(minCanvasSize, Math.min(maxCanvasSize, size));
}

// 指定サイズの透明キャンバス用ピクセル配列を作成する。
export function createEmptyPixels(canvasSize: number): Uint8ClampedArray {
  return new Uint8ClampedArray(canvasSize * canvasSize * 4);
}

// ピクセル配列をディープコピーしてイミュータブル更新に使う。
export function clonePixels(pixels: Uint8ClampedArray): Uint8ClampedArray {
  return new Uint8ClampedArray(pixels);
}

// 2点間を結ぶラスター線分の全ピクセル座標を返す（Bresenham系）。
export function rasterLinePoints(x0: number, y0: number, x1: number, y1: number): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  let cx = x0;
  let cy = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push({ x: cx, y: cy });
    if (cx === x1 && cy === y1) {
      break;
    }
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }

  return points;
}

// 指定座標が選択範囲内に含まれるかを判定する。
export function pointInSelection(point: { x: number; y: number }, selection: Selection): boolean {
  if (!selection) {
    return false;
  }
  return (
    point.x >= selection.x &&
    point.y >= selection.y &&
    point.x < selection.x + selection.w &&
    point.y < selection.y + selection.h
  );
}

// 選択範囲をキャンバス内に収まるように補正し、無効ならnullを返す。
export function clampSelectionToCanvas(selection: Selection, canvasSize: number): Selection {
  if (!selection) {
    return null;
  }
  if (selection.x >= canvasSize || selection.y >= canvasSize) {
    return null;
  }

  const w = Math.min(selection.w, canvasSize - selection.x);
  const h = Math.min(selection.h, canvasSize - selection.y);
  if (w <= 0 || h <= 0) {
    return null;
  }

  return { x: selection.x, y: selection.y, w, h };
}

// 選択範囲オブジェクトをディープコピーする。
export function cloneSelection(selection: Selection): Selection {
  if (!selection) {
    return null;
  }
  return { x: selection.x, y: selection.y, w: selection.w, h: selection.h };
}

// ブロック画像をベース画像へ合成して、新しいピクセル配列を返す。
export function blitBlockOnCanvas(
  basePixels: Uint8ClampedArray,
  canvasSize: number,
  blockPixels: Uint8ClampedArray,
  blockWidth: number,
  blockHeight: number,
  destX: number,
  destY: number
): Uint8ClampedArray {
  const next = clonePixels(basePixels);
  for (let y = 0; y < blockHeight; y += 1) {
    for (let x = 0; x < blockWidth; x += 1) {
      const srcIdx = (y * blockWidth + x) * 4;
      const dstIdx = ((destY + y) * canvasSize + (destX + x)) * 4;
      next[dstIdx] = blockPixels[srcIdx];
      next[dstIdx + 1] = blockPixels[srcIdx + 1];
      next[dstIdx + 2] = blockPixels[srcIdx + 2];
      next[dstIdx + 3] = blockPixels[srcIdx + 3];
    }
  }
  return next;
}
