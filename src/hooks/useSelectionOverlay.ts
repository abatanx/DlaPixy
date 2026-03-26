/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useMemo, type CSSProperties } from 'react';
import type { Selection } from '../editor/types';

type UseSelectionOverlayOptions = {
  selection: Selection;
  zoom: number;
  displaySize: number;
  isFloatingPasteActive: boolean;
  canvasFramePx: number;
};

export function useSelectionOverlay({
  selection,
  zoom,
  displaySize,
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

  const selectionOverlayVisualStyle = useMemo(() => {
    if (!selectionOverlaySelection || !selectionOverlayBaseStyle) {
      return undefined;
    }

    const selectionOverlayLeftPx = selectionOverlaySelection.x * zoom;
    const selectionOverlayTopPx = selectionOverlaySelection.y * zoom;
    const selectionOverlayWidthPx = selectionOverlaySelection.w * zoom;
    const selectionOverlayHeightPx = selectionOverlaySelection.h * zoom;

    return {
      ...selectionOverlayBaseStyle,
      clipPath: `inset(${Math.max(0, -selectionOverlayTopPx)}px ${Math.max(
        0,
        selectionOverlayLeftPx + selectionOverlayWidthPx - displaySize
      )}px ${Math.max(0, selectionOverlayTopPx + selectionOverlayHeightPx - displaySize)}px ${Math.max(
        0,
        -selectionOverlayLeftPx
      )}px)`
    } as CSSProperties;
  }, [displaySize, selectionOverlayBaseStyle, selectionOverlaySelection, zoom]);

  return {
    hasCommittedSelection,
    selectionOverlaySelection,
    selectionOverlayBaseStyle,
    selectionOverlayVisualStyle
  };
}
