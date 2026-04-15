/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import type { PaletteEntry as SharedPaletteEntry } from '../../shared/palette';
import type { EditorSlice as SharedEditorSlice } from '../../shared/slice';
import type { FloatingCompositeMode as SharedFloatingCompositeMode } from '../../shared/floating-composite';
import type { FloatingScaleMode as SharedFloatingScaleMode } from '../../shared/floating-scale-mode';
import type { EditorSidecar, EditorTool } from '../../shared/sidecar';

export type Tool = EditorTool;

export type FloatingCompositeMode = SharedFloatingCompositeMode;
export type FloatingScaleMode = SharedFloatingScaleMode;

export type PaletteEntry = SharedPaletteEntry;
export type EditorSlice = SharedEditorSlice;

export type Selection = { x: number; y: number; w: number; h: number } | null;

export type AnimationFrame = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type TilePreviewLayer = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HoveredPixelInfo = {
  x: number;
  y: number;
  rgba: { r: number; g: number; b: number; a: number };
  hex8: string;
  hsva: { h: number; s: number; v: number; a: number };
  paletteId: string | null;
  paletteIndex: number | null;
  paletteCaption: string | null;
} | null;

export type EditorMeta = EditorSidecar;
