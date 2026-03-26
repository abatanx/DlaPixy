/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useEffect, type MouseEvent as ReactMouseEvent, type MutableRefObject } from 'react';
import type { DrawState } from '../editor/canvas-pointer';
import type { FloatingPasteState } from '../editor/floating-paste';
import type { FloatingResizeSession } from '../editor/floating-interaction';
import type { Selection, Tool } from '../editor/types';
import { pointInSelection } from '../editor/utils';
import { useFloatingInteraction } from './useFloatingInteraction';

type StatusType = 'success' | 'warning' | 'error' | 'info';

type UseCanvasPointerInteractionsOptions = {
  canvasSize: number;
  gridSpacing: number;
  zoom: number;
  pixels: Uint8ClampedArray;
  selection: Selection;
  tool: Tool;
  isSpacePressed: boolean;
  isPanning: boolean;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  canvasPointerRef: MutableRefObject<{ clientX: number; clientY: number } | null>;
  panStateRef: MutableRefObject<{
    active: boolean;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
  }>;
  drawStateRef: MutableRefObject<DrawState>;
  floatingPasteRef: MutableRefObject<FloatingPasteState | null>;
  floatingResizeRef: MutableRefObject<FloatingResizeSession | null>;
  floatingStagePaddingCells: number;
  beginPan: (clientX: number, clientY: number) => void;
  updatePan: (clientX: number, clientY: number) => void;
  endPan: () => void;
  resolveCanvasPointFromClient: (clientX: number, clientY: number) => { x: number; y: number } | null;
  resolveCanvasCellFromClient: (clientX: number, clientY: number) => { x: number; y: number } | null;
  applyFloatingPasteBlock: (
    floating: FloatingPasteState,
    nextX: number,
    nextY: number,
    nextWidth: number,
    nextHeight: number
  ) => void;
  liftSelectionToFloatingPaste: () => FloatingPasteState | null;
  applyStrokeSegment: (from: { x: number; y: number }, to: { x: number; y: number }, erase?: boolean) => void;
  createFloodFillResult: (source: Uint8ClampedArray, start: { x: number; y: number }) => Uint8ClampedArray | null;
  pushUndo: () => void;
  clearFloatingPaste: () => void;
  updateHoveredPixelInfo: (cell: { x: number; y: number } | null) => void;
  clearHoveredPixelInfo: () => void;
  setPixels: (value: Uint8ClampedArray | ((prev: Uint8ClampedArray) => Uint8ClampedArray)) => void;
  setSelection: (value: Selection) => void;
  setHasUnsavedChanges: (value: boolean) => void;
  setStatusText: (text: string, type: StatusType) => void;
};

export function useCanvasPointerInteractions({
  canvasSize,
  gridSpacing,
  zoom,
  pixels,
  selection,
  tool,
  isSpacePressed,
  isPanning,
  canvasRef,
  canvasPointerRef,
  panStateRef,
  drawStateRef,
  floatingPasteRef,
  floatingResizeRef,
  floatingStagePaddingCells,
  beginPan,
  updatePan,
  endPan,
  resolveCanvasPointFromClient,
  resolveCanvasCellFromClient,
  applyFloatingPasteBlock,
  liftSelectionToFloatingPaste,
  applyStrokeSegment,
  createFloodFillResult,
  pushUndo,
  clearFloatingPaste,
  updateHoveredPixelInfo,
  clearHoveredPixelInfo,
  setPixels,
  setSelection,
  setHasUnsavedChanges,
  setStatusText
}: UseCanvasPointerInteractionsOptions) {
  const getCellFromEvent = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => resolveCanvasCellFromClient(event.clientX, event.clientY),
    [resolveCanvasCellFromClient]
  );

  const normalizeSelection = useCallback((sx: number, sy: number, ex: number, ey: number): Selection => {
    const x = Math.min(sx, ex);
    const y = Math.min(sy, ey);
    const w = Math.abs(ex - sx) + 1;
    const h = Math.abs(ey - sy) + 1;
    return { x, y, w, h };
  }, []);

  const resolveSingleTileSelection = useCallback(
    (cell: { x: number; y: number }): Selection => {
      const tileSize = gridSpacing > 0 ? gridSpacing : 1;
      const startX = Math.floor(cell.x / tileSize) * tileSize;
      const startY = Math.floor(cell.y / tileSize) * tileSize;
      const w = Math.min(tileSize, canvasSize - startX);
      const h = Math.min(tileSize, canvasSize - startY);
      return { x: startX, y: startY, w, h };
    },
    [canvasSize, gridSpacing]
  );

  const resetDrawState = useCallback(() => {
    drawStateRef.current.active = false;
    drawStateRef.current.selectionStart = null;
    drawStateRef.current.selectionMoved = false;
    drawStateRef.current.clearSelectionOnMouseUp = false;
    drawStateRef.current.lastDrawCell = null;
    drawStateRef.current.moveStartPoint = null;
    drawStateRef.current.moveStartOrigin = null;
    floatingResizeRef.current = null;
  }, [drawStateRef, floatingResizeRef]);

  const {
    resolveFloatingResizeHandleFromClientPoint,
    beginFloatingMove,
    beginFloatingResize,
    updateFloatingInteractionFromClient,
    onFloatingOverlayMouseDown
  } = useFloatingInteraction({
    canvasSize,
    zoom,
    selection,
    tool,
    canvasRef,
    drawStateRef,
    floatingPasteRef,
    floatingResizeRef,
    floatingStagePaddingCells,
    resolveCanvasPointFromClient,
    applyFloatingPasteBlock,
    setStatusText
  });

  const onMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      if (isSpacePressed) {
        beginPan(event.clientX, event.clientY);
        return;
      }

      const floatingHandle =
        tool === 'select' && floatingPasteRef.current && selection
          ? resolveFloatingResizeHandleFromClientPoint(event.clientX, event.clientY)
          : null;
      if (floatingHandle && selection) {
        beginFloatingResize(floatingHandle, selection);
        setStatusText('選択範囲のサイズを変更中', 'info');
        return;
      }

      const cell = getCellFromEvent(event);
      if (!cell) {
        return;
      }
      const pointer = resolveCanvasPointFromClient(event.clientX, event.clientY) ?? cell;

      if (tool === 'select' && floatingPasteRef.current && pointInSelection(cell, selection)) {
        beginFloatingMove(pointer, { x: floatingPasteRef.current.x, y: floatingPasteRef.current.y });
        setStatusText('選択範囲を移動中', 'info');
        return;
      }

      if (tool === 'select' && selection && pointInSelection(cell, selection)) {
        const floating = liftSelectionToFloatingPaste();
        if (floating) {
          beginFloatingMove(pointer, { x: floating.x, y: floating.y });
          setStatusText('選択範囲を移動中', 'info');
        }
        return;
      }

      if (tool === 'fill') {
        const filled = createFloodFillResult(pixels, cell);
        if (filled) {
          pushUndo();
          setPixels(filled);
          setHasUnsavedChanges(true);
        }
        clearFloatingPaste();
        resetDrawState();
        setStatusText(filled ? '塗りつぶしました' : '塗りつぶし対象がありません', filled ? 'success' : 'warning');
        return;
      }

      clearFloatingPaste();
      pushUndo();
      drawStateRef.current.active = true;

      if (tool === 'select') {
        const shouldClearOnClick =
          selection !== null && !pointInSelection(cell, selection) && !floatingPasteRef.current;
        drawStateRef.current.selectionStart = cell;
        drawStateRef.current.selectionMoved = false;
        drawStateRef.current.clearSelectionOnMouseUp = shouldClearOnClick;
        drawStateRef.current.lastDrawCell = null;
        drawStateRef.current.moveStartPoint = null;
        drawStateRef.current.moveStartOrigin = null;
        if (!shouldClearOnClick && gridSpacing > 0) {
          setSelection({ x: cell.x, y: cell.y, w: 1, h: 1 });
        }
      } else {
        applyStrokeSegment(cell, cell, tool === 'eraser');
        drawStateRef.current.selectionMoved = false;
        drawStateRef.current.clearSelectionOnMouseUp = false;
        drawStateRef.current.lastDrawCell = cell;
        drawStateRef.current.moveStartPoint = null;
        drawStateRef.current.moveStartOrigin = null;
      }
    },
    [
      applyStrokeSegment,
      beginFloatingMove,
      beginFloatingResize,
      beginPan,
      clearFloatingPaste,
      createFloodFillResult,
      drawStateRef,
      getCellFromEvent,
      gridSpacing,
      isSpacePressed,
      liftSelectionToFloatingPaste,
      pixels,
      pushUndo,
      resolveCanvasPointFromClient,
      resolveFloatingResizeHandleFromClientPoint,
      resetDrawState,
      selection,
      setHasUnsavedChanges,
      setPixels,
      setSelection,
      setStatusText,
      tool
    ]
  );

  const onMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      canvasPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
      const hoveredCell = resolveCanvasCellFromClient(event.clientX, event.clientY);
      updateHoveredPixelInfo(hoveredCell);

      if (panStateRef.current.active) {
        updatePan(event.clientX, event.clientY);
        return;
      }

      if (!drawStateRef.current.active) {
        return;
      }

      if (updateFloatingInteractionFromClient(event.clientX, event.clientY)) {
        return;
      }

      const cell = hoveredCell;
      if (!cell) {
        return;
      }

      if (tool === 'select') {
        const start = drawStateRef.current.selectionStart;
        if (!start) {
          return;
        }
        if (cell.x !== start.x || cell.y !== start.y) {
          drawStateRef.current.selectionMoved = true;
          drawStateRef.current.clearSelectionOnMouseUp = false;
        }
        setSelection(normalizeSelection(start.x, start.y, cell.x, cell.y));
        return;
      }

      const lastCell = drawStateRef.current.lastDrawCell ?? cell;
      applyStrokeSegment(lastCell, cell, tool === 'eraser');
      drawStateRef.current.lastDrawCell = cell;
    },
    [
      applyStrokeSegment,
      canvasPointerRef,
      drawStateRef,
      normalizeSelection,
      panStateRef,
      resolveCanvasCellFromClient,
      setSelection,
      tool,
      updateFloatingInteractionFromClient,
      updateHoveredPixelInfo,
      updatePan
    ]
  );

  const onMouseUp = useCallback(() => {
    if (panStateRef.current.active) {
      endPan();
      return;
    }

    const wasMovingPaste = drawStateRef.current.moveStartPoint !== null && floatingPasteRef.current !== null;
    const wasResizingPaste = floatingResizeRef.current !== null && floatingPasteRef.current !== null;
    const selectStart = drawStateRef.current.selectionStart;
    const shouldClearSelection =
      tool === 'select' &&
      drawStateRef.current.clearSelectionOnMouseUp &&
      selectStart !== null &&
      !drawStateRef.current.selectionMoved;
    const shouldSelectSingleTile =
      tool === 'select' &&
      selectStart !== null &&
      !drawStateRef.current.selectionMoved &&
      !drawStateRef.current.clearSelectionOnMouseUp &&
      !wasResizingPaste;

    if (shouldClearSelection) {
      setSelection(null);
      setStatusText('選択を解除しました', 'success');
    }
    if (shouldSelectSingleTile && selectStart) {
      if (gridSpacing > 0) {
        setSelection(resolveSingleTileSelection(selectStart));
        setStatusText('1タイルを選択しました', 'success');
      } else {
        setStatusText('グリッド線が「なし」のため、シングルクリック選択はできません', 'warning');
      }
    }
    resetDrawState();
    if (wasMovingPaste && !shouldSelectSingleTile) {
      setStatusText('選択範囲を配置しました', 'success');
    }
    if (wasResizingPaste) {
      setStatusText('選択範囲のサイズを変更しました', 'success');
    }
  }, [
    drawStateRef,
    endPan,
    floatingPasteRef,
    floatingResizeRef,
    gridSpacing,
    panStateRef,
    resetDrawState,
    resolveSingleTileSelection,
    setSelection,
    setStatusText,
    tool
  ]);

  const onMouseLeaveCanvas = useCallback(() => {
    canvasPointerRef.current = null;
    const hasFloatingInteractionActive =
      floatingPasteRef.current !== null &&
      (drawStateRef.current.moveStartPoint !== null || floatingResizeRef.current !== null);
    if (!hasFloatingInteractionActive && !panStateRef.current.active) {
      onMouseUp();
    }
    clearHoveredPixelInfo();
  }, [canvasPointerRef, clearHoveredPixelInfo, drawStateRef, floatingPasteRef, floatingResizeRef, onMouseUp, panStateRef]);

  useEffect(() => {
    const onWindowMouseMove = (event: MouseEvent) => {
      if (!drawStateRef.current.active) {
        return;
      }
      updateFloatingInteractionFromClient(event.clientX, event.clientY);
    };

    const onWindowMouseUp = () => {
      const hasFloatingInteractionActive =
        floatingPasteRef.current !== null &&
        (drawStateRef.current.moveStartPoint !== null || floatingResizeRef.current !== null);
      if (!hasFloatingInteractionActive) {
        return;
      }
      onMouseUp();
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [drawStateRef, floatingPasteRef, floatingResizeRef, onMouseUp, updateFloatingInteractionFromClient]);

  const onCanvasStageMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      if (isSpacePressed || isPanning) {
        return;
      }
      if (tool !== 'select' || !selection || floatingPasteRef.current) {
        return;
      }

      event.preventDefault();
      setSelection(null);
      setStatusText('選択を解除しました', 'success');
    },
    [floatingPasteRef, isPanning, isSpacePressed, selection, setSelection, setStatusText, tool]
  );

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeaveCanvas,
    onCanvasStageMouseDown,
    onFloatingOverlayMouseDown
  };
}
