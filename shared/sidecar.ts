/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import type { PaletteEntry } from './palette';
import type { EditorSlice } from './slice';
import type { FloatingCompositeMode } from './floating-composite';
import type { FloatingScaleMode } from './floating-scale-mode';
import type { TransparentBackgroundMode } from './transparent-background';

export const SIDECAR_SCHEMA_VERSION = 2;

export type EditorTool = 'pencil' | 'eraser' | 'fill' | 'select' | 'slice';

export type EditorSidecar = {
  dlaPixy: {
    schemaVersion: number;
    document: {
      palette: {
        entries: PaletteEntry[];
      };
      slices: EditorSlice[];
    };
    editor: {
      floatingCompositeMode: FloatingCompositeMode;
      floatingScaleMode: FloatingScaleMode;
      gridSpacing: number;
      transparentBackgroundMode: TransparentBackgroundMode;
      zoom: number;
      viewport: {
        scrollLeft: number;
        scrollTop: number;
      };
      lastTool: EditorTool;
    };
  };
};
