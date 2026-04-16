/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useEffect, type MutableRefObject } from 'react';
import type { FloatingCompositeMode } from '../../shared/floating-composite';
import type { FloatingScaleMode } from '../../shared/floating-scale-mode';
import type { ClipboardPixelBlock, FloatingPasteState } from '../editor/floating-paste';
import type { CanvasSize, Selection, Tool } from '../editor/types';
import {
  blitBlockOnCanvas,
  clampSelectionToCanvas,
  clonePixels,
  cloneSelection,
  resizePixelBlock
} from '../editor/utils';

type StatusType = 'success' | 'warning' | 'error' | 'info';

type PasteSourceMode = 'internal' | 'external';
type FloatingPasteRenderQuality = 'interactive' | 'final';

type UseFloatingPasteOptions = {
  canvasSize: CanvasSize;
  floatingCompositeMode: FloatingCompositeMode;
  floatingScaleMode: FloatingScaleMode;
  isFloatingInteractionActive: boolean;
  zoom: number;
  pixels: Uint8ClampedArray;
  selection: Selection;
  tool: Tool;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  canvasStageRef: MutableRefObject<HTMLDivElement | null>;
  selectionClipboardRef: MutableRefObject<ClipboardPixelBlock | null>;
  floatingPasteRef: MutableRefObject<FloatingPasteState | null>;
  pushUndo: () => void;
  clearFloatingPaste: () => void;
  syncPaletteAfterPaste: (nextPixels: Uint8ClampedArray) => void;
  setFloatingPreviewPixels: (value: Uint8ClampedArray | null) => void;
  setFloatingInteractionActive: (value: boolean) => void;
  setPixels: (value: Uint8ClampedArray | ((prev: Uint8ClampedArray) => Uint8ClampedArray)) => void;
  setSelection: (value: Selection) => void;
  setTool: (value: Tool) => void;
  setHasUnsavedChanges: (value: boolean) => void;
  setStatusText: (text: string, type: StatusType) => void;
};

export function useFloatingPaste({
  canvasSize,
  floatingCompositeMode,
  floatingScaleMode,
  isFloatingInteractionActive,
  zoom,
  pixels,
  selection,
  tool,
  canvasRef,
  canvasStageRef,
  selectionClipboardRef,
  floatingPasteRef,
  pushUndo,
  clearFloatingPaste,
  syncPaletteAfterPaste,
  setFloatingPreviewPixels,
  setFloatingInteractionActive,
  setPixels,
  setSelection,
  setTool,
  setHasUnsavedChanges,
  setStatusText
}: UseFloatingPasteOptions) {
  const resolveDefaultPasteOrigin = useCallback(
    (clip: ClipboardPixelBlock, mode: PasteSourceMode) => {
      if (selection) {
        return { x: selection.x, y: selection.y };
      }

      if (mode === 'internal') {
        return {
          x: Math.min(clip.sourceX + 1, canvasSize.width - 1),
          y: Math.min(clip.sourceY + 1, canvasSize.height - 1)
        };
      }

      const stage = canvasStageRef.current;
      const canvas = canvasRef.current;
      if (!stage || !canvas) {
        return { x: 0, y: 0 };
      }

      const centerX = (stage.scrollLeft + stage.clientWidth / 2 - canvas.offsetLeft) / zoom;
      const centerY = (stage.scrollTop + stage.clientHeight / 2 - canvas.offsetTop) / zoom;
      return {
        x: Math.round(centerX - clip.width / 2),
        y: Math.round(centerY - clip.height / 2)
      };
    },
    [canvasSize, canvasRef, canvasStageRef, selection, zoom]
  );

  const applyFloatingPasteBlock = useCallback(
    (
      floating: FloatingPasteState,
      nextX: number,
      nextY: number,
      nextWidth: number,
      nextHeight: number,
      quality: FloatingPasteRenderQuality = 'final'
    ) => {
      const renderScaleMode =
        quality === 'interactive' && floatingScaleMode === 'alpha-smooth' && (nextWidth !== floating.width || nextHeight !== floating.height)
          ? 'crisp'
          : floatingScaleMode;
      const nextPixels =
        nextWidth === floating.width &&
        nextHeight === floating.height &&
        floating.renderedScaleMode === renderScaleMode
          ? floating.pixels
          : resizePixelBlock(
              floating.sourcePixels,
              floating.sourceWidth,
              floating.sourceHeight,
              nextWidth,
              nextHeight,
              renderScaleMode
            );
      const composited = blitBlockOnCanvas(
        floating.basePixels,
        canvasSize,
        nextPixels,
        nextWidth,
        nextHeight,
        nextX,
        nextY,
        floatingCompositeMode
      );

      floating.x = nextX;
      floating.y = nextY;
      floating.width = nextWidth;
      floating.height = nextHeight;
      floating.pixels = nextPixels;
      floating.renderedScaleMode = renderScaleMode;
      setFloatingPreviewPixels(composited);
      setSelection({ x: nextX, y: nextY, w: nextWidth, h: nextHeight });
      return composited;
    },
    [canvasSize, floatingCompositeMode, floatingScaleMode, setFloatingPreviewPixels, setSelection]
  );

  const loadPixelBlockFromDataUrl = useCallback(async (dataUrl: string): Promise<ClipboardPixelBlock | null> => {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('クリップボード画像の読み込みに失敗しました'));
      img.src = dataUrl;
    });

    const width = Math.max(1, Math.trunc(img.width));
    const height = Math.max(1, Math.trunc(img.height));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    return {
      width,
      height,
      pixels: new Uint8ClampedArray(imageData.data),
      sourceX: 0,
      sourceY: 0
    };
  }, []);

  const readPasteSourceFromClipboard = useCallback(async (): Promise<{
    block: ClipboardPixelBlock | null;
    mode: PasteSourceMode | null;
  }> => {
    const internalClip = selectionClipboardRef.current;
    const clipboardResult = await window.pixelApi.readClipboardImageDataUrl().catch(() => ({
      ok: false,
      hasImage: false,
      dataUrl: undefined,
      markerToken: undefined
    }));

    if (clipboardResult.hasImage && clipboardResult.markerToken && internalClip?.markerToken === clipboardResult.markerToken) {
      return { block: internalClip, mode: 'internal' };
    }
    if (clipboardResult.hasImage && clipboardResult.dataUrl) {
      const externalBlock = await loadPixelBlockFromDataUrl(clipboardResult.dataUrl);
      return { block: externalBlock, mode: externalBlock ? 'external' : null };
    }
    if (internalClip) {
      return { block: internalClip, mode: 'internal' };
    }

    return { block: null, mode: null };
  }, [loadPixelBlockFromDataUrl, selectionClipboardRef]);

  const beginFloatingPaste = useCallback(
    (clip: ClipboardPixelBlock, mode: PasteSourceMode) => {
      if (floatingPasteRef.current) {
        setStatusText('貼り付け前に Enter で確定するか Esc でキャンセルしてください', 'warning');
        return false;
      }

      const origin = resolveDefaultPasteOrigin(clip, mode);
      const nextRect = {
        x: Math.max(1 - clip.width, Math.min(origin.x, canvasSize.width - 1)),
        y: Math.max(1 - clip.height, Math.min(origin.y, canvasSize.height - 1)),
        width: clip.width,
        height: clip.height
      };

      pushUndo();
      const basePixels = clonePixels(pixels);
      const pastedPixels = clonePixels(clip.pixels);
      const floating: FloatingPasteState = {
        x: nextRect.x,
        y: nextRect.y,
        width: clip.width,
        height: clip.height,
        pixels: pastedPixels,
        renderedScaleMode: floatingScaleMode,
        sourceWidth: clip.width,
        sourceHeight: clip.height,
        sourcePixels: clonePixels(pastedPixels),
        basePixels,
        restorePixels: clonePixels(pixels),
        restoreSelection: cloneSelection(selection),
        restoreTool: tool
      };
      floatingPasteRef.current = floating;
      setFloatingInteractionActive(false);
      applyFloatingPasteBlock(floating, nextRect.x, nextRect.y, clip.width, clip.height);
      setTool('select');
      setStatusText(`画像を貼り付けました (${clip.width}x${clip.height}) - Enterで確定 / Escでキャンセル`, 'success');
      return true;
    },
    [
      applyFloatingPasteBlock,
      canvasSize,
      floatingPasteRef,
      pixels,
      pushUndo,
      resolveDefaultPasteOrigin,
      selection,
      setFloatingInteractionActive,
      setStatusText,
      setTool,
      tool
    ]
  );

  const liftSelectionToFloatingPaste = useCallback(() => {
    if (floatingPasteRef.current || !selection) {
      return null;
    }

    pushUndo();
    const basePixels = clonePixels(pixels);
      const selectedPixels = new Uint8ClampedArray(selection.w * selection.h * 4);
      for (let y = 0; y < selection.h; y += 1) {
        for (let x = 0; x < selection.w; x += 1) {
          const srcIdx = ((selection.y + y) * canvasSize.width + (selection.x + x)) * 4;
          const dstIdx = (y * selection.w + x) * 4;
        selectedPixels[dstIdx] = pixels[srcIdx];
        selectedPixels[dstIdx + 1] = pixels[srcIdx + 1];
        selectedPixels[dstIdx + 2] = pixels[srcIdx + 2];
        selectedPixels[dstIdx + 3] = pixels[srcIdx + 3];

        basePixels[srcIdx] = 0;
        basePixels[srcIdx + 1] = 0;
        basePixels[srcIdx + 2] = 0;
        basePixels[srcIdx + 3] = 0;
      }
    }

    const floating: FloatingPasteState = {
      x: selection.x,
      y: selection.y,
      width: selection.w,
      height: selection.h,
      pixels: selectedPixels,
      renderedScaleMode: floatingScaleMode,
      sourceWidth: selection.w,
      sourceHeight: selection.h,
      sourcePixels: clonePixels(selectedPixels),
      basePixels,
      restorePixels: clonePixels(pixels),
      restoreSelection: cloneSelection(selection),
      restoreTool: tool
    };

    floatingPasteRef.current = floating;
    setFloatingInteractionActive(false);
    applyFloatingPasteBlock(floating, selection.x, selection.y, selection.w, selection.h);
    return floating;
  }, [applyFloatingPasteBlock, canvasSize, floatingPasteRef, pixels, pushUndo, selection, setFloatingInteractionActive, tool]);

  useEffect(() => {
    const floating = floatingPasteRef.current;
    if (!floating) {
      return;
    }

    applyFloatingPasteBlock(
      floating,
      floating.x,
      floating.y,
      floating.width,
      floating.height,
      isFloatingInteractionActive ? 'interactive' : 'final'
    );
  }, [applyFloatingPasteBlock, floatingCompositeMode, floatingPasteRef, floatingScaleMode, isFloatingInteractionActive]);

  const startFloatingInteractionPreview = useCallback(() => {
    setFloatingInteractionActive(true);
  }, [setFloatingInteractionActive]);

  const completeFloatingInteractionPreview = useCallback(() => {
    setFloatingInteractionActive(false);
    const floating = floatingPasteRef.current;
    if (!floating) {
      return;
    }

    applyFloatingPasteBlock(floating, floating.x, floating.y, floating.width, floating.height, 'final');
  }, [applyFloatingPasteBlock, floatingPasteRef, setFloatingInteractionActive]);

  const commitFloatingPaste = useCallback(
    ({ keepSelection }: { keepSelection: boolean }) => {
      const floating = floatingPasteRef.current;
      if (!floating) {
        return false;
      }

      const composited = applyFloatingPasteBlock(floating, floating.x, floating.y, floating.width, floating.height, 'final');
      setPixels(composited);
      setSelection(
        keepSelection
          ? clampSelectionToCanvas(
              {
                x: floating.x,
                y: floating.y,
                w: floating.width,
                h: floating.height
              },
              canvasSize
            )
          : null
      );
      syncPaletteAfterPaste(composited);
      setFloatingPreviewPixels(null);
      setFloatingInteractionActive(false);
      clearFloatingPaste();
      setTool('select');
      setHasUnsavedChanges(true);
      return true;
    },
    [
      applyFloatingPasteBlock,
      canvasSize,
      clearFloatingPaste,
      floatingPasteRef,
      setFloatingInteractionActive,
      setFloatingPreviewPixels,
      setHasUnsavedChanges,
      setPixels,
      setSelection,
      setTool,
      syncPaletteAfterPaste
    ]
  );

  const finalizeFloatingPaste = useCallback(() => {
    const committed = commitFloatingPaste({ keepSelection: true });
    if (!committed) {
      return;
    }

    setStatusText('フローティングを確定しました', 'success');
  }, [commitFloatingPaste, setStatusText]);

  const finalizeFloatingPasteAndClearSelection = useCallback(() => {
    const committed = commitFloatingPaste({ keepSelection: false });
    if (!committed) {
      return false;
    }

    setStatusText('フローティングを確定して選択を解除しました', 'success');
    return true;
  }, [commitFloatingPaste, setStatusText]);

  const cancelFloatingPaste = useCallback(() => {
    const floating = floatingPasteRef.current;
    if (!floating) {
      return;
    }

    setFloatingPreviewPixels(null);
    setFloatingInteractionActive(false);
    setSelection(cloneSelection(floating.restoreSelection));
    setTool(floating.restoreTool);
    clearFloatingPaste();
    setStatusText('貼り付け移動をキャンセルしました', 'warning');
  }, [clearFloatingPaste, floatingPasteRef, setFloatingInteractionActive, setFloatingPreviewPixels, setSelection, setStatusText, setTool]);

  const nudgeFloatingPaste = useCallback(
    (dx: number, dy: number): boolean => {
      const floating = floatingPasteRef.current;
      if (!floating) {
        return false;
      }

      const nextX = Math.max(1 - floating.width, Math.min(floating.x + dx, canvasSize.width - 1));
      const nextY = Math.max(1 - floating.height, Math.min(floating.y + dy, canvasSize.height - 1));
      if (nextX === floating.x && nextY === floating.y) {
        return false;
      }

      applyFloatingPasteBlock(floating, nextX, nextY, floating.width, floating.height);
      return true;
    },
    [applyFloatingPasteBlock, canvasSize, floatingPasteRef]
  );

  const copySelection = useCallback(async () => {
    if (floatingPasteRef.current) {
      setStatusText('コピーの前に Enter で確定するか Esc でキャンセルしてください', 'warning');
      return;
    }
    if (!selection) {
      setStatusText('選択範囲がありません', 'warning');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = selection.w;
    canvas.height = selection.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const imageData = ctx.createImageData(selection.w, selection.h);
    for (let y = 0; y < selection.h; y += 1) {
      for (let x = 0; x < selection.w; x += 1) {
        const srcIdx = ((selection.y + y) * canvasSize.width + (selection.x + x)) * 4;
        const dstIdx = (y * selection.w + x) * 4;
        imageData.data[dstIdx] = pixels[srcIdx];
        imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
        imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
        imageData.data[dstIdx + 3] = pixels[srcIdx + 3];
      }
    }

    ctx.putImageData(imageData, 0, 0);
    const markerToken =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `dlapixy-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    selectionClipboardRef.current = {
      width: selection.w,
      height: selection.h,
      pixels: new Uint8ClampedArray(imageData.data),
      sourceX: selection.x,
      sourceY: selection.y,
      markerToken
    };

    await window.pixelApi.copyImageDataUrl({ dataUrl: canvas.toDataURL('image/png'), markerToken });
    setStatusText('選択範囲をクリップボードにコピーしました', 'success');
  }, [canvasSize, floatingPasteRef, pixels, selection, selectionClipboardRef, setStatusText]);

  const pasteSelection = useCallback(() => {
    void (async () => {
      const { block, mode } = await readPasteSourceFromClipboard();
      if (!block || !mode) {
        setStatusText('貼り付けできる画像がクリップボードにありません', 'warning');
        return;
      }
      beginFloatingPaste(block, mode);
    })();
  }, [beginFloatingPaste, readPasteSourceFromClipboard, setStatusText]);

  const enterFloatingSelection = useCallback((): boolean => {
    if (floatingPasteRef.current) {
      setTool('select');
      return true;
    }
    if (!selection) {
      setStatusText('先に矩形選択してください', 'warning');
      return false;
    }

    const floating = liftSelectionToFloatingPaste();
    if (!floating) {
      return false;
    }

    setTool('select');
    setStatusText('フローティングにしました: Enterで確定 / Qで通常選択', 'success');
    return true;
  }, [floatingPasteRef, liftSelectionToFloatingPaste, selection, setStatusText, setTool]);

  return {
    applyFloatingPasteBlock,
    startFloatingInteractionPreview,
    completeFloatingInteractionPreview,
    liftSelectionToFloatingPaste,
    enterFloatingSelection,
    copySelection,
    pasteSelection,
    finalizeFloatingPaste,
    finalizeFloatingPasteAndClearSelection,
    cancelFloatingPaste,
    nudgeFloatingPaste
  };
}
