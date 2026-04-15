/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { createRegionPreviewDataUrl, createTilePreviewLayerDataUrl, createTilePreviewLayerThumbnailDataUrl } from '../editor/preview';
import { extractSelectionPixelBlock } from '../editor/selection-rotate';
import type { AnimationFrame, CanvasSize, Selection, TilePreviewLayer } from '../editor/types';
import { clampSelectionToCanvas } from '../editor/utils';

type StatusType = 'success' | 'warning' | 'error' | 'info';

const DEFAULT_ANIMATION_PREVIEW_FPS = 6;
const MIN_ANIMATION_PREVIEW_FPS = 1;
const MAX_ANIMATION_PREVIEW_FPS = 24;

type UseEditorPreviewsOptions = {
  canvasSize: CanvasSize;
  pixels: Uint8ClampedArray;
  selection: Selection;
  isFloatingPasteActive: boolean;
  disabled?: boolean;
  setStatusText: (text: string, type: StatusType) => void;
};

export function useEditorPreviews({
  canvasSize,
  pixels,
  selection,
  isFloatingPasteActive,
  disabled = false,
  setStatusText
}: UseEditorPreviewsOptions) {
  const [lastTilePreviewSelection, setLastTilePreviewSelection] = useState<Selection>(null);
  const [tilePreviewLayers, setTilePreviewLayers] = useState<TilePreviewLayer[]>([]);
  const [tilePreviewFocusSequence, setTilePreviewFocusSequence] = useState<number>(0);
  const [selectionChangeSequence, setSelectionChangeSequence] = useState<number>(0);
  const [lastRegisteredTilePreviewSelectionSequence, setLastRegisteredTilePreviewSelectionSequence] = useState<number | null>(null);
  const [animationFrames, setAnimationFrames] = useState<AnimationFrame[]>([]);
  const [animationPreviewIndex, setAnimationPreviewIndex] = useState<number>(0);
  const [animationPreviewFps, setAnimationPreviewFpsRaw] = useState<number>(DEFAULT_ANIMATION_PREVIEW_FPS);
  const [isAnimationPreviewPlaying, setIsAnimationPreviewPlaying] = useState<boolean>(false);
  const [isAnimationPreviewLoop, setIsAnimationPreviewLoop] = useState<boolean>(true);

  const tilePreviewLayerIdRef = useRef<number>(1);
  const animationFrameIdRef = useRef<number>(1);

  useEffect(() => {
    setSelectionChangeSequence((prev) => prev + 1);
  }, [selection]);

  const previewDataUrl = useMemo(() => {
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = canvasSize.width;
    previewCanvas.height = canvasSize.height;
    const pctx = previewCanvas.getContext('2d');
    if (!pctx) {
      return '';
    }
    pctx.putImageData(new ImageData(pixels.slice(), canvasSize.width, canvasSize.height), 0, 0);
    return previewCanvas.toDataURL('image/png');
  }, [canvasSize, pixels]);

  const tilePreviewSelection = useMemo(
    () =>
      clampSelectionToCanvas(
        (isFloatingPasteActive ? lastTilePreviewSelection : selection) ?? lastTilePreviewSelection,
        canvasSize
      ),
    [canvasSize, isFloatingPasteActive, lastTilePreviewSelection, selection]
  );

  useEffect(() => {
    if (disabled) {
      return;
    }
    if (!selection || isFloatingPasteActive) {
      return;
    }
    setLastTilePreviewSelection(selection);
  }, [disabled, isFloatingPasteActive, selection]);

  const tilePreviewCandidateLayer = useMemo(() => {
    if (disabled) {
      return null;
    }
    if (!selection || isFloatingPasteActive) {
      return null;
    }
    const block = extractSelectionPixelBlock(pixels, canvasSize, selection);
    return {
      width: block.width,
      height: block.height,
      pixels: block.pixels
    };
  }, [canvasSize, disabled, isFloatingPasteActive, pixels, selection]);

  const tilePreviewRenderLayers = useMemo(
    () =>
      tilePreviewLayers.map((layer) => {
        const block = extractSelectionPixelBlock(pixels, canvasSize, {
          x: layer.x,
          y: layer.y,
          w: layer.width,
          h: layer.height
        });

        return {
          id: layer.id,
          x: layer.x,
          y: layer.y,
          width: layer.width,
          height: layer.height,
          pixels: block.pixels
        };
      }),
    [canvasSize, pixels, tilePreviewLayers]
  );

  const tilePreviewBaseSize = tilePreviewLayers[0]
    ? { width: tilePreviewLayers[0].width, height: tilePreviewLayers[0].height }
    : null;
  const hasTilePreviewCandidate =
    !disabled &&
    selection !== null &&
    !isFloatingPasteActive &&
    (tilePreviewLayers.length === 0 || selectionChangeSequence !== lastRegisteredTilePreviewSelectionSequence);

  const tilePreviewDataUrl = useMemo(() => {
    if (disabled) {
      return '';
    }
    if (tilePreviewRenderLayers.length > 0) {
      return createTilePreviewLayerDataUrl(
        tilePreviewRenderLayers,
        hasTilePreviewCandidate ? tilePreviewCandidateLayer : null
      );
    }
    if (!tilePreviewSelection) {
      return '';
    }
    return createRegionPreviewDataUrl(pixels, canvasSize, tilePreviewSelection, 3, 3);
  }, [
    canvasSize,
    disabled,
    hasTilePreviewCandidate,
    pixels,
    tilePreviewCandidateLayer,
    tilePreviewRenderLayers,
    tilePreviewSelection
  ]);

  const tilePreviewLayerSummaries = useMemo(
    () =>
      tilePreviewRenderLayers.map((layer) => ({
        id: layer.id,
        width: layer.width,
        height: layer.height,
        previewDataUrl: createTilePreviewLayerThumbnailDataUrl(
          layer,
          tilePreviewBaseSize?.width ?? layer.width,
          tilePreviewBaseSize?.height ?? layer.height
        )
      })),
    [tilePreviewBaseSize?.height, tilePreviewBaseSize?.width, tilePreviewRenderLayers]
  );

  const animationPreviewFrame = animationFrames[animationPreviewIndex] ?? null;
  const animationPreviewDataUrl = useMemo(() => {
    if (disabled || !animationPreviewFrame) {
      return '';
    }
    return createRegionPreviewDataUrl(pixels, canvasSize, animationPreviewFrame);
  }, [animationPreviewFrame, canvasSize, disabled, pixels]);

  useEffect(() => {
    if (!disabled || !isAnimationPreviewPlaying) {
      return;
    }
    setIsAnimationPreviewPlaying(false);
  }, [disabled, isAnimationPreviewPlaying]);

  const resetTilePreviewLayers = useCallback(() => {
    setTilePreviewLayers([]);
    setLastRegisteredTilePreviewSelectionSequence(null);
  }, []);

  const resetAnimationFrames = useCallback(() => {
    setAnimationFrames([]);
    setAnimationPreviewIndex(0);
    setIsAnimationPreviewPlaying(false);
  }, []);

  useEffect(() => {
    if (animationFrames.length === 0) {
      if (animationPreviewIndex !== 0) {
        setAnimationPreviewIndex(0);
      }
      if (isAnimationPreviewPlaying) {
        setIsAnimationPreviewPlaying(false);
      }
      return;
    }

    if (animationPreviewIndex >= animationFrames.length) {
      setAnimationPreviewIndex(animationFrames.length - 1);
    }
  }, [animationFrames.length, animationPreviewIndex, isAnimationPreviewPlaying]);

  useEffect(() => {
    if (!isAnimationPreviewPlaying || animationFrames.length <= 1) {
      return;
    }

    const delay = Math.max(80, Math.round(1000 / animationPreviewFps));
    const timer = window.setInterval(() => {
      setAnimationPreviewIndex((prev) => {
        if (prev + 1 < animationFrames.length) {
          return prev + 1;
        }
        return isAnimationPreviewLoop ? 0 : prev;
      });
    }, delay);

    return () => {
      window.clearInterval(timer);
    };
  }, [animationFrames.length, animationPreviewFps, isAnimationPreviewLoop, isAnimationPreviewPlaying]);

  useEffect(() => {
    if (!isAnimationPreviewPlaying || isAnimationPreviewLoop || animationFrames.length <= 1) {
      return;
    }
    if (animationPreviewIndex >= animationFrames.length - 1) {
      setIsAnimationPreviewPlaying(false);
    }
  }, [animationFrames.length, animationPreviewIndex, isAnimationPreviewLoop, isAnimationPreviewPlaying]);

  const addTilePreviewLayer = useCallback(() => {
    if (isFloatingPasteActive) {
      setStatusText('Tile Preview 追加の前に Enter で確定するか Esc でキャンセルしてください', 'warning');
      return;
    }
    if (!selection) {
      setStatusText('Tile Preview 追加: 先に矩形選択してください', 'warning');
      return;
    }

    const nextLayer: TilePreviewLayer = {
      id: `tpl-${tilePreviewLayerIdRef.current}`,
      x: selection.x,
      y: selection.y,
      width: selection.w,
      height: selection.h
    };
    tilePreviewLayerIdRef.current += 1;

    setTilePreviewLayers((prev) => [...prev, nextLayer]);
    setLastRegisteredTilePreviewSelectionSequence(selectionChangeSequence);
    setTilePreviewFocusSequence((prev) => prev + 1);
    setStatusText(
      tilePreviewLayers.length === 0
        ? `Tile Preview の基準重ねを追加しました: #1 (${selection.w}x${selection.h})`
        : `Tile Preview の重ねを追加しました: #${tilePreviewLayers.length + 1} (${selection.w}x${selection.h})`,
      'success'
    );
  }, [isFloatingPasteActive, selection, selectionChangeSequence, setStatusText, tilePreviewLayers.length]);

  const clearTilePreviewLayers = useCallback(() => {
    if (tilePreviewLayers.length === 0) {
      setStatusText('Tile Preview の重ねは空です', 'warning');
      return;
    }
    resetTilePreviewLayers();
    setStatusText('Tile Preview の重ねをすべてクリアしました', 'success');
  }, [resetTilePreviewLayers, setStatusText, tilePreviewLayers.length]);

  const removeTilePreviewLayer = useCallback(
    (layerId: string) => {
      const removeIndex = tilePreviewLayers.findIndex((layer) => layer.id === layerId);
      if (removeIndex < 0) {
        return;
      }

      const nextLength = tilePreviewLayers.length - 1;
      if (nextLength <= 0) {
        resetTilePreviewLayers();
      } else {
        setTilePreviewLayers((prev) => prev.filter((layer) => layer.id !== layerId));
      }
      setStatusText('Tile Preview の重ねを削除しました', 'success');
    },
    [resetTilePreviewLayers, setStatusText, tilePreviewLayers]
  );

  const reorderTilePreviewLayers = useCallback(
    (topFirstLayerIds: string[]) => {
      if (topFirstLayerIds.length !== tilePreviewLayers.length) {
        return;
      }

      const nextTopFirstLayers = topFirstLayerIds
        .map((layerId) => tilePreviewLayers.find((layer) => layer.id === layerId) ?? null)
        .filter((layer): layer is TilePreviewLayer => layer !== null);
      if (nextTopFirstLayers.length !== tilePreviewLayers.length) {
        return;
      }

      const nextInternalOrder = [...nextTopFirstLayers].reverse();
      const hasChanged = nextInternalOrder.some((layer, index) => layer.id !== tilePreviewLayers[index]?.id);
      if (!hasChanged) {
        return;
      }

      setTilePreviewLayers(nextInternalOrder);
      setStatusText('Tile Preview の重ね順を変更しました', 'success');
    },
    [setStatusText, tilePreviewLayers]
  );

  const addAnimationFrame = useCallback(() => {
    if (isFloatingPasteActive) {
      setStatusText('アニメーション追加の前に Enter で確定するか Esc でキャンセルしてください', 'warning');
      return;
    }
    if (!selection) {
      setStatusText('アニメーション追加: 先に矩形選択してください', 'warning');
      return;
    }

    const nextFrame: AnimationFrame = {
      id: `af-${animationFrameIdRef.current}`,
      x: selection.x,
      y: selection.y,
      w: selection.w,
      h: selection.h
    };
    animationFrameIdRef.current += 1;

    setAnimationFrames((prev) => [...prev, nextFrame]);
    setAnimationPreviewIndex(animationFrames.length);
    setStatusText(
      `アニメーションフレームを追加しました: #${animationFrames.length + 1} (${selection.w}x${selection.h})`,
      'success'
    );
  }, [animationFrames.length, isFloatingPasteActive, selection, setStatusText]);

  const clearAnimationFrames = useCallback(() => {
    if (animationFrames.length === 0) {
      setStatusText('アニメーションフレームは空です', 'warning');
      return;
    }
    resetAnimationFrames();
    setStatusText('アニメーションフレームをすべてクリアしました', 'success');
  }, [animationFrames.length, resetAnimationFrames, setStatusText]);

  const removeAnimationFrame = useCallback(
    (frameId: string) => {
      const removeIndex = animationFrames.findIndex((frame) => frame.id === frameId);
      if (removeIndex < 0) {
        return;
      }

      const nextLength = animationFrames.length - 1;
      setAnimationFrames((prev) => prev.filter((frame) => frame.id !== frameId));
      setAnimationPreviewIndex((current) => {
        if (nextLength <= 0) {
          return 0;
        }
        if (current > removeIndex) {
          return current - 1;
        }
        return Math.min(current, nextLength - 1);
      });
      if (nextLength < 2) {
        setIsAnimationPreviewPlaying(false);
      }
      setStatusText('アニメーションフレームを削除しました', 'success');
    },
    [animationFrames, setStatusText]
  );

  const moveAnimationFrame = useCallback(
    (frameId: string, direction: 'up' | 'down') => {
      const sourceIndex = animationFrames.findIndex((frame) => frame.id === frameId);
      if (sourceIndex < 0) {
        return;
      }

      const targetIndex = direction === 'up' ? sourceIndex - 1 : sourceIndex + 1;
      if (targetIndex < 0 || targetIndex >= animationFrames.length) {
        return;
      }

      setAnimationFrames((prev) => {
        const next = [...prev];
        const [movedFrame] = next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, movedFrame);
        return next;
      });
      setAnimationPreviewIndex((current) => {
        if (current === sourceIndex) {
          return targetIndex;
        }
        if (current === targetIndex) {
          return sourceIndex;
        }
        return current;
      });
      setStatusText('アニメーションフレームの順序を変更しました', 'success');
    },
    [animationFrames, setStatusText]
  );

  const selectAnimationFrame = useCallback((index: number) => {
    if (index < 0 || index >= animationFrames.length) {
      return;
    }
    setAnimationPreviewIndex(index);
  }, [animationFrames.length]);

  const toggleAnimationPreviewPlayback = useCallback(() => {
    if (animationFrames.length < 2) {
      setStatusText('アニメーション再生には 2 フレーム以上必要です', 'warning');
      return;
    }

    if (isAnimationPreviewPlaying) {
      setIsAnimationPreviewPlaying(false);
      setStatusText('アニメーション再生を停止しました', 'info');
      return;
    }

    if (!isAnimationPreviewLoop && animationPreviewIndex >= animationFrames.length - 1) {
      setAnimationPreviewIndex(0);
    }
    setIsAnimationPreviewPlaying(true);
    setStatusText('アニメーション再生を開始しました', 'info');
  }, [animationFrames.length, animationPreviewIndex, isAnimationPreviewLoop, isAnimationPreviewPlaying, setStatusText]);

  const updateAnimationPreviewFps = useCallback((value: number) => {
    const normalized = Number.isFinite(value) ? Math.trunc(value) : DEFAULT_ANIMATION_PREVIEW_FPS;
    setAnimationPreviewFpsRaw(Math.max(MIN_ANIMATION_PREVIEW_FPS, Math.min(MAX_ANIMATION_PREVIEW_FPS, normalized)));
  }, []);

  return {
    previewDataUrl,
    tilePreviewSelection,
    tilePreviewDataUrl,
    tilePreviewLayers,
    tilePreviewLayerSummaries,
    tilePreviewBaseSize,
    tilePreviewFocusSequence,
    hasTilePreviewCandidate,
    animationFrames,
    animationPreviewDataUrl,
    animationPreviewIndex,
    animationPreviewFps,
    isAnimationPreviewPlaying,
    isAnimationPreviewLoop,
    setAnimationPreviewLoop: setIsAnimationPreviewLoop as Dispatch<SetStateAction<boolean>>,
    setLastTilePreviewSelection,
    resetTilePreviewLayers,
    resetAnimationFrames,
    addTilePreviewLayer,
    clearTilePreviewLayers,
    removeTilePreviewLayer,
    reorderTilePreviewLayers,
    addAnimationFrame,
    clearAnimationFrames,
    removeAnimationFrame,
    moveAnimationFrame,
    selectAnimationFrame,
    toggleAnimationPreviewPlayback,
    updateAnimationPreviewFps
  };
}
