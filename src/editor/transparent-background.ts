/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import type { TransparentBackgroundMode } from '../../shared/transparent-background';

export function getTransparentBackgroundSurfaceClassName(mode: TransparentBackgroundMode): string {
  return `transparent-background-surface transparent-background-${mode}`;
}
