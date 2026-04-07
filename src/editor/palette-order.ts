/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import type { PaletteEntry } from './types';
import { hexToRgba, rgbaToHsva } from './utils';

export type PaletteOrderMode = 'manual' | 'auto';
export type PaletteAutoSortKey =
  | 'hue1'
  | 'hue2'
  | 'saturation1'
  | 'saturation2'
  | 'value1'
  | 'value2';

export const DEFAULT_PALETTE_ORDER_MODE: PaletteOrderMode = 'manual';
export const DEFAULT_PALETTE_AUTO_SORT_KEY: PaletteAutoSortKey = 'hue1';

export const PALETTE_AUTO_SORT_KEY_LABELS: Record<PaletteAutoSortKey, string> = {
  hue1: 'Preview: Hue (H→S→V→α)',
  hue2: 'Preview: Hue (H→V→S→α)',
  saturation1: 'Preview: Saturation (S→V→H→α)',
  saturation2: 'Preview: Saturation (S→H→V→α)',
  value1: 'Preview: Value (V→S→H→α)',
  value2: 'Preview: Value (V→H→S→α)'
};

const ACHROMATIC_SATURATION_THRESHOLD = 5;

type SortMetrics = {
  h: number;
  s: number;
  v: number;
  a: number;
};

function getPaletteSortMetrics(entry: PaletteEntry): SortMetrics {
  const rgba = hexToRgba(entry.color);
  const hsva = rgbaToHsva(rgba.r, rgba.g, rgba.b, rgba.a);
  return {
    h: hsva.h,
    s: hsva.s,
    v: hsva.v,
    a: hsva.a
  };
}

function compareByManualOrder(
  left: PaletteEntry,
  right: PaletteEntry,
  manualIndexById: Map<string, number>
): number {
  return (manualIndexById.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (manualIndexById.get(right.id) ?? Number.MAX_SAFE_INTEGER);
}

function compareAchromaticGroup(leftMetrics: SortMetrics, rightMetrics: SortMetrics): number {
  const leftIsAchromatic = leftMetrics.s <= ACHROMATIC_SATURATION_THRESHOLD;
  const rightIsAchromatic = rightMetrics.s <= ACHROMATIC_SATURATION_THRESHOLD;
  if (leftIsAchromatic === rightIsAchromatic) {
    return 0;
  }
  return leftIsAchromatic ? -1 : 1;
}

function compareTransparentGroup(leftMetrics: SortMetrics, rightMetrics: SortMetrics): number {
  const leftIsFullyTransparent = leftMetrics.a === 0;
  const rightIsFullyTransparent = rightMetrics.a === 0;
  if (leftIsFullyTransparent === rightIsFullyTransparent) {
    return 0;
  }
  return leftIsFullyTransparent ? -1 : 1;
}

function comparePositiveAlphaDescending(leftMetrics: SortMetrics, rightMetrics: SortMetrics): number {
  if (leftMetrics.a <= 0 || rightMetrics.a <= 0 || leftMetrics.a === rightMetrics.a) {
    return 0;
  }
  return rightMetrics.a - leftMetrics.a;
}

export function sortPaletteEntries(entries: PaletteEntry[], autoSortKey: PaletteAutoSortKey): PaletteEntry[] {
  const manualIndexById = new Map(entries.map((entry, index) => [entry.id, index]));
  const metricsById = new Map(entries.map((entry) => [entry.id, getPaletteSortMetrics(entry)]));
  const sortedEntries = [...entries];

  sortedEntries.sort((left, right) => {
    const leftMetrics = metricsById.get(left.id);
    const rightMetrics = metricsById.get(right.id);
    if (!leftMetrics || !rightMetrics) {
      return compareByManualOrder(left, right, manualIndexById);
    }

    const transparentGroupOrder = compareTransparentGroup(leftMetrics, rightMetrics);
    if (transparentGroupOrder !== 0) {
      return transparentGroupOrder;
    }

    const achromaticGroupOrder = compareAchromaticGroup(leftMetrics, rightMetrics);
    if (achromaticGroupOrder !== 0) {
      return achromaticGroupOrder;
    }

    switch (autoSortKey) {
      case 'hue1':
      case 'hue2': {
        if (leftMetrics.h !== rightMetrics.h) {
          return leftMetrics.h - rightMetrics.h;
        }
        if (autoSortKey === 'hue1') {
          if (leftMetrics.s !== rightMetrics.s) {
            return rightMetrics.s - leftMetrics.s;
          }
          if (leftMetrics.v !== rightMetrics.v) {
            return rightMetrics.v - leftMetrics.v;
          }
          const alphaOrder = comparePositiveAlphaDescending(leftMetrics, rightMetrics);
          if (alphaOrder !== 0) {
            return alphaOrder;
          }
          return compareByManualOrder(left, right, manualIndexById);
        }
        if (leftMetrics.v !== rightMetrics.v) {
          return rightMetrics.v - leftMetrics.v;
        }
        if (leftMetrics.s !== rightMetrics.s) {
          return rightMetrics.s - leftMetrics.s;
        }
        const alphaOrder = comparePositiveAlphaDescending(leftMetrics, rightMetrics);
        if (alphaOrder !== 0) {
          return alphaOrder;
        }
        return compareByManualOrder(left, right, manualIndexById);
      }
      case 'saturation1':
      case 'saturation2':
        if (leftMetrics.s !== rightMetrics.s) {
          return rightMetrics.s - leftMetrics.s;
        }
        if (autoSortKey === 'saturation1') {
          if (leftMetrics.v !== rightMetrics.v) {
            return rightMetrics.v - leftMetrics.v;
          }
          if (leftMetrics.h !== rightMetrics.h) {
            return leftMetrics.h - rightMetrics.h;
          }
          const alphaOrder = comparePositiveAlphaDescending(leftMetrics, rightMetrics);
          if (alphaOrder !== 0) {
            return alphaOrder;
          }
          return compareByManualOrder(left, right, manualIndexById);
        }
        if (leftMetrics.h !== rightMetrics.h) {
          return leftMetrics.h - rightMetrics.h;
        }
        if (leftMetrics.v !== rightMetrics.v) {
          return rightMetrics.v - leftMetrics.v;
        }
        const alphaOrder = comparePositiveAlphaDescending(leftMetrics, rightMetrics);
        if (alphaOrder !== 0) {
          return alphaOrder;
        }
        return compareByManualOrder(left, right, manualIndexById);
      case 'value1':
        if (leftMetrics.v !== rightMetrics.v) {
          return rightMetrics.v - leftMetrics.v;
        }
        if (leftMetrics.s !== rightMetrics.s) {
          return rightMetrics.s - leftMetrics.s;
        }
        if (leftMetrics.h !== rightMetrics.h) {
          return leftMetrics.h - rightMetrics.h;
        }
        {
          const alphaOrder = comparePositiveAlphaDescending(leftMetrics, rightMetrics);
          if (alphaOrder !== 0) {
            return alphaOrder;
          }
        }
        return compareByManualOrder(left, right, manualIndexById);
      case 'value2':
        if (leftMetrics.v !== rightMetrics.v) {
          return rightMetrics.v - leftMetrics.v;
        }
        if (leftMetrics.h !== rightMetrics.h) {
          return leftMetrics.h - rightMetrics.h;
        }
        if (leftMetrics.s !== rightMetrics.s) {
          return rightMetrics.s - leftMetrics.s;
        }
        {
          const alphaOrder = comparePositiveAlphaDescending(leftMetrics, rightMetrics);
          if (alphaOrder !== 0) {
            return alphaOrder;
          }
        }
        return compareByManualOrder(left, right, manualIndexById);
      default:
        return compareByManualOrder(left, right, manualIndexById);
    }
  });

  return sortedEntries;
}
