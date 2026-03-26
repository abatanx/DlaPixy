import type { Selection, Tool } from './types';

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
  sourceWidth: number;
  sourceHeight: number;
  sourcePixels: Uint8ClampedArray;
  basePixels: Uint8ClampedArray;
  restorePixels: Uint8ClampedArray;
  restoreSelection: Selection;
  restoreTool: Tool;
};
