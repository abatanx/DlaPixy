/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import type { CSSProperties } from 'react';
import type { CanvasSize } from './types';
import {
  cloneSliceExportSettings,
  createDefaultSliceExportSettings,
  generateEditorSliceId,
  hasSameSliceExportSettings,
  isEditorSliceId,
  normalizeSliceExportSettings,
  normalizeSliceName,
  syncSliceExportSettingsWithSize,
  type EditorSlice
} from '../../shared/slice';

export {
  createDefaultSliceExportSettings,
  generateEditorSliceId,
  isEditorSliceId,
  normalizeSliceExportSettings,
  normalizeSliceName,
  syncSliceExportSettingsWithSize
};
export type { EditorSlice };

export type SliceResizeHandle = 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br';

export const SLICE_RESIZE_HANDLE_ORDER: SliceResizeHandle[] = ['tl', 'tc', 'tr', 'ml', 'mr', 'bl', 'bc', 'br'];

type CanvasClientRect = Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom'>;

export function isClientWithinCanvasMargin(
  rect: CanvasClientRect,
  clientX: number,
  clientY: number,
  marginPx: number
): boolean {
  return (
    clientX >= rect.left - marginPx &&
    clientX <= rect.right + marginPx &&
    clientY >= rect.top - marginPx &&
    clientY <= rect.bottom + marginPx
  );
}

export function isClientInsideCanvasRect(rect: CanvasClientRect, clientX: number, clientY: number): boolean {
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

export function cloneSlices(slices: EditorSlice[]): EditorSlice[] {
  return slices.map((slice) => ({
    ...slice,
    exportSettings: slice.exportSettings ? cloneSliceExportSettings(slice.exportSettings) : undefined
  }));
}

export function hasSameSlices(left: EditorSlice[], right: EditorSlice[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (slice, index) =>
      slice.id === right[index]?.id &&
      slice.name === right[index]?.name &&
      slice.x === right[index]?.x &&
      slice.y === right[index]?.y &&
      slice.w === right[index]?.w &&
      slice.h === right[index]?.h &&
      hasSameSliceExportSettings(
        normalizeSliceExportSettings(slice.exportSettings, slice),
        normalizeSliceExportSettings(right[index]?.exportSettings, right[index] ?? slice)
      )
  );
}

export function createDefaultSliceName(index: number): string {
  return `slice-${String(Math.max(1, index)).padStart(3, '0')}`;
}

export function generateAutoSlicesForCanvas(
  canvasSize: CanvasSize,
  baseName: string,
  sliceWidth: number,
  sliceHeight: number
): EditorSlice[] {
  const normalizedWidth = Math.max(1, Math.trunc(sliceWidth));
  const normalizedHeight = Math.max(1, Math.trunc(sliceHeight));
  const columns = Math.floor(canvasSize.width / normalizedWidth);
  const rows = Math.floor(canvasSize.height / normalizedHeight);
  const total = columns * rows;
  if (total <= 0) {
    return [];
  }

  const prefix = normalizeSliceName(baseName) || 'slice';
  const digits = Math.max(1, String(Math.max(0, total - 1)).length);
  const generated: EditorSlice[] = [];
  let index = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      generated.push({
        id: generateEditorSliceId(),
        name: `${prefix}-${String(index).padStart(digits, '0')}`,
        x: column * normalizedWidth,
        y: row * normalizedHeight,
        w: normalizedWidth,
        h: normalizedHeight,
        exportSettings: createDefaultSliceExportSettings({ w: normalizedWidth })
      });
      index += 1;
    }
  }

  return generated;
}

export function normalizeSliceRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  canvasSize: CanvasSize
): { x: number; y: number; w: number; h: number } {
  const x1 = clamp(Math.min(startX, endX), 0, canvasSize.width - 1);
  const y1 = clamp(Math.min(startY, endY), 0, canvasSize.height - 1);
  const x2 = clamp(Math.max(startX, endX), 0, canvasSize.width - 1);
  const y2 = clamp(Math.max(startY, endY), 0, canvasSize.height - 1);

  return {
    x: x1,
    y: y1,
    w: x2 - x1 + 1,
    h: y2 - y1 + 1
  };
}

export function normalizeEditorSlices(slices: EditorSlice[], canvasSize: CanvasSize): EditorSlice[] {
  const seenIds = new Set<string>();
  const normalized: EditorSlice[] = [];

  for (const slice of slices) {
    if (!slice || typeof slice !== 'object') {
      continue;
    }

    const x = Number.isFinite(slice.x) ? Math.trunc(slice.x) : Number.NaN;
    const y = Number.isFinite(slice.y) ? Math.trunc(slice.y) : Number.NaN;
    const w = Number.isFinite(slice.w) ? Math.trunc(slice.w) : Number.NaN;
    const h = Number.isFinite(slice.h) ? Math.trunc(slice.h) : Number.NaN;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
      continue;
    }
    if (w <= 0 || h <= 0) {
      continue;
    }

    const rect = normalizeSliceRect(x, y, x + w - 1, y + h - 1, canvasSize);
    const id = isEditorSliceId(slice.id) && !seenIds.has(slice.id.toLowerCase())
      ? slice.id.toLowerCase()
      : generateEditorSliceId();

    seenIds.add(id);
    normalized.push({
      id,
      name: normalizeSliceName(typeof slice.name === 'string' ? slice.name : ''),
      ...rect,
      exportSettings: normalizeSliceExportSettings(slice.exportSettings, rect)
    });
  }

  return normalized;
}

export function pointInSlice(point: { x: number; y: number }, slice: EditorSlice): boolean {
  return point.x >= slice.x && point.y >= slice.y && point.x < slice.x + slice.w && point.y < slice.y + slice.h;
}

export function moveSlicesWithinCanvas(
  slices: EditorSlice[],
  selectedIds: string[],
  dx: number,
  dy: number,
  canvasSize: CanvasSize
): EditorSlice[] {
  if (selectedIds.length === 0 || (dx === 0 && dy === 0)) {
    return slices;
  }

  const selectedSet = new Set(selectedIds);
  const selectedSlices = slices.filter((slice) => selectedSet.has(slice.id));
  if (selectedSlices.length === 0) {
    return slices;
  }

  const minX = Math.min(...selectedSlices.map((slice) => slice.x));
  const minY = Math.min(...selectedSlices.map((slice) => slice.y));
  const maxX = Math.max(...selectedSlices.map((slice) => slice.x + slice.w));
  const maxY = Math.max(...selectedSlices.map((slice) => slice.y + slice.h));

  const clampedDx = clamp(dx, -minX, canvasSize.width - maxX);
  const clampedDy = clamp(dy, -minY, canvasSize.height - maxY);
  if (clampedDx === 0 && clampedDy === 0) {
    return slices;
  }

  return slices.map((slice) =>
    selectedSet.has(slice.id)
      ? { ...slice, x: slice.x + clampedDx, y: slice.y + clampedDy }
      : slice
  );
}

export function resizeSliceFromHandle(
  slice: EditorSlice,
  handle: SliceResizeHandle,
  point: { x: number; y: number },
  canvasSize: CanvasSize
): EditorSlice {
  let left = slice.x;
  let top = slice.y;
  let right = slice.x + slice.w - 1;
  let bottom = slice.y + slice.h - 1;

  if (handle.includes('l')) {
    left = clamp(point.x, 0, right);
  }
  if (handle.includes('r')) {
    right = clamp(point.x, left, canvasSize.width - 1);
  }
  if (handle.includes('t')) {
    top = clamp(point.y, 0, bottom);
  }
  if (handle.includes('b')) {
    bottom = clamp(point.y, top, canvasSize.height - 1);
  }

  return {
    ...slice,
    x: left,
    y: top,
    w: right - left + 1,
    h: bottom - top + 1,
    exportSettings: syncSliceExportSettingsWithSize(slice, {
      ...slice,
      w: right - left + 1,
      h: bottom - top + 1,
      exportSettings: slice.exportSettings ?? createDefaultSliceExportSettings(slice)
    })
  };
}

export function getSliceHandleStyle(handle: SliceResizeHandle): CSSProperties {
  const baseStyle: CSSProperties = {
    transform: 'translate(-50%, -50%)'
  };

  switch (handle) {
    case 'tl':
      return { ...baseStyle, left: '0%', top: '0%', cursor: 'nwse-resize' };
    case 'tc':
      return { ...baseStyle, left: '50%', top: '0%', cursor: 'ns-resize' };
    case 'tr':
      return { ...baseStyle, left: '100%', top: '0%', cursor: 'nesw-resize' };
    case 'ml':
      return { ...baseStyle, left: '0%', top: '50%', cursor: 'ew-resize' };
    case 'mr':
      return { ...baseStyle, left: '100%', top: '50%', cursor: 'ew-resize' };
    case 'bl':
      return { ...baseStyle, left: '0%', top: '100%', cursor: 'nesw-resize' };
    case 'bc':
      return { ...baseStyle, left: '50%', top: '100%', cursor: 'ns-resize' };
    case 'br':
      return { ...baseStyle, left: '100%', top: '100%', cursor: 'nwse-resize' };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
