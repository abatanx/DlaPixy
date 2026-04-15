/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import type { CanvasSize } from './types';

export type SelectionPixelBlock = {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
};

export type SelectionRotateDirection = 'left' | 'right' | 'up' | 'down';
export type SelectionQuarterTurnDirection = 'clockwise' | 'counterclockwise';
export type SelectionFlipAxis = 'horizontal' | 'vertical';

type SelectionRegion = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function extractSelectionPixelBlock(
  pixels: Uint8ClampedArray,
  canvasSize: CanvasSize,
  selection: SelectionRegion
): SelectionPixelBlock {
  const blockPixels = new Uint8ClampedArray(selection.w * selection.h * 4);

  for (let y = 0; y < selection.h; y += 1) {
    for (let x = 0; x < selection.w; x += 1) {
      const sourceIndex = ((selection.y + y) * canvasSize.width + (selection.x + x)) * 4;
      const targetIndex = (y * selection.w + x) * 4;
      blockPixels[targetIndex] = pixels[sourceIndex];
      blockPixels[targetIndex + 1] = pixels[sourceIndex + 1];
      blockPixels[targetIndex + 2] = pixels[sourceIndex + 2];
      blockPixels[targetIndex + 3] = pixels[sourceIndex + 3];
    }
  }

  return {
    pixels: blockPixels,
    width: selection.w,
    height: selection.h
  };
}

export function rotateSelectionPixelBlock(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  direction: SelectionRotateDirection
): Uint8ClampedArray {
  const next = new Uint8ClampedArray(pixels.length);
  if (width <= 0 || height <= 0) {
    return next;
  }

  const offsetX = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  const offsetY = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = (x - offsetX + width) % width;
      const sourceY = (y - offsetY + height) % height;
      const sourceIndex = (sourceY * width + sourceX) * 4;
      const targetIndex = (y * width + x) * 4;
      next[targetIndex] = pixels[sourceIndex];
      next[targetIndex + 1] = pixels[sourceIndex + 1];
      next[targetIndex + 2] = pixels[sourceIndex + 2];
      next[targetIndex + 3] = pixels[sourceIndex + 3];
    }
  }

  return next;
}

export function rotateSelectionPixelBlockQuarterTurn(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  direction: SelectionQuarterTurnDirection
): Uint8ClampedArray {
  if (width <= 0 || height <= 0 || width !== height) {
    return new Uint8ClampedArray(pixels);
  }

  const next = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = (y * width + x) * 4;
      const targetX = direction === 'clockwise' ? height - 1 - y : y;
      const targetY = direction === 'clockwise' ? x : width - 1 - x;
      const targetIndex = (targetY * width + targetX) * 4;
      next[targetIndex] = pixels[sourceIndex];
      next[targetIndex + 1] = pixels[sourceIndex + 1];
      next[targetIndex + 2] = pixels[sourceIndex + 2];
      next[targetIndex + 3] = pixels[sourceIndex + 3];
    }
  }

  return next;
}

export function flipSelectionPixelBlock(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  axis: SelectionFlipAxis
): Uint8ClampedArray {
  const next = new Uint8ClampedArray(pixels.length);
  if (width <= 0 || height <= 0) {
    return next;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = (y * width + x) * 4;
      const targetX = axis === 'horizontal' ? width - 1 - x : x;
      const targetY = axis === 'vertical' ? height - 1 - y : y;
      const targetIndex = (targetY * width + targetX) * 4;
      next[targetIndex] = pixels[sourceIndex];
      next[targetIndex + 1] = pixels[sourceIndex + 1];
      next[targetIndex + 2] = pixels[sourceIndex + 2];
      next[targetIndex + 3] = pixels[sourceIndex + 3];
    }
  }

  return next;
}

export function applySelectionPixelBlock(
  canvasPixels: Uint8ClampedArray,
  canvasSize: CanvasSize,
  selection: SelectionRegion,
  blockPixels: Uint8ClampedArray
): Uint8ClampedArray {
  const next = new Uint8ClampedArray(canvasPixels);

  for (let y = 0; y < selection.h; y += 1) {
    for (let x = 0; x < selection.w; x += 1) {
      const sourceIndex = (y * selection.w + x) * 4;
      const targetIndex = ((selection.y + y) * canvasSize.width + (selection.x + x)) * 4;
      next[targetIndex] = blockPixels[sourceIndex];
      next[targetIndex + 1] = blockPixels[sourceIndex + 1];
      next[targetIndex + 2] = blockPixels[sourceIndex + 2];
      next[targetIndex + 3] = blockPixels[sourceIndex + 3];
    }
  }

  return next;
}

export function hasSamePixelBlock(left: Uint8ClampedArray, right: Uint8ClampedArray): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}
