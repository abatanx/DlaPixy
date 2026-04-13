/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import type { GplExportFormat } from './palette-gpl';
import type { TransparentBackgroundMode } from './transparent-background';

export type MenuAction =
  | { type: 'open' }
  | { type: 'save' }
  | { type: 'save-as' }
  | { type: 'open-recent'; filePath: string }
  | { type: 'canvas-size' }
  | { type: 'grid-spacing' }
  | { type: 'slice-auto' }
  | { type: 'slice-export' }
  | { type: 'transparent-background'; mode: TransparentBackgroundMode }
  | { type: 'palette-kmeans-quantize' }
  | { type: 'palette-import-replace' }
  | { type: 'palette-import-append' }
  | { type: 'palette-export'; format: GplExportFormat };
