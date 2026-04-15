/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { hasSamePaletteEntries, resolveNextSelectedColor } from '../editor/app-utils';
import type { FloatingPasteState } from '../editor/floating-paste';
import {
  extractSelectionPixels,
  suggestKMeansColorCount,
  type QuantizeSelectionResult,
  type QuantizeSelectionSource
} from '../editor/kmeans-quantize';
import { syncPaletteEntriesFromPixels } from '../editor/palette-sync';
import {
  applySelectionPixelBlock,
  extractSelectionPixelBlock,
  hasSamePixelBlock,
  type SelectionPixelBlock
} from '../editor/selection-rotate';
import type { CanvasSize, PaletteEntry, Selection, Tool } from '../editor/types';
import { clampSelectionToCanvas, clonePixels } from '../editor/utils';

type StatusType = 'success' | 'warning' | 'error' | 'info';

type SelectionRect = Exclude<Selection, null>;

type KMeansQuantizeRequest = {
  selection: SelectionRect;
  source: QuantizeSelectionSource;
  initialColorCount: number;
};

type SelectionRotateRequest = {
  selection: SelectionRect;
  source: SelectionPixelBlock;
};

type UseSelectionOperationsOptions = {
  canvasSize: CanvasSize;
  palette: PaletteEntry[];
  pixels: Uint8ClampedArray;
  selectedColor: string;
  selection: Selection;
  floatingPasteRef: MutableRefObject<FloatingPasteState | null>;
  pushUndo: () => void;
  clearFloatingPaste: () => void;
  setPalette: Dispatch<SetStateAction<PaletteEntry[]>>;
  setPixels: Dispatch<SetStateAction<Uint8ClampedArray>>;
  setSelectedColor: Dispatch<SetStateAction<string>>;
  setSelection: Dispatch<SetStateAction<Selection>>;
  setTool: Dispatch<SetStateAction<Tool>>;
  setLastTilePreviewSelection: Dispatch<SetStateAction<Selection>>;
  setHasUnsavedChanges: Dispatch<SetStateAction<boolean>>;
  setStatusText: (text: string, type: StatusType) => void;
};

export function useSelectionOperations({
  canvasSize,
  palette,
  pixels,
  selectedColor,
  selection,
  floatingPasteRef,
  pushUndo,
  clearFloatingPaste,
  setPalette,
  setPixels,
  setSelectedColor,
  setSelection,
  setTool,
  setLastTilePreviewSelection,
  setHasUnsavedChanges,
  setStatusText
}: UseSelectionOperationsOptions) {
  const [kMeansQuantizeRequest, setKMeansQuantizeRequest] = useState<KMeansQuantizeRequest | null>(null);
  const [selectionRotateRequest, setSelectionRotateRequest] = useState<SelectionRotateRequest | null>(null);

  const openSelectionRotateModal = useCallback(() => {
    if (floatingPasteRef.current) {
      setStatusText('ローテーションの前に Enter で確定するか Esc でキャンセルしてください', 'warning');
      return;
    }

    const normalizedSelection = clampSelectionToCanvas(selection, canvasSize);
    if (!normalizedSelection) {
      setStatusText('ローテーション: 先に矩形選択してください', 'warning');
      return;
    }

    setSelectionRotateRequest({
      selection: normalizedSelection,
      source: extractSelectionPixelBlock(pixels, canvasSize, normalizedSelection)
    });
  }, [canvasSize, floatingPasteRef, pixels, selection, setStatusText]);

  const closeSelectionRotateModal = useCallback(() => {
    setSelectionRotateRequest(null);
  }, []);

  const applySelectionRotate = useCallback(
    (result: SelectionPixelBlock) => {
      if (!selectionRotateRequest) {
        return;
      }

      if (hasSamePixelBlock(selectionRotateRequest.source.pixels, result.pixels)) {
        setStatusText('ローテーションの変更がありません', 'warning');
        return;
      }

      pushUndo();
      setPixels((prev) => applySelectionPixelBlock(prev, canvasSize, selectionRotateRequest.selection, result.pixels));
      setSelection(selectionRotateRequest.selection);
      setLastTilePreviewSelection(selectionRotateRequest.selection);
      setHasUnsavedChanges(true);
      setStatusText(
        `ローテーションを適用しました: ${selectionRotateRequest.selection.w}x${selectionRotateRequest.selection.h}`,
        'success'
      );
    },
    [canvasSize, pushUndo, selectionRotateRequest, setHasUnsavedChanges, setLastTilePreviewSelection, setPixels, setSelection, setStatusText]
  );

  const openKMeansQuantizeModal = useCallback(() => {
    if (floatingPasteRef.current) {
      setStatusText('減色の前に Enter で確定するか Esc でキャンセルしてください', 'warning');
      return;
    }

    const normalizedSelection = clampSelectionToCanvas(selection, canvasSize);
    if (!normalizedSelection) {
      setStatusText('K-Means減色: 先に矩形選択してください', 'warning');
      return;
    }

    const source = extractSelectionPixels(pixels, canvasSize, normalizedSelection);
    if (source.visiblePixelCount === 0) {
      setStatusText('選択範囲に可視ピクセルがありません', 'warning');
      return;
    }
    if (source.uniqueVisibleColorCount <= 1) {
      setStatusText('選択範囲の可視色数が 1 色以下のため減色できません', 'warning');
      return;
    }

    setKMeansQuantizeRequest({
      selection: normalizedSelection,
      source,
      initialColorCount: suggestKMeansColorCount(source.uniqueVisibleColorCount)
    });
  }, [canvasSize, floatingPasteRef, pixels, selection, setStatusText]);

  const closeKMeansQuantizeModal = useCallback(() => {
    setKMeansQuantizeRequest(null);
  }, []);

  const applyKMeansQuantize = useCallback(
    (result: QuantizeSelectionResult) => {
      if (!kMeansQuantizeRequest) {
        return;
      }

      const { selection: requestSelection } = kMeansQuantizeRequest;
      const nextPixels = clonePixels(pixels);
      let changedPixelCount = 0;

      for (let y = 0; y < requestSelection.h; y += 1) {
        for (let x = 0; x < requestSelection.w; x += 1) {
          const sourceIndex = (y * requestSelection.w + x) * 4;
          const targetIndex = ((requestSelection.y + y) * canvasSize.width + (requestSelection.x + x)) * 4;
          const isSamePixel =
            nextPixels[targetIndex] === result.pixels[sourceIndex] &&
            nextPixels[targetIndex + 1] === result.pixels[sourceIndex + 1] &&
            nextPixels[targetIndex + 2] === result.pixels[sourceIndex + 2] &&
            nextPixels[targetIndex + 3] === result.pixels[sourceIndex + 3];

          if (!isSamePixel) {
            changedPixelCount += 1;
          }

          nextPixels[targetIndex] = result.pixels[sourceIndex];
          nextPixels[targetIndex + 1] = result.pixels[sourceIndex + 1];
          nextPixels[targetIndex + 2] = result.pixels[sourceIndex + 2];
          nextPixels[targetIndex + 3] = result.pixels[sourceIndex + 3];
        }
      }

      const { palette: nextPalette } = syncPaletteEntriesFromPixels(palette, nextPixels, canvasSize, {
        removeUnusedColors: true,
        addUsedColors: true
      });
      if (changedPixelCount === 0 && hasSamePaletteEntries(palette, nextPalette)) {
        setStatusText('減色結果は現在の内容と同じです', 'warning');
        return;
      }

      const previousPaletteColors = new Set(palette.map((entry) => entry.color));
      const nextPaletteColors = new Set(nextPalette.map((entry) => entry.color));
      const removedColorCount = palette.filter((entry) => !nextPaletteColors.has(entry.color)).length;
      const addedColorCount = nextPalette.filter((entry) => !previousPaletteColors.has(entry.color)).length;
      const nextSelectedColor = resolveNextSelectedColor(nextPalette, selectedColor);

      pushUndo();
      setPixels(nextPixels);
      setPalette(nextPalette);
      setSelectedColor(nextSelectedColor);
      setHasUnsavedChanges(true);
      setStatusText(
        `選択範囲を K-Means で減色しました: ${result.resultColorCount} 色 / パレット +${addedColorCount} -${removedColorCount}`,
        'success'
      );
    },
    [canvasSize, kMeansQuantizeRequest, palette, pixels, pushUndo, selectedColor, setHasUnsavedChanges, setPalette, setPixels, setSelectedColor, setStatusText]
  );

  const deleteSelection = useCallback(() => {
    if (floatingPasteRef.current) {
      setStatusText('削除の前に Enter で確定するか Esc でキャンセルしてください', 'warning');
      return;
    }
    if (!selection) {
      return;
    }

    pushUndo();
    clearFloatingPaste();
    setPixels((prev) => {
      const next = clonePixels(prev);
      for (let y = selection.y; y < selection.y + selection.h; y += 1) {
        for (let x = selection.x; x < selection.x + selection.w; x += 1) {
          const idx = (y * canvasSize.width + x) * 4;
          next[idx] = 0;
          next[idx + 1] = 0;
          next[idx + 2] = 0;
          next[idx + 3] = 0;
        }
      }
      return next;
    });
    setHasUnsavedChanges(true);
    setStatusText('選択範囲を削除しました', 'success');
  }, [canvasSize, clearFloatingPaste, floatingPasteRef, pushUndo, selection, setHasUnsavedChanges, setPixels, setStatusText]);

  const selectEntireCanvas = useCallback(() => {
    if (floatingPasteRef.current) {
      setStatusText('全選択の前に Enter で確定するか Esc でキャンセルしてください', 'warning');
      return;
    }

    setTool('select');
    setSelection({ x: 0, y: 0, w: canvasSize.width, h: canvasSize.height });
    setStatusText(`キャンバス全体を選択しました (${canvasSize.width}x${canvasSize.height})`, 'success');
  }, [canvasSize, floatingPasteRef, setSelection, setStatusText, setTool]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setStatusText('選択を解除しました', 'success');
  }, [setSelection, setStatusText]);

  return {
    kMeansQuantizeRequest,
    selectionRotateRequest,
    openSelectionRotateModal,
    closeSelectionRotateModal,
    applySelectionRotate,
    openKMeansQuantizeModal,
    closeKMeansQuantizeModal,
    applyKMeansQuantize,
    deleteSelection,
    selectEntireCanvas,
    clearSelection
  };
}
