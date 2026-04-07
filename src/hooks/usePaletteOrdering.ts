/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  DEFAULT_PALETTE_AUTO_SORT_KEY,
  DEFAULT_PALETTE_ORDER_MODE,
  sortPaletteEntries,
  type PaletteAutoSortKey,
  type PaletteOrderMode
} from '../editor/palette-order';
import type { PaletteEntry } from '../editor/types';

type StatusType = 'success' | 'warning' | 'error' | 'info';

type UsePaletteOrderingOptions = {
  palette: PaletteEntry[];
  paletteMergeSelection: string[];
  pushUndo: () => void;
  setPalette: Dispatch<SetStateAction<PaletteEntry[]>>;
  setHasUnsavedChanges: Dispatch<SetStateAction<boolean>>;
  setStatusText: (text: string, type: StatusType) => void;
};

function reorderPaletteEntryList(
  entries: PaletteEntry[],
  sourceId: string,
  targetId: string,
  insertAfter: boolean
): PaletteEntry[] {
  const sourceIndex = entries.findIndex((entry) => entry.id === sourceId);
  const targetIndex = entries.findIndex((entry) => entry.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return entries;
  }

  const nextEntries = [...entries];
  const [movedEntry] = nextEntries.splice(sourceIndex, 1);
  const nextTargetIndex = nextEntries.findIndex((entry) => entry.id === targetId);
  if (!movedEntry || nextTargetIndex < 0) {
    return entries;
  }

  nextEntries.splice(insertAfter ? nextTargetIndex + 1 : nextTargetIndex, 0, movedEntry);
  return nextEntries;
}

function hasSamePaletteEntryOrder(left: PaletteEntry[], right: PaletteEntry[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((entry, index) => entry.id === right[index]?.id);
}

export function usePaletteOrdering({
  palette,
  paletteMergeSelection,
  pushUndo,
  setPalette,
  setHasUnsavedChanges,
  setStatusText
}: UsePaletteOrderingOptions) {
  const [paletteOrderMode, setPaletteOrderMode] = useState<PaletteOrderMode>(DEFAULT_PALETTE_ORDER_MODE);
  const [paletteAutoSortKey, setPaletteAutoSortKey] = useState<PaletteAutoSortKey>(DEFAULT_PALETTE_AUTO_SORT_KEY);

  const displayPalette = useMemo(
    () => (paletteOrderMode === 'manual' ? palette : sortPaletteEntries(palette, paletteAutoSortKey)),
    [palette, paletteAutoSortKey, paletteOrderMode]
  );
  const canManualPaletteReorder = paletteOrderMode === 'manual' && paletteMergeSelection.length < 2;
  const canApplyDisplayPaletteOrder =
    paletteOrderMode === 'auto' &&
    paletteMergeSelection.length < 2 &&
    !hasSamePaletteEntryOrder(displayPalette, palette);

  const reorderPaletteEntries = useCallback(
    (sourceId: string, targetId: string, insertAfter: boolean): boolean => {
      if (!canManualPaletteReorder || sourceId === targetId) {
        return false;
      }

      const nextPalette = reorderPaletteEntryList(palette, sourceId, targetId, insertAfter);
      if (nextPalette === palette) {
        return false;
      }

      pushUndo();
      setPalette(nextPalette);
      setHasUnsavedChanges(true);
      setStatusText('パレット順を変更しました', 'success');
      return true;
    },
    [canManualPaletteReorder, palette, pushUndo, setHasUnsavedChanges, setPalette, setStatusText]
  );

  const applyDisplayPaletteOrder = useCallback((): boolean => {
    if (!canApplyDisplayPaletteOrder) {
      return false;
    }

    pushUndo();
    setPalette(displayPalette);
    setHasUnsavedChanges(true);
    setPaletteOrderMode('manual');
    setStatusText('プレビュー順をパレットへ反映しました', 'success');
    return true;
  }, [
    canApplyDisplayPaletteOrder,
    displayPalette,
    pushUndo,
    setHasUnsavedChanges,
    setPalette,
    setPaletteOrderMode,
    setStatusText
  ]);

  const resetPaletteOrderViewState = useCallback(() => {
    setPaletteOrderMode(DEFAULT_PALETTE_ORDER_MODE);
  }, []);

  return {
    paletteOrderMode,
    setPaletteOrderMode,
    paletteAutoSortKey,
    setPaletteAutoSortKey,
    displayPalette,
    canManualPaletteReorder,
    canApplyDisplayPaletteOrder,
    reorderPaletteEntries,
    applyDisplayPaletteOrder,
    resetPaletteOrderViewState
  };
}
