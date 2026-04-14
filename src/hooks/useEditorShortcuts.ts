/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { MenuAction } from '../../shared/ipc';
import type { GplExportFormat } from '../../shared/palette-gpl';
import type { TransparentBackgroundMode } from '../../shared/transparent-background';
import type { Tool } from '../editor/types';

type StatusType = 'success' | 'warning' | 'error' | 'info';

type UseEditorShortcutsOptions = {
  selectionRotateRequestActive: boolean;
  hasSelection: boolean;
  hasSelectedSlices: boolean;
  hasMultiSelectedSlices: boolean;
  floatingPasteRef: { current: unknown };
  tool: Tool;
  setTool: Dispatch<SetStateAction<Tool>>;
  activateSliceTool: () => boolean;
  setTransparentBackgroundMode: Dispatch<SetStateAction<TransparentBackgroundMode>>;
  setStatusText: (text: string, type: StatusType) => void;
  clearSelection: () => void;
  clearSliceSelection: () => void;
  doUndo: () => void;
  copySelection: () => Promise<void>;
  copySelectedSlices: () => boolean;
  pasteSelection: () => void;
  pasteSlices: () => boolean;
  selectEntireCanvas: () => void;
  selectAllSlices: () => boolean;
  deleteSelection: () => void;
  deleteSelectedSlices: () => boolean;
  duplicateSelectedSlices: () => boolean;
  selectReferenceByNumber: (number: number) => boolean;
  finalizeFloatingPaste: () => void;
  cancelFloatingPaste: () => void;
  nudgeFloatingPaste: (dx: number, dy: number) => void;
  nudgeSelectedSlices: (dx: number, dy: number) => boolean;
  addAnimationFrame: () => void;
  addTilePreviewLayer: () => void;
  openSelectionRotateModal: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  freezeHoveredPixelInfo: () => void;
  focusHoveredPixel: () => boolean;
  savePng: () => Promise<void>;
  saveAsPng: () => Promise<void>;
  loadPng: (args?: { filePath?: string; bypassUnsavedCheck?: boolean }) => Promise<void>;
  openZoomModal: () => void;
  openCanvasSizeModal: () => void;
  openGridSpacingModal: () => void;
  openAutoSliceModal: () => void;
  openKMeansQuantizeModal: () => void;
  importGplPalette: (mode: 'replace' | 'append') => Promise<void>;
  exportGplPalette: (format: GplExportFormat) => Promise<void>;
  exportSlices: () => Promise<void>;
};

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;
  return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function useEditorShortcuts({
  selectionRotateRequestActive,
  hasSelection,
  hasSelectedSlices,
  hasMultiSelectedSlices,
  floatingPasteRef,
  tool,
  setTool,
  activateSliceTool,
  setTransparentBackgroundMode,
  setStatusText,
  clearSelection,
  clearSliceSelection,
  doUndo,
  copySelection,
  copySelectedSlices,
  pasteSelection,
  pasteSlices,
  selectEntireCanvas,
  selectAllSlices,
  deleteSelection,
  deleteSelectedSlices,
  duplicateSelectedSlices,
  selectReferenceByNumber,
  finalizeFloatingPaste,
  cancelFloatingPaste,
  nudgeFloatingPaste,
  nudgeSelectedSlices,
  addAnimationFrame,
  addTilePreviewLayer,
  openSelectionRotateModal,
  zoomIn,
  zoomOut,
  freezeHoveredPixelInfo,
  focusHoveredPixel,
  savePng,
  saveAsPng,
  loadPng,
  openZoomModal,
  openCanvasSizeModal,
  openGridSpacingModal,
  openAutoSliceModal,
  openKMeansQuantizeModal,
  importGplPalette,
  exportGplPalette,
  exportSlices
}: UseEditorShortcutsOptions) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const withSystemKey = event.metaKey || event.ctrlKey;
      const isPlainDeleteKey =
        !withSystemKey && !event.altKey && (event.key === 'Delete' || event.key === 'Backspace');
      const allowMultiSliceDeleteFromEditable =
        isPlainDeleteKey && tool === 'slice' && hasMultiSelectedSlices;

      if ((isEditableElement(event.target) && !allowMultiSliceDeleteFromEditable) || selectionRotateRequestActive) {
        return;
      }

      if (withSystemKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        doUndo();
        return;
      }
      if (withSystemKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        if (tool === 'slice') {
          copySelectedSlices();
        } else {
          void copySelection();
        }
        return;
      }
      if (withSystemKey && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        if (tool === 'slice') {
          pasteSlices();
        } else {
          pasteSelection();
        }
        return;
      }
      if (withSystemKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        if (tool === 'slice') {
          selectAllSlices();
        } else {
          selectEntireCanvas();
        }
        return;
      }
      if (withSystemKey && event.key.toLowerCase() === 'd') {
        if (tool !== 'slice') {
          return;
        }
        event.preventDefault();
        duplicateSelectedSlices();
        return;
      }

      if (withSystemKey || event.altKey) {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        if (tool === 'slice') {
          deleteSelectedSlices();
        } else {
          deleteSelection();
        }
        return;
      }

      switch (event.code) {
        case 'Digit1':
        case 'Numpad1':
          event.preventDefault();
          if (!selectReferenceByNumber(1)) {
            setStatusText('参照 1 は未登録です', 'warning');
          }
          break;
        case 'Digit2':
        case 'Numpad2':
          event.preventDefault();
          if (!selectReferenceByNumber(2)) {
            setStatusText('参照 2 は未登録です', 'warning');
          }
          break;
        case 'Digit3':
        case 'Numpad3':
          event.preventDefault();
          if (!selectReferenceByNumber(3)) {
            setStatusText('参照 3 は未登録です', 'warning');
          }
          break;
        case 'Digit4':
        case 'Numpad4':
          event.preventDefault();
          if (!selectReferenceByNumber(4)) {
            setStatusText('参照 4 は未登録です', 'warning');
          }
          break;
        case 'Digit5':
        case 'Numpad5':
          event.preventDefault();
          if (!selectReferenceByNumber(5)) {
            setStatusText('参照 5 は未登録です', 'warning');
          }
          break;
        case 'Digit6':
        case 'Numpad6':
          event.preventDefault();
          if (!selectReferenceByNumber(6)) {
            setStatusText('参照 6 は未登録です', 'warning');
          }
          break;
        case 'Digit7':
        case 'Numpad7':
          event.preventDefault();
          if (!selectReferenceByNumber(7)) {
            setStatusText('参照 7 は未登録です', 'warning');
          }
          break;
        case 'Digit8':
        case 'Numpad8':
          event.preventDefault();
          if (!selectReferenceByNumber(8)) {
            setStatusText('参照 8 は未登録です', 'warning');
          }
          break;
        case 'Digit9':
        case 'Numpad9':
          event.preventDefault();
          if (!selectReferenceByNumber(9)) {
            setStatusText('参照 9 は未登録です', 'warning');
          }
          break;
        case 'Enter':
        case 'NumpadEnter':
          if (!floatingPasteRef.current) {
            break;
          }
          event.preventDefault();
          finalizeFloatingPaste();
          break;
        case 'Escape':
          if (tool === 'slice' && hasSelectedSlices) {
            event.preventDefault();
            clearSliceSelection();
            setStatusText('スライスの選択を解除しました', 'success');
            break;
          }
          if (floatingPasteRef.current) {
            event.preventDefault();
            cancelFloatingPaste();
            break;
          }
          if (hasSelection) {
            event.preventDefault();
            clearSelection();
          }
          break;
        case 'ArrowUp':
          if (tool === 'slice') {
            event.preventDefault();
            nudgeSelectedSlices(0, -1);
            break;
          }
          if (!floatingPasteRef.current) {
            break;
          }
          event.preventDefault();
          nudgeFloatingPaste(0, -1);
          break;
        case 'ArrowDown':
          if (tool === 'slice') {
            event.preventDefault();
            nudgeSelectedSlices(0, 1);
            break;
          }
          if (!floatingPasteRef.current) {
            break;
          }
          event.preventDefault();
          nudgeFloatingPaste(0, 1);
          break;
        case 'ArrowLeft':
          if (tool === 'slice') {
            event.preventDefault();
            nudgeSelectedSlices(-1, 0);
            break;
          }
          if (!floatingPasteRef.current) {
            break;
          }
          event.preventDefault();
          nudgeFloatingPaste(-1, 0);
          break;
        case 'ArrowRight':
          if (tool === 'slice') {
            event.preventDefault();
            nudgeSelectedSlices(1, 0);
            break;
          }
          if (!floatingPasteRef.current) {
            break;
          }
          event.preventDefault();
          nudgeFloatingPaste(1, 0);
          break;
        case 'KeyQ':
          event.preventDefault();
          setTool('select');
          setStatusText('ツール: 矩形選択', 'info');
          break;
        case 'KeyR':
          event.preventDefault();
          if (activateSliceTool()) {
            setStatusText('ツール: スライス', 'info');
          }
          break;
        case 'KeyW':
          event.preventDefault();
          setTool('pencil');
          setStatusText('ツール: 描画', 'info');
          break;
        case 'KeyE':
          event.preventDefault();
          setTool('eraser');
          setStatusText('ツール: 消しゴム', 'info');
          break;
        case 'KeyP':
          event.preventDefault();
          setTool('fill');
          setStatusText('ツール: 塗りつぶし', 'info');
          break;
        case 'KeyT':
          if (tool === 'slice') {
            break;
          }
          event.preventDefault();
          addAnimationFrame();
          break;
        case 'KeyG':
          if (tool === 'slice') {
            break;
          }
          event.preventDefault();
          addTilePreviewLayer();
          break;
        case 'KeyY':
          if (tool === 'slice') {
            break;
          }
          event.preventDefault();
          openSelectionRotateModal();
          break;
        case 'Equal':
        case 'NumpadAdd':
        case 'KeyD':
        case 'BracketRight':
        case 'Period':
          event.preventDefault();
          zoomIn();
          break;
        case 'Minus':
        case 'NumpadSubtract':
        case 'KeyA':
        case 'BracketLeft':
        case 'Comma':
          event.preventDefault();
          zoomOut();
          break;
        case 'KeyF':
          event.preventDefault();
          freezeHoveredPixelInfo();
          break;
        case 'KeyS':
          event.preventDefault();
          focusHoveredPixel();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [
    addAnimationFrame,
    addTilePreviewLayer,
    cancelFloatingPaste,
    clearSelection,
    clearSliceSelection,
    copySelection,
    copySelectedSlices,
    deleteSelection,
    deleteSelectedSlices,
    doUndo,
    duplicateSelectedSlices,
    finalizeFloatingPaste,
    floatingPasteRef,
    focusHoveredPixel,
    freezeHoveredPixelInfo,
    hasMultiSelectedSlices,
    hasSelection,
    hasSelectedSlices,
    activateSliceTool,
    nudgeFloatingPaste,
    nudgeSelectedSlices,
    openSelectionRotateModal,
    pasteSelection,
    pasteSlices,
    selectEntireCanvas,
    selectAllSlices,
    selectReferenceByNumber,
    selectionRotateRequestActive,
    setStatusText,
    tool,
    zoomIn,
    zoomOut
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) {
        return;
      }
      if (isEditableElement(event.target) || selectionRotateRequestActive) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        if (event.shiftKey) {
          void saveAsPng();
        } else {
          void savePng();
        }
        return;
      }
      if (key === 'o') {
        event.preventDefault();
        void loadPng();
        return;
      }
      if (key === 'r') {
        event.preventDefault();
        openZoomModal();
        return;
      }
      if (key === 'i') {
        event.preventDefault();
        openCanvasSizeModal();
        return;
      }
      if (key === 'g') {
        event.preventDefault();
        openGridSpacingModal();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [
    loadPng,
    openCanvasSizeModal,
    openGridSpacingModal,
    openZoomModal,
    saveAsPng,
    savePng,
    selectionRotateRequestActive
  ]);

  useEffect(() => {
    const unsubscribe = window.pixelApi.onMenuAction((action: MenuAction) => {
      switch (action.type) {
        case 'open':
          void loadPng();
          break;
        case 'save':
          void savePng();
          break;
        case 'save-as':
          void saveAsPng();
          break;
        case 'open-recent':
          void loadPng({ filePath: action.filePath });
          break;
        case 'canvas-size':
          openCanvasSizeModal();
          break;
        case 'grid-spacing':
          openGridSpacingModal();
          break;
        case 'slice-auto':
          if (activateSliceTool()) {
            openAutoSliceModal();
          }
          break;
        case 'slice-export':
          if (activateSliceTool()) {
            void exportSlices();
          }
          break;
        case 'transparent-background':
          setTransparentBackgroundMode(action.mode);
          break;
        case 'palette-kmeans-quantize':
          openKMeansQuantizeModal();
          break;
        case 'palette-import-replace':
          void importGplPalette('replace');
          break;
        case 'palette-import-append':
          void importGplPalette('append');
          break;
        case 'palette-export':
          void exportGplPalette(action.format);
          break;
        default:
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [
    exportGplPalette,
    importGplPalette,
    loadPng,
    activateSliceTool,
    openCanvasSizeModal,
    openAutoSliceModal,
    openGridSpacingModal,
    openKMeansQuantizeModal,
    saveAsPng,
    savePng,
    setTransparentBackgroundMode,
    exportSlices
  ]);
}
