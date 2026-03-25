import type { TransparentBackgroundMode } from '../../shared/transparent-background';

export function getTransparentBackgroundSurfaceClassName(mode: TransparentBackgroundMode): string {
  return `transparent-background-surface transparent-background-${mode}`;
}
