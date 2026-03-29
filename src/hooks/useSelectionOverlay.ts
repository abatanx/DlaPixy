/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useMemo, type CSSProperties } from 'react';
import type { Selection } from '../editor/types';

type UseSelectionOverlayOptions = {
  selection: Selection;
  zoom: number;
  isFloatingPasteActive: boolean;
  canvasFramePx: number;
};

export function useSelectionOverlay({
  selection,
  zoom,
  isFloatingPasteActive,
  canvasFramePx
}: UseSelectionOverlayOptions) {
  const hasCommittedSelection = selection !== null && !isFloatingPasteActive;
  const selectionOverlaySelection = selection;

  const selectionOverlayBaseStyle = useMemo(() => {
    if (!selectionOverlaySelection) {
      return undefined;
    }

    return {
      left: `${canvasFramePx + selectionOverlaySelection.x * zoom}px`,
      top: `${canvasFramePx + selectionOverlaySelection.y * zoom}px`,
      width: `${selectionOverlaySelection.w * zoom}px`,
      height: `${selectionOverlaySelection.h * zoom}px`
    } as CSSProperties;
  }, [canvasFramePx, selectionOverlaySelection, zoom]);

  return {
    hasCommittedSelection,
    selectionOverlaySelection,
    selectionOverlayBaseStyle
  };
}
