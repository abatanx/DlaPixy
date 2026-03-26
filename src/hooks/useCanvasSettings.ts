import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { Selection } from '../editor/types';
import { resizeCanvasPixels } from '../editor/utils';

type StatusType = 'success' | 'warning' | 'error' | 'info';

type UseCanvasSettingsOptions = {
  canvasSize: number;
  pushUndo: () => void;
  clearFloatingPaste: () => void;
  resetTilePreviewLayers: () => void;
  resetAnimationFrames: () => void;
  setCanvasSize: Dispatch<SetStateAction<number>>;
  setPixels: Dispatch<SetStateAction<Uint8ClampedArray>>;
  setSelection: Dispatch<SetStateAction<Selection>>;
  setLastTilePreviewSelection: Dispatch<SetStateAction<Selection>>;
  setGridSpacing: Dispatch<SetStateAction<number>>;
  setHasUnsavedChanges: Dispatch<SetStateAction<boolean>>;
  setStatusText: (text: string, type: StatusType) => void;
};

export function useCanvasSettings({
  canvasSize,
  pushUndo,
  clearFloatingPaste,
  resetTilePreviewLayers,
  resetAnimationFrames,
  setCanvasSize,
  setPixels,
  setSelection,
  setLastTilePreviewSelection,
  setGridSpacing,
  setHasUnsavedChanges,
  setStatusText
}: UseCanvasSettingsOptions) {
  const [isCanvasSizeModalOpen, setIsCanvasSizeModalOpen] = useState<boolean>(false);
  const [isGridSpacingModalOpen, setIsGridSpacingModalOpen] = useState<boolean>(false);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState<boolean>(false);

  const applyCanvasSize = useCallback(
    (normalized: number) => {
      if (normalized === canvasSize) {
        setIsCanvasSizeModalOpen(false);
        return;
      }

      pushUndo();
      setCanvasSize(normalized);
      setPixels((prev) => resizeCanvasPixels(prev, canvasSize, normalized));
      setSelection(null);
      setLastTilePreviewSelection(null);
      resetTilePreviewLayers();
      resetAnimationFrames();
      clearFloatingPaste();
      setStatusText(`キャンバスを ${normalized}x${normalized} に変更しました`, 'success');
      setHasUnsavedChanges(true);
      setIsCanvasSizeModalOpen(false);
    },
    [
      canvasSize,
      clearFloatingPaste,
      pushUndo,
      resetAnimationFrames,
      resetTilePreviewLayers,
      setCanvasSize,
      setHasUnsavedChanges,
      setLastTilePreviewSelection,
      setPixels,
      setSelection,
      setStatusText
    ]
  );

  const openCanvasSizeModal = useCallback(() => {
    setIsCanvasSizeModalOpen(true);
  }, []);

  const closeCanvasSizeModal = useCallback(() => {
    setIsCanvasSizeModalOpen(false);
  }, []);

  const applyGridSpacing = useCallback(
    (value: number) => {
      setGridSpacing(value);
      setHasUnsavedChanges(true);
      setIsGridSpacingModalOpen(false);
      setStatusText(value === 0 ? '補助グリッドを非表示にしました' : `補助グリッドを ${value}px 間隔に変更しました`, 'success');
    },
    [setGridSpacing, setHasUnsavedChanges, setStatusText]
  );

  const openGridSpacingModal = useCallback(() => {
    setIsGridSpacingModalOpen(true);
  }, []);

  const closeGridSpacingModal = useCallback(() => {
    setIsGridSpacingModalOpen(false);
  }, []);

  const openZoomModal = useCallback(() => {
    setIsZoomModalOpen(true);
  }, []);

  const closeZoomModal = useCallback(() => {
    setIsZoomModalOpen(false);
  }, []);

  return {
    isCanvasSizeModalOpen,
    isGridSpacingModalOpen,
    isZoomModalOpen,
    applyCanvasSize,
    openCanvasSizeModal,
    closeCanvasSizeModal,
    applyGridSpacing,
    openGridSpacingModal,
    closeGridSpacingModal,
    openZoomModal,
    closeZoomModal
  };
}
