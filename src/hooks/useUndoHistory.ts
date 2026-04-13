/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { MAX_UNDO } from '../editor/constants';
import type { EditorSlice, PaletteEntry, Selection } from '../editor/types';
import { clonePaletteEntries, clonePixels, cloneSelection, cloneSlices } from '../editor/utils';

type StatusType = 'success' | 'warning' | 'error' | 'info';

type UndoSnapshot = {
  canvasSize: number;
  pixels: Uint8ClampedArray;
  selection: Selection;
  palette: PaletteEntry[];
  slices: EditorSlice[];
  selectedSliceIds: string[];
  activeSliceId: string | null;
  selectedColor: string;
};

type UseUndoHistoryOptions = {
  canvasSize: number;
  pixels: Uint8ClampedArray;
  selection: Selection;
  palette: PaletteEntry[];
  slices: EditorSlice[];
  selectedSliceIds: string[];
  activeSliceId: string | null;
  selectedColor: string;
  clearFloatingPaste: () => void;
  resetAnimationFrames: () => void;
  setCanvasSize: Dispatch<SetStateAction<number>>;
  setPixels: Dispatch<SetStateAction<Uint8ClampedArray>>;
  setSelection: Dispatch<SetStateAction<Selection>>;
  setLastTilePreviewSelection: Dispatch<SetStateAction<Selection>>;
  setPalette: Dispatch<SetStateAction<PaletteEntry[]>>;
  setSlices: Dispatch<SetStateAction<EditorSlice[]>>;
  setSelectedSliceIds: Dispatch<SetStateAction<string[]>>;
  setActiveSliceId: Dispatch<SetStateAction<string | null>>;
  setSelectedColor: Dispatch<SetStateAction<string>>;
  setHasUnsavedChanges: Dispatch<SetStateAction<boolean>>;
  setStatusText: (text: string, type: StatusType) => void;
};

export function useUndoHistory({
  canvasSize,
  pixels,
  selection,
  palette,
  slices,
  selectedSliceIds,
  activeSliceId,
  selectedColor,
  clearFloatingPaste,
  resetAnimationFrames,
  setCanvasSize,
  setPixels,
  setSelection,
  setLastTilePreviewSelection,
  setPalette,
  setSlices,
  setSelectedSliceIds,
  setActiveSliceId,
  setSelectedColor,
  setHasUnsavedChanges,
  setStatusText
}: UseUndoHistoryOptions): {
  undoStackRef: MutableRefObject<UndoSnapshot[]>;
  pushUndo: () => void;
  doUndo: () => void;
} {
  const undoStackRef = useRef<UndoSnapshot[]>([]);

  const pushUndo = useCallback(() => {
    // Keep immutable snapshots; cap history size to avoid unbounded memory growth.
    undoStackRef.current.push({
      canvasSize,
      pixels: clonePixels(pixels),
      selection: cloneSelection(selection),
      palette: clonePaletteEntries(palette),
      slices: cloneSlices(slices),
      selectedSliceIds: [...selectedSliceIds],
      activeSliceId,
      selectedColor
    });
    if (undoStackRef.current.length > MAX_UNDO) {
      undoStackRef.current.shift();
    }
  }, [activeSliceId, canvasSize, palette, pixels, selectedColor, selectedSliceIds, selection, slices]);

  const doUndo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) {
      setStatusText('Undo履歴がありません', 'warning');
      return;
    }

    setCanvasSize(previous.canvasSize);
    setPixels(previous.pixels);
    setSelection(previous.selection);
    setLastTilePreviewSelection(previous.selection);
    setPalette(clonePaletteEntries(previous.palette));
    setSlices(cloneSlices(previous.slices));
    setSelectedSliceIds([...previous.selectedSliceIds]);
    setActiveSliceId(previous.activeSliceId);
    setSelectedColor(previous.selectedColor);
    if (previous.canvasSize !== canvasSize) {
      resetAnimationFrames();
    }
    clearFloatingPaste();
    setHasUnsavedChanges(true);
    setStatusText('1手戻しました', 'success');
  }, [
    canvasSize,
    clearFloatingPaste,
    resetAnimationFrames,
    setCanvasSize,
    setHasUnsavedChanges,
    setLastTilePreviewSelection,
    setPalette,
    setPixels,
    setActiveSliceId,
    setSelectedColor,
    setSelectedSliceIds,
    setSelection,
    setSlices,
    setStatusText
  ]);

  return {
    undoStackRef,
    pushUndo,
    doUndo
  };
}
