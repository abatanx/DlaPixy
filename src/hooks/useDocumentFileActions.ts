/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { SIDECAR_SCHEMA_VERSION } from '../../shared/sidecar';
import {
  DEFAULT_FLOATING_COMPOSITE_MODE,
  type FloatingCompositeMode
} from '../../shared/floating-composite';
import {
  DEFAULT_TRANSPARENT_BACKGROUND_MODE,
  type TransparentBackgroundMode
} from '../../shared/transparent-background';
import {
  DEFAULT_CANVAS_SIZE,
  DEFAULT_GRID_SPACING,
  DEFAULT_ZOOM,
  MAX_CANVAS_SIZE,
  MAX_ZOOM,
  MIN_CANVAS_SIZE,
  MIN_ZOOM
} from '../editor/constants';
import { resolveNextSelectedColor } from '../editor/app-utils';
import { collectPaletteUsageFromPixels, syncPaletteEntriesWithUsage } from '../editor/palette-sync';
import {
  buildSliceExportPlans,
  getSliceExportScopeSlices,
  renderSliceExportFiles
} from '../editor/slice-export';
import { normalizeEditorSlices } from '../editor/slices';
import type { EditorMeta, EditorSlice, PaletteEntry, Selection, Tool } from '../editor/types';
import { clampCanvasSize, clonePaletteEntries, cloneSlices, normalizePaletteEntries } from '../editor/utils';

type StatusType = 'success' | 'warning' | 'error' | 'info';

type UseDocumentFileActionsOptions = {
  canvasSize: number;
  currentFilePath?: string;
  gridSpacing: number;
  hasUnsavedChanges: boolean;
  floatingCompositeMode: FloatingCompositeMode;
  palette: PaletteEntry[];
  slices: EditorSlice[];
  selectedSliceIds: string[];
  pixels: Uint8ClampedArray;
  selectedColor: string;
  tool: Tool;
  transparentBackgroundMode: TransparentBackgroundMode;
  zoom: number;
  canvasStageRef: MutableRefObject<HTMLDivElement | null>;
  pendingZoomAnchorRef: MutableRefObject<unknown>;
  pendingViewportRestoreRef: MutableRefObject<{ scrollLeft: number; scrollTop: number } | null>;
  undoStackRef: MutableRefObject<unknown[]>;
  setCanvasSize: Dispatch<SetStateAction<number>>;
  setPixels: Dispatch<SetStateAction<Uint8ClampedArray>>;
  setSelection: Dispatch<SetStateAction<Selection>>;
  setLastTilePreviewSelection: Dispatch<SetStateAction<Selection>>;
  setCurrentFilePath: Dispatch<SetStateAction<string | undefined>>;
  setFloatingCompositeMode: Dispatch<SetStateAction<FloatingCompositeMode>>;
  setPalette: Dispatch<SetStateAction<PaletteEntry[]>>;
  setSlices: Dispatch<SetStateAction<EditorSlice[]>>;
  setSelectedColor: Dispatch<SetStateAction<string>>;
  setTool: Dispatch<SetStateAction<Tool>>;
  setGridSpacing: Dispatch<SetStateAction<number>>;
  setZoom: Dispatch<SetStateAction<number>>;
  setTransparentBackgroundMode: Dispatch<SetStateAction<TransparentBackgroundMode>>;
  setViewportRestoreSequence: Dispatch<SetStateAction<number>>;
  setHasUnsavedChanges: Dispatch<SetStateAction<boolean>>;
  resetTilePreviewLayers: () => void;
  resetAnimationFrames: () => void;
  resetPaletteOrderViewState: () => void;
  resetSliceUiState: () => void;
  clearFloatingPaste: () => void;
  setStatusText: (text: string, type: StatusType) => void;
};

export function useDocumentFileActions({
  canvasSize,
  currentFilePath,
  gridSpacing,
  hasUnsavedChanges,
  floatingCompositeMode,
  palette,
  slices,
  selectedSliceIds,
  pixels,
  selectedColor,
  tool,
  transparentBackgroundMode,
  zoom,
  canvasStageRef,
  pendingZoomAnchorRef,
  pendingViewportRestoreRef,
  undoStackRef,
  setCanvasSize,
  setPixels,
  setSelection,
  setLastTilePreviewSelection,
  setCurrentFilePath,
  setFloatingCompositeMode,
  setPalette,
  setSlices,
  setSelectedColor,
  setTool,
  setGridSpacing,
  setZoom,
  setTransparentBackgroundMode,
  setViewportRestoreSequence,
  setHasUnsavedChanges,
  resetTilePreviewLayers,
  resetAnimationFrames,
  resetPaletteOrderViewState,
  resetSliceUiState,
  clearFloatingPaste,
  setStatusText
}: UseDocumentFileActionsOptions) {
  const createSavePayload = useCallback(() => {
    const canvas = document.createElement('canvas');
    const stage = canvasStageRef.current;
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    ctx.putImageData(new ImageData(pixels.slice(), canvasSize, canvasSize), 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    const base64Png = dataUrl.replace(/^data:image\/png;base64,/, '');

    const metadata: EditorMeta = {
      dlaPixy: {
        schemaVersion: SIDECAR_SCHEMA_VERSION,
        document: {
          palette: {
            entries: clonePaletteEntries(palette)
          },
          slices: cloneSlices(slices)
        },
        editor: {
          floatingCompositeMode,
          gridSpacing,
          transparentBackgroundMode,
          zoom,
          viewport: {
            scrollLeft: stage?.scrollLeft ?? 0,
            scrollTop: stage?.scrollTop ?? 0
          },
          lastTool: tool
        }
      }
    };

    return { base64Png, metadata };
  }, [canvasSize, canvasStageRef, floatingCompositeMode, gridSpacing, palette, pixels, slices, tool, transparentBackgroundMode, zoom]);

  const performSave = useCallback(
    async (options: { saveAs: boolean; suppressCancelToast?: boolean }): Promise<'saved' | 'canceled' | 'failed'> => {
      const payload = createSavePayload();
      if (!payload) {
        setStatusText('保存に失敗しました: キャンバスの初期化に失敗しました', 'error');
        return 'failed';
      }

      try {
        const result = await window.pixelApi.savePng({
          ...payload,
          filePath: currentFilePath,
          saveAs: options.saveAs
        });

        if (result.canceled || !result.filePath) {
          if (!options.suppressCancelToast) {
            setStatusText('保存をキャンセルしました', 'warning');
          }
          return 'canceled';
        }

        setCurrentFilePath(result.filePath);
        setHasUnsavedChanges(false);
        setStatusText(`保存しました: ${result.filePath}`, 'success');
        return 'saved';
      } catch (error) {
        const message = error instanceof Error ? error.message : '不明なエラー';
        setStatusText(`保存に失敗しました: ${message}`, 'error');
        return 'failed';
      }
    },
    [createSavePayload, currentFilePath, setCurrentFilePath, setHasUnsavedChanges, setStatusText]
  );

  const savePng = useCallback(async () => {
    await performSave({ saveAs: false });
  }, [performSave]);

  const saveAsPng = useCallback(async () => {
    await performSave({ saveAs: true });
  }, [performSave]);

  const confirmBeforeOpen = useCallback(async (): Promise<boolean> => {
    if (!hasUnsavedChanges) {
      return true;
    }

    const confirmResult = await window.pixelApi.confirmOpenWithUnsaved();
    if (confirmResult.action === 'cancel') {
      setStatusText('読み込みをキャンセルしました', 'warning');
      return false;
    }

    if (confirmResult.action === 'save-open') {
      const saveResult = await performSave({ saveAs: false, suppressCancelToast: true });
      if (saveResult === 'saved') {
        return true;
      }
      if (saveResult === 'canceled') {
        setStatusText('保存がキャンセルされたため、読み込みを中止しました', 'warning');
        return false;
      }

      setStatusText('保存に失敗したため、読み込みを中止しました', 'error');
      return false;
    }

    return true;
  }, [hasUnsavedChanges, performSave, setStatusText]);

  const loadPng = useCallback(
    async (args?: { filePath?: string; bypassUnsavedCheck?: boolean }) => {
      if (!args?.bypassUnsavedCheck) {
        const canProceed = await confirmBeforeOpen();
        if (!canProceed) {
          return;
        }
      }

      try {
        const result = await window.pixelApi.openPng(args?.filePath ? { filePath: args.filePath } : undefined);
        if (result.canceled || !result.base64Png) {
          setStatusText('読み込みをキャンセルしました', 'warning');
          return;
        }
        if (result.error === 'not-found') {
          setStatusText(`ファイルが見つかりません: ${result.filePath ?? args?.filePath ?? '-'}`, 'error');
          return;
        }
        if (result.error === 'read-failed') {
          setStatusText(`読み込みに失敗しました: ${result.filePath ?? args?.filePath ?? '-'}`, 'error');
          return;
        }

        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('PNG画像の読み込みに失敗'));
          img.src = `data:image/png;base64,${result.base64Png}`;
        });

        const fallbackSize = img.width === img.height ? img.width : DEFAULT_CANVAS_SIZE;
        const targetCanvasSize = clampCanvasSize(fallbackSize, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE);
        const editorState = result.metadata?.dlaPixy.editor;

        const canvas = document.createElement('canvas');
        canvas.width = targetCanvasSize;
        canvas.height = targetCanvasSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setStatusText('読み込みに失敗しました: キャンバスの初期化に失敗しました', 'error');
          return;
        }

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, targetCanvasSize, targetCanvasSize);
        ctx.drawImage(img, 0, 0, targetCanvasSize, targetCanvasSize);

        const imageData = ctx.getImageData(0, 0, targetCanvasSize, targetCanvasSize);
        const loadedPixels = new Uint8ClampedArray(imageData.data);
        const usageFromLoadedPixels = collectPaletteUsageFromPixels(loadedPixels, targetCanvasSize);

        setCanvasSize(targetCanvasSize);
        setPixels(loadedPixels);
        setSelection(null);
        setLastTilePreviewSelection(null);
        resetTilePreviewLayers();
        resetAnimationFrames();
        resetPaletteOrderViewState();
        resetSliceUiState();
        clearFloatingPaste();
        undoStackRef.current = [];
        pendingZoomAnchorRef.current = null;
        setCurrentFilePath(result.filePath);

        const metadataPalette = result.metadata?.dlaPixy.document.palette.entries.length
          ? normalizePaletteEntries(result.metadata.dlaPixy.document.palette.entries)
          : [];
        const nextPalette = syncPaletteEntriesWithUsage(metadataPalette, usageFromLoadedPixels, {
          removeUnusedColors: false,
          addUsedColors: true
        });
        const nextSlices = normalizeEditorSlices(result.metadata?.dlaPixy.document.slices ?? [], targetCanvasSize);

        setPalette(nextPalette);
        setSlices(nextSlices);
        setSelectedColor(resolveNextSelectedColor(nextPalette, selectedColor));
        setTool(editorState?.lastTool ?? 'select');
        setFloatingCompositeMode(editorState?.floatingCompositeMode ?? DEFAULT_FLOATING_COMPOSITE_MODE);

        const loadedGridSpacing = editorState?.gridSpacing;
        if (typeof loadedGridSpacing === 'number' && Number.isFinite(loadedGridSpacing)) {
          if (loadedGridSpacing <= 0) {
            setGridSpacing(DEFAULT_GRID_SPACING);
          } else {
            setGridSpacing(Math.max(1, Math.min(targetCanvasSize, Math.trunc(loadedGridSpacing))));
          }
        } else {
          setGridSpacing(DEFAULT_GRID_SPACING);
        }

        const loadedZoom = editorState?.zoom;
        if (typeof loadedZoom === 'number' && Number.isFinite(loadedZoom)) {
          setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.trunc(loadedZoom))));
        } else {
          setZoom(DEFAULT_ZOOM);
        }

        setTransparentBackgroundMode(editorState?.transparentBackgroundMode ?? DEFAULT_TRANSPARENT_BACKGROUND_MODE);

        pendingViewportRestoreRef.current = {
          scrollLeft: Math.max(0, editorState?.viewport?.scrollLeft ?? 0),
          scrollTop: Math.max(0, editorState?.viewport?.scrollTop ?? 0)
        };
        setViewportRestoreSequence((prev) => prev + 1);

        setHasUnsavedChanges(false);

        const nonSquareNote = img.width !== img.height ? ' / 非正方形PNGは正方形キャンバスに合わせて変換' : '';
        setStatusText(`読み込みました: ${result.filePath} (${img.width}x${img.height})${nonSquareNote}`, 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : '不明なエラー';
        setStatusText(`読み込みに失敗しました: ${message}`, 'error');
      }
    },
    [
      clearFloatingPaste,
      confirmBeforeOpen,
      pendingViewportRestoreRef,
      pendingZoomAnchorRef,
      resetAnimationFrames,
      resetPaletteOrderViewState,
      resetSliceUiState,
      resetTilePreviewLayers,
      selectedColor,
      setCanvasSize,
      setCurrentFilePath,
      setFloatingCompositeMode,
      setGridSpacing,
      setHasUnsavedChanges,
      setLastTilePreviewSelection,
      setPalette,
      setSlices,
      setPixels,
      setSelectedColor,
      setSelection,
      setStatusText,
      setTool,
      setTransparentBackgroundMode,
      setViewportRestoreSequence,
      setZoom,
      undoStackRef
    ]
  );

  const exportSlices = useCallback(async () => {
    const exportScopeSlices = getSliceExportScopeSlices(slices, selectedSliceIds);
    if (exportScopeSlices.length === 0) {
      setStatusText('書き出し対象のスライスがありません', 'warning');
      return;
    }

    const planResult = buildSliceExportPlans(exportScopeSlices);
    if ('error' in planResult) {
      setStatusText(planResult.error, 'warning');
      return;
    }

    try {
      const files = await renderSliceExportFiles({
        canvasSize,
        pixels,
        plans: planResult.plans
      });
      const result = await window.pixelApi.exportSliceFiles({ files });
      if (result.canceled) {
        setStatusText('スライスの書き出しをキャンセルしました', 'warning');
        return;
      }
      if (result.error) {
        setStatusText(`スライスの書き出しに失敗しました: ${result.message ?? result.error}`, 'error');
        return;
      }

      setStatusText(
        `スライスの書き出しが完了しました: ${result.fileCount ?? files.length}件 / 保存先: ${result.directoryPath ?? '-'}`,
        'success'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '不明なエラー';
      setStatusText(`スライスの書き出しに失敗しました: ${message}`, 'error');
    }
  }, [canvasSize, pixels, selectedSliceIds, setStatusText, slices]);

  return {
    savePng,
    saveAsPng,
    loadPng,
    exportSlices
  };
}
