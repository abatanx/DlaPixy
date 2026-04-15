/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import type { CSSProperties } from 'react';
import type { FloatingPasteState } from './floating-paste';
import type { CanvasSize, Selection } from './types';

export type FloatingResizeHandle = 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br';

export type FloatingResizeSession = {
  handle: FloatingResizeHandle;
  anchor: {
    x: number;
    y: number;
  };
  startRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export const FLOATING_HANDLE_RADIUS = 10;
export const FLOATING_INTERACTION_STAGE_PADDING_PX = 72;
export const FLOATING_HANDLE_ORDER: FloatingResizeHandle[] = ['tl', 'tc', 'tr', 'ml', 'mr', 'bl', 'bc', 'br'];

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampFloatingRectToVisibleCanvasBounds(
  rect: { x: number; y: number; width: number; height: number },
  canvasSize: CanvasSize
): { x: number; y: number; width: number; height: number } {
  const minX = 1 - rect.width;
  const minY = 1 - rect.height;
  const maxX = canvasSize.width - 1;
  const maxY = canvasSize.height - 1;

  return {
    x: clampNumber(rect.x, Math.min(minX, maxX), Math.max(minX, maxX)),
    y: clampNumber(rect.y, Math.min(minY, maxY), Math.max(minY, maxY)),
    width: rect.width,
    height: rect.height
  };
}

export function getFloatingHandleStyle(handle: FloatingResizeHandle): CSSProperties {
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

export function getFloatingHandlePoints(selection: Exclude<Selection, null>, zoom: number): Array<{
  handle: FloatingResizeHandle;
  x: number;
  y: number;
}> {
  const left = selection.x * zoom;
  const centerX = (selection.x + selection.w / 2) * zoom;
  const right = (selection.x + selection.w) * zoom;
  const top = selection.y * zoom;
  const centerY = (selection.y + selection.h / 2) * zoom;
  const bottom = (selection.y + selection.h) * zoom;

  return [
    { handle: 'tl', x: left, y: top },
    { handle: 'tc', x: centerX, y: top },
    { handle: 'tr', x: right, y: top },
    { handle: 'ml', x: left, y: centerY },
    { handle: 'mr', x: right, y: centerY },
    { handle: 'bl', x: left, y: bottom },
    { handle: 'bc', x: centerX, y: bottom },
    { handle: 'br', x: right, y: bottom }
  ];
}

export function getResizeAnchorForHandle(
  handle: FloatingResizeHandle,
  selection: Exclude<Selection, null>
): { x: number; y: number } {
  switch (handle) {
    case 'tl':
      return { x: selection.x + selection.w, y: selection.y + selection.h };
    case 'tc':
      return { x: selection.x + selection.w / 2, y: selection.y + selection.h };
    case 'tr':
      return { x: selection.x, y: selection.y + selection.h };
    case 'ml':
      return { x: selection.x + selection.w, y: selection.y + selection.h / 2 };
    case 'mr':
      return { x: selection.x, y: selection.y + selection.h / 2 };
    case 'bl':
      return { x: selection.x + selection.w, y: selection.y };
    case 'bc':
      return { x: selection.x + selection.w / 2, y: selection.y };
    case 'br':
      return { x: selection.x, y: selection.y };
  }
}

function resolveScaleFromHandle(
  handle: FloatingResizeHandle,
  rawWidth: number,
  rawHeight: number,
  sourceWidth: number,
  sourceHeight: number,
  currentWidth: number,
  currentHeight: number
): number {
  const scaleX = rawWidth / sourceWidth;
  const scaleY = rawHeight / sourceHeight;
  const currentScaleX = currentWidth / sourceWidth;
  const currentScaleY = currentHeight / sourceHeight;

  if (handle === 'tc' || handle === 'bc') {
    return scaleY;
  }
  if (handle === 'ml' || handle === 'mr') {
    return scaleX;
  }

  return Math.abs(scaleX - currentScaleX) >= Math.abs(scaleY - currentScaleY) ? scaleX : scaleY;
}

export function createResizedRectFromHandle(
  handle: FloatingResizeHandle,
  anchor: { x: number; y: number },
  pointerX: number,
  pointerY: number,
  floating: FloatingPasteState,
  currentRect: FloatingResizeSession['startRect'],
  canvasSize: CanvasSize,
  stagePaddingCells: number
): { x: number; y: number; width: number; height: number } {
  const rawWidth = Math.max(1 / floating.sourceWidth, Math.abs(anchor.x - pointerX));
  const rawHeight = Math.max(1 / floating.sourceHeight, Math.abs(anchor.y - pointerY));
  const minScale = Math.max(1 / floating.sourceWidth, 1 / floating.sourceHeight);
  const stageSpanWidth = canvasSize.width + stagePaddingCells * 2;
  const stageSpanHeight = canvasSize.height + stagePaddingCells * 2;
  const maxScale = Math.min(stageSpanWidth / floating.sourceWidth, stageSpanHeight / floating.sourceHeight);
  const nextScale = clampNumber(
    resolveScaleFromHandle(
      handle,
      rawWidth,
      rawHeight,
      floating.sourceWidth,
      floating.sourceHeight,
      currentRect.width,
      currentRect.height
    ),
    minScale,
    maxScale
  );
  const width = Math.max(1, Math.round(floating.sourceWidth * nextScale));
  const height = Math.max(1, Math.round(floating.sourceHeight * nextScale));

  let x = currentRect.x;
  let y = currentRect.y;
  switch (handle) {
    case 'tl':
      x = Math.round(anchor.x - width);
      y = Math.round(anchor.y - height);
      break;
    case 'tc':
      x = Math.round(anchor.x - width / 2);
      y = Math.round(anchor.y - height);
      break;
    case 'tr':
      x = Math.round(anchor.x);
      y = Math.round(anchor.y - height);
      break;
    case 'ml':
      x = Math.round(anchor.x - width);
      y = Math.round(anchor.y - height / 2);
      break;
    case 'mr':
      x = Math.round(anchor.x);
      y = Math.round(anchor.y - height / 2);
      break;
    case 'bl':
      x = Math.round(anchor.x - width);
      y = Math.round(anchor.y);
      break;
    case 'bc':
      x = Math.round(anchor.x - width / 2);
      y = Math.round(anchor.y);
      break;
    case 'br':
      x = Math.round(anchor.x);
      y = Math.round(anchor.y);
      break;
  }

  return clampFloatingRectToVisibleCanvasBounds({ x, y, width, height }, canvasSize);
}
