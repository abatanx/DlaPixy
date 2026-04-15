/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import type { Selection, Tool } from './types';
import type { FloatingScaleMode } from '../../shared/floating-scale-mode';

export type ClipboardPixelBlock = {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  sourceX: number;
  sourceY: number;
  markerToken?: string;
};

export type FloatingPasteState = {
  x: number;
  y: number;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  renderedScaleMode: FloatingScaleMode;
  sourceWidth: number;
  sourceHeight: number;
  sourcePixels: Uint8ClampedArray;
  basePixels: Uint8ClampedArray;
  restorePixels: Uint8ClampedArray;
  restoreSelection: Selection;
  restoreTool: Tool;
};
