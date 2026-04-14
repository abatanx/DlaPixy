/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useRef, type MutableRefObject } from 'react';
import type { DrawState } from '../editor/canvas-pointer';
import type { ClipboardPixelBlock, FloatingPasteState } from '../editor/floating-paste';
import type { FloatingResizeSession } from '../editor/floating-interaction';

type UseFloatingSelectionStateOptions = {
  drawStateRef: MutableRefObject<DrawState>;
};

export function useFloatingSelectionState({
  drawStateRef
}: UseFloatingSelectionStateOptions): {
  selectionClipboardRef: MutableRefObject<ClipboardPixelBlock | null>;
  floatingPasteRef: MutableRefObject<FloatingPasteState | null>;
  floatingResizeRef: MutableRefObject<FloatingResizeSession | null>;
  clearFloatingPaste: () => void;
} {
  const selectionClipboardRef = useRef<ClipboardPixelBlock | null>(null);
  const floatingPasteRef = useRef<FloatingPasteState | null>(null);
  const floatingResizeRef = useRef<FloatingResizeSession | null>(null);

  const clearFloatingPaste = useCallback(() => {
    floatingPasteRef.current = null;
    floatingResizeRef.current = null;
    drawStateRef.current.pendingMovePoint = null;
    drawStateRef.current.pendingMoveOrigin = null;
    drawStateRef.current.pendingLiftSelection = false;
    drawStateRef.current.moveStartPoint = null;
    drawStateRef.current.moveStartOrigin = null;
  }, [drawStateRef]);

  return {
    selectionClipboardRef,
    floatingPasteRef,
    floatingResizeRef,
    clearFloatingPaste
  };
}
