/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import type { PaletteEntry } from './palette';
import type { FloatingCompositeMode } from './floating-composite';
import type { TransparentBackgroundMode } from './transparent-background';

export const SIDECAR_SCHEMA_VERSION = 1;

export type EditorTool = 'pencil' | 'eraser' | 'fill' | 'select';

export type EditorSidecar = {
  dlaPixy: {
    schemaVersion: number;
    document: {
      palette: {
        entries: PaletteEntry[];
      };
    };
    editor: {
      floatingCompositeMode: FloatingCompositeMode;
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
