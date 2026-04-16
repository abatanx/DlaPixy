/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent, type MutableRefObject } from 'react';
import type { DrawState } from '../editor/canvas-pointer';
import type { FloatingPasteState } from '../editor/floating-paste';
import {
  resolveResizeHandleFromClientPoint,
  type FloatingResizeHandle,
  type FloatingResizeSession
} from '../editor/floating-interaction';
import { isClientWithinCanvasMargin } from '../editor/slices';
import type { CanvasSize, Selection, Tool } from '../editor/types';
import { moveSelectionWithinCanvas, pointInSelection, resizeSelectionFromHandle } from '../editor/utils';
import { useFloatingInteraction } from './useFloatingInteraction';

type StatusType = 'success' | 'warning' | 'error' | 'info';
type SelectionRect = Exclude<Selection, null>;

type SelectionFrameMoveSession = {
  startPoint: { x: number; y: number };
  startSelection: SelectionRect;
  didPushUndo: boolean;
};

type SelectionFrameResizeSession = {
  handle: FloatingResizeHandle;
  startSelection: SelectionRect;
  didPushUndo: boolean;
};

type UseCanvasPointerInteractionsOptions = {
  canvasSize: CanvasSize;
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
  floatingInteractionStagePaddingCells: number;
  canvasStageVisibleMarginPx: number;
  beginPan: (clientX: number, clientY: number) => void;
  updatePan: (clientX: number, clientY: number) => void;
  endPan: () => void;
  resolveCanvasPointFromClient: (clientX: number, clientY: number) => { x: number; y: number } | null;
  resolveCanvasCellFromClient: (clientX: number, clientY: number) => { x: number; y: number } | null;
  resolveCanvasClampedCellFromClient: (clientX: number, clientY: number) => { x: number; y: number } | null;
  applyFloatingPasteBlock: (
    floating: FloatingPasteState,
    nextX: number,
    nextY: number,
    nextWidth: number,
    nextHeight: number,
    quality?: 'interactive' | 'final'
  ) => void;
  startFloatingInteractionPreview: () => void;
  completeFloatingInteractionPreview: () => void;
  liftSelectionToFloatingPaste: () => FloatingPasteState | null;
  applyStrokeSegment: (from: { x: number; y: number }, to: { x: number; y: number }, erase?: boolean) => void;
  createFloodFillResult: (source: Uint8ClampedArray, start: { x: number; y: number }) => Uint8ClampedArray | null;
  pushUndo: () => void;
  clearFloatingPaste: () => void;
  finalizeFloatingPasteAndClearSelection: () => boolean;
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
  floatingInteractionStagePaddingCells,
  canvasStageVisibleMarginPx,
  beginPan,
  updatePan,
  endPan,
  resolveCanvasPointFromClient,
  resolveCanvasCellFromClient,
  resolveCanvasClampedCellFromClient,
  applyFloatingPasteBlock,
  startFloatingInteractionPreview,
  completeFloatingInteractionPreview,
  liftSelectionToFloatingPaste,
  applyStrokeSegment,
  createFloodFillResult,
  pushUndo,
  clearFloatingPaste,
  finalizeFloatingPasteAndClearSelection,
  updateHoveredPixelInfo,
  clearHoveredPixelInfo,
  setPixels,
  setSelection,
  setHasUnsavedChanges,
  setStatusText
}: UseCanvasPointerInteractionsOptions) {
  const selectionFrameMoveRef = useRef<SelectionFrameMoveSession | null>(null);
  const selectionFrameResizeRef = useRef<SelectionFrameResizeSession | null>(null);

  const getResizeHandleCursor = useCallback((handle: FloatingResizeHandle): string => {
    switch (handle) {
      case 'tl':
      case 'br':
        return 'nwse-resize';
      case 'tc':
      case 'bc':
        return 'ns-resize';
      case 'tr':
      case 'bl':
        return 'nesw-resize';
      case 'ml':
      case 'mr':
        return 'ew-resize';
      default:
        return 'default';
    }
  }, []);

  const setCanvasCursor = useCallback(
    (cursor: string | null) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const nextCursor = cursor ?? '';
      if (canvas.style.cursor !== nextCursor) {
        canvas.style.cursor = nextCursor;
      }
    },
    [canvasRef]
  );

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

  const normalizeSquareSelection = useCallback(
    (sx: number, sy: number, ex: number, ey: number): Selection => {
      const deltaX = ex - sx;
      const deltaY = ey - sy;
      const directionX = deltaX === 0 ? 1 : Math.sign(deltaX);
      const directionY = deltaY === 0 ? (deltaX === 0 ? 1 : directionX) : Math.sign(deltaY);
      const desiredSpan = Math.max(Math.abs(deltaX), Math.abs(deltaY));
      const maxSpanX = directionX < 0 ? sx : canvasSize.width - 1 - sx;
      const maxSpanY = directionY < 0 ? sy : canvasSize.height - 1 - sy;
      const span = Math.min(desiredSpan, maxSpanX, maxSpanY);
      const clampedEx = sx + directionX * span;
      const clampedEy = sy + directionY * span;
      return normalizeSelection(sx, sy, clampedEx, clampedEy);
    },
    [canvasSize.height, canvasSize.width, normalizeSelection]
  );

  const resolveSingleTileSelection = useCallback(
    (cell: { x: number; y: number }): Selection => {
      const tileSize = gridSpacing > 0 ? gridSpacing : 1;
      const startX = Math.floor(cell.x / tileSize) * tileSize;
      const startY = Math.floor(cell.y / tileSize) * tileSize;
      const w = Math.min(tileSize, canvasSize.width - startX);
      const h = Math.min(tileSize, canvasSize.height - startY);
      return { x: startX, y: startY, w, h };
    },
    [canvasSize, gridSpacing]
  );

  const hasSameSelectionBounds = useCallback(
    (left: SelectionRect, right: SelectionRect) =>
      left.x === right.x &&
      left.y === right.y &&
      left.w === right.w &&
      left.h === right.h,
    []
  );

  const primeSelectionInteraction = useCallback(() => {
    drawStateRef.current.active = true;
    drawStateRef.current.selectionStart = null;
    drawStateRef.current.selectionMoved = false;
    drawStateRef.current.clearSelectionOnMouseUp = false;
    drawStateRef.current.startedFromVisibleMargin = false;
    drawStateRef.current.pendingMovePoint = null;
    drawStateRef.current.pendingMoveOrigin = null;
    drawStateRef.current.pendingLiftSelection = false;
    drawStateRef.current.lastDrawCell = null;
    drawStateRef.current.moveStartPoint = null;
    drawStateRef.current.moveStartOrigin = null;
    floatingResizeRef.current = null;
  }, [drawStateRef, floatingResizeRef]);

  const beginSelectionFrameMove = useCallback(
    (point: { x: number; y: number }, startSelection: SelectionRect) => {
      primeSelectionInteraction();
      selectionFrameMoveRef.current = {
        startPoint: point,
        startSelection: { ...startSelection },
        didPushUndo: false
      };
      selectionFrameResizeRef.current = null;
    },
    [primeSelectionInteraction]
  );

  const beginSelectionFrameResize = useCallback(
    (handle: FloatingResizeHandle, startSelection: SelectionRect) => {
      primeSelectionInteraction();
      selectionFrameMoveRef.current = null;
      selectionFrameResizeRef.current = {
        handle,
        startSelection: { ...startSelection },
        didPushUndo: false
      };
    },
    [primeSelectionInteraction]
  );

  const resolveStaticSelectionResizeHandleFromClientPoint = useCallback(
    (clientX: number, clientY: number): FloatingResizeHandle | null => {
      if (!selection || floatingPasteRef.current) {
        return null;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        return null;
      }

      return resolveResizeHandleFromClientPoint(selection, zoom, canvas, clientX, clientY);
    },
    [canvasRef, floatingPasteRef, selection, zoom]
  );

  const isStaticSelectionEdgeHitFromClientPoint = useCallback(
    (clientX: number, clientY: number): boolean => {
      if (!selection || floatingPasteRef.current) {
        return false;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        return false;
      }

      const rect = canvas.getBoundingClientRect();
      const localX = ((clientX - rect.left) / rect.width) * canvas.width;
      const localY = ((clientY - rect.top) / rect.height) * canvas.height;
      const edgeHitWidth = 8;
      const left = selection.x * zoom;
      const top = selection.y * zoom;
      const right = (selection.x + selection.w) * zoom;
      const bottom = (selection.y + selection.h) * zoom;
      const withinHorizontalSpan = localX >= left - edgeHitWidth && localX <= right + edgeHitWidth;
      const withinVerticalSpan = localY >= top - edgeHitWidth && localY <= bottom + edgeHitWidth;

      return (
        (withinHorizontalSpan && Math.abs(localY - top) <= edgeHitWidth) ||
        (withinHorizontalSpan && Math.abs(localY - bottom) <= edgeHitWidth) ||
        (withinVerticalSpan && Math.abs(localX - left) <= edgeHitWidth) ||
        (withinVerticalSpan && Math.abs(localX - right) <= edgeHitWidth)
      );
    },
    [canvasRef, floatingPasteRef, selection, zoom]
  );

  const updateSelectCanvasCursor = useCallback(
    (clientX: number, clientY: number) => {
      if (tool !== 'select' || isSpacePressed || isPanning || floatingPasteRef.current) {
        setCanvasCursor(null);
        return;
      }

      const activeResize = selectionFrameResizeRef.current;
      if (activeResize) {
        setCanvasCursor(getResizeHandleCursor(activeResize.handle));
        return;
      }

      if (selectionFrameMoveRef.current) {
        setCanvasCursor('grabbing');
        return;
      }

      const staticSelectionHandle = resolveStaticSelectionResizeHandleFromClientPoint(clientX, clientY);
      if (staticSelectionHandle) {
        setCanvasCursor(getResizeHandleCursor(staticSelectionHandle));
        return;
      }

      if (isStaticSelectionEdgeHitFromClientPoint(clientX, clientY)) {
        setCanvasCursor('grab');
        return;
      }

      setCanvasCursor(null);
    },
    [
      floatingPasteRef,
      getResizeHandleCursor,
      isPanning,
      isSpacePressed,
      isStaticSelectionEdgeHitFromClientPoint,
      resolveStaticSelectionResizeHandleFromClientPoint,
      setCanvasCursor,
      tool
    ]
  );

  const resetDrawState = useCallback(() => {
    drawStateRef.current.active = false;
    drawStateRef.current.selectionStart = null;
    drawStateRef.current.selectionMoved = false;
    drawStateRef.current.clearSelectionOnMouseUp = false;
    drawStateRef.current.startedFromVisibleMargin = false;
    drawStateRef.current.pendingMovePoint = null;
    drawStateRef.current.pendingMoveOrigin = null;
    drawStateRef.current.pendingLiftSelection = false;
    drawStateRef.current.lastDrawCell = null;
    drawStateRef.current.moveStartPoint = null;
    drawStateRef.current.moveStartOrigin = null;
    selectionFrameMoveRef.current = null;
    selectionFrameResizeRef.current = null;
    floatingResizeRef.current = null;
  }, [drawStateRef, floatingResizeRef]);

  const clearSelectionState = useCallback(() => {
    clearFloatingPaste();
    setSelection(null);
    setStatusText('選択を解除しました', 'success');
  }, [clearFloatingPaste, setSelection, setStatusText]);

  const startSelectionInteraction = useCallback(
    (
      cell: { x: number; y: number },
      {
        clearSelectionOnMouseUp,
        startedFromVisibleMargin
      }: { clearSelectionOnMouseUp: boolean; startedFromVisibleMargin: boolean }
    ) => {
      clearFloatingPaste();
      pushUndo();
      drawStateRef.current.active = true;
      drawStateRef.current.selectionStart = cell;
      drawStateRef.current.selectionMoved = false;
      drawStateRef.current.clearSelectionOnMouseUp = clearSelectionOnMouseUp;
      drawStateRef.current.startedFromVisibleMargin = startedFromVisibleMargin;
      drawStateRef.current.pendingMovePoint = null;
      drawStateRef.current.pendingMoveOrigin = null;
      drawStateRef.current.pendingLiftSelection = false;
      drawStateRef.current.lastDrawCell = null;
      drawStateRef.current.moveStartPoint = null;
      drawStateRef.current.moveStartOrigin = null;
      selectionFrameMoveRef.current = null;
      selectionFrameResizeRef.current = null;

      if (!clearSelectionOnMouseUp && !startedFromVisibleMargin && gridSpacing > 0) {
        setSelection({ x: cell.x, y: cell.y, w: 1, h: 1 });
      }
    },
    [clearFloatingPaste, drawStateRef, gridSpacing, pushUndo, setSelection]
  );

  const beginPendingFloatingMove = useCallback(
    (
      point: { x: number; y: number },
      origin: { x: number; y: number },
      {
        liftSelectionOnMove
      }: {
        liftSelectionOnMove: boolean;
      }
    ) => {
      drawStateRef.current.active = true;
      drawStateRef.current.selectionStart = null;
      drawStateRef.current.selectionMoved = false;
      drawStateRef.current.clearSelectionOnMouseUp = false;
      drawStateRef.current.startedFromVisibleMargin = false;
      drawStateRef.current.pendingMovePoint = point;
      drawStateRef.current.pendingMoveOrigin = origin;
      drawStateRef.current.pendingLiftSelection = liftSelectionOnMove;
      drawStateRef.current.lastDrawCell = null;
      drawStateRef.current.moveStartPoint = null;
      drawStateRef.current.moveStartOrigin = null;
      selectionFrameMoveRef.current = null;
      selectionFrameResizeRef.current = null;
      floatingResizeRef.current = null;
    },
    [drawStateRef, floatingResizeRef]
  );

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
    canvasPointerRef,
    drawStateRef,
    floatingPasteRef,
    floatingResizeRef,
    floatingInteractionStagePaddingCells,
    resolveCanvasPointFromClient,
    applyFloatingPasteBlock,
    startFloatingInteractionPreview,
    setStatusText
  });

  const beginSelectInteractionFromClient = useCallback(
    (clientX: number, clientY: number): boolean => {
      const cell = resolveCanvasClampedCellFromClient(clientX, clientY);
      if (!cell) {
        return false;
      }

      const pointer = resolveCanvasPointFromClient(clientX, clientY) ?? cell;
      if (floatingPasteRef.current && selection && pointInSelection(cell, selection)) {
        beginPendingFloatingMove(pointer, { x: floatingPasteRef.current.x, y: floatingPasteRef.current.y }, {
          liftSelectionOnMove: false
        });
        return true;
      }

      if (floatingPasteRef.current) {
        return finalizeFloatingPasteAndClearSelection();
      }

      if (selection && pointInSelection(cell, selection)) {
        beginPendingFloatingMove(pointer, { x: selection.x, y: selection.y }, {
          liftSelectionOnMove: true
        });
        return true;
      }

      startSelectionInteraction(cell, {
        clearSelectionOnMouseUp: selection !== null && !pointInSelection(cell, selection),
        startedFromVisibleMargin: false
      });
      return true;
    },
    [
      beginPendingFloatingMove,
      finalizeFloatingPasteAndClearSelection,
      floatingPasteRef,
      resolveCanvasClampedCellFromClient,
      resolveCanvasPointFromClient,
      selection,
      startSelectionInteraction
    ]
  );

  const beginSelectInteractionFromVisibleMargin = useCallback(
    (clientX: number, clientY: number): boolean => {
      const cell = resolveCanvasClampedCellFromClient(clientX, clientY);
      if (!cell) {
        return false;
      }

      if (floatingPasteRef.current) {
        return finalizeFloatingPasteAndClearSelection();
      }

      startSelectionInteraction(cell, {
        clearSelectionOnMouseUp: selection !== null,
        startedFromVisibleMargin: true
      });
      return true;
    },
    [
      finalizeFloatingPasteAndClearSelection,
      floatingPasteRef,
      resolveCanvasClampedCellFromClient,
      selection,
      startSelectionInteraction
    ]
  );

  const updateSelectInteractionFromClient = useCallback(
    (
      clientX: number,
      clientY: number,
      options?: {
        constrainSquare?: boolean;
      }
    ): boolean => {
      if (tool !== 'select') {
        return false;
      }
      if (!drawStateRef.current.active || drawStateRef.current.moveStartPoint !== null || floatingResizeRef.current) {
        return false;
      }

      const selectionFrameResizeSession = selectionFrameResizeRef.current;
      if (selectionFrameResizeSession) {
        const cell = resolveCanvasClampedCellFromClient(clientX, clientY);
        if (!cell) {
          return true;
        }

        const nextSelection = resizeSelectionFromHandle(
          selectionFrameResizeSession.startSelection,
          selectionFrameResizeSession.handle,
          cell,
          canvasSize
        );
        if (selection && hasSameSelectionBounds(nextSelection, selection)) {
          return true;
        }

        if (!selectionFrameResizeSession.didPushUndo) {
          pushUndo();
          selectionFrameResizeSession.didPushUndo = true;
        }
        setSelection(nextSelection);
        return true;
      }

      const selectionFrameMoveSession = selectionFrameMoveRef.current;
      if (selectionFrameMoveSession) {
        const pointer = resolveCanvasPointFromClient(clientX, clientY);
        if (!pointer) {
          return true;
        }

        const nextSelection = moveSelectionWithinCanvas(
          selectionFrameMoveSession.startSelection,
          Math.round(pointer.x - selectionFrameMoveSession.startPoint.x),
          Math.round(pointer.y - selectionFrameMoveSession.startPoint.y),
          canvasSize
        );
        if (selection && hasSameSelectionBounds(nextSelection, selection)) {
          return true;
        }

        if (!selectionFrameMoveSession.didPushUndo) {
          pushUndo();
          selectionFrameMoveSession.didPushUndo = true;
        }
        setSelection(nextSelection);
        return true;
      }

      const start = drawStateRef.current.selectionStart;
      const pendingMovePoint = drawStateRef.current.pendingMovePoint;
      const pendingMoveOrigin = drawStateRef.current.pendingMoveOrigin;
      if (pendingMovePoint && pendingMoveOrigin) {
        const pointer = resolveCanvasPointFromClient(clientX, clientY);
        if (!pointer) {
          return true;
        }

        const nextX = Math.round(pendingMoveOrigin.x + (pointer.x - pendingMovePoint.x));
        const nextY = Math.round(pendingMoveOrigin.y + (pointer.y - pendingMovePoint.y));
        if (nextX === pendingMoveOrigin.x && nextY === pendingMoveOrigin.y) {
          return true;
        }

        if (drawStateRef.current.pendingLiftSelection) {
          const floating = liftSelectionToFloatingPaste();
          if (!floating) {
            return true;
          }
        } else if (!floatingPasteRef.current) {
          return true;
        }

        beginFloatingMove(pendingMovePoint, pendingMoveOrigin);
        setStatusText('選択範囲を移動中', 'info');
        return updateFloatingInteractionFromClient(clientX, clientY);
      }
      if (!start) {
        return false;
      }

      const cell = resolveCanvasClampedCellFromClient(clientX, clientY);
      if (!cell) {
        return false;
      }

      if (cell.x !== start.x || cell.y !== start.y) {
        drawStateRef.current.selectionMoved = true;
        drawStateRef.current.clearSelectionOnMouseUp = false;
      }
      setSelection(
        (options?.constrainSquare ?? false)
          ? normalizeSquareSelection(start.x, start.y, cell.x, cell.y)
          : normalizeSelection(start.x, start.y, cell.x, cell.y)
      );
      return true;
    },
    [
      beginFloatingMove,
      canvasSize,
      drawStateRef,
      floatingPasteRef,
      floatingResizeRef,
      hasSameSelectionBounds,
      liftSelectionToFloatingPaste,
      moveSelectionWithinCanvas,
      normalizeSelection,
      normalizeSquareSelection,
      pushUndo,
      resolveCanvasClampedCellFromClient,
      resolveCanvasPointFromClient,
      resizeSelectionFromHandle,
      setSelection,
      setStatusText,
      tool,
      updateFloatingInteractionFromClient
    ]
  );

  const onMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      canvasPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
      if (isSpacePressed) {
        beginPan(event.clientX, event.clientY);
        return;
      }

      if (tool === 'slice') {
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

      const staticSelectionHandle =
        tool === 'select' && selection && !floatingPasteRef.current
          ? resolveStaticSelectionResizeHandleFromClientPoint(event.clientX, event.clientY)
          : null;
      if (staticSelectionHandle && selection) {
        beginSelectionFrameResize(staticSelectionHandle, selection);
        setStatusText('選択範囲を調整中', 'info');
        return;
      }

      const isStaticSelectionEdgeHit =
        tool === 'select' && selection && !floatingPasteRef.current
          ? isStaticSelectionEdgeHitFromClientPoint(event.clientX, event.clientY)
          : false;
      if (isStaticSelectionEdgeHit && selection) {
        const pointer = resolveCanvasPointFromClient(event.clientX, event.clientY);
        if (pointer) {
          beginSelectionFrameMove(pointer, selection);
          setStatusText('選択枠を移動中', 'info');
          return;
        }
      }

      if (tool === 'select' && beginSelectInteractionFromClient(event.clientX, event.clientY)) {
        return;
      }

      const cell = getCellFromEvent(event);
      if (!cell) {
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
      applyStrokeSegment(cell, cell, tool === 'eraser');
      drawStateRef.current.selectionMoved = false;
      drawStateRef.current.clearSelectionOnMouseUp = false;
      drawStateRef.current.startedFromVisibleMargin = false;
      drawStateRef.current.pendingMovePoint = null;
      drawStateRef.current.pendingMoveOrigin = null;
      drawStateRef.current.pendingLiftSelection = false;
      drawStateRef.current.lastDrawCell = cell;
      drawStateRef.current.moveStartPoint = null;
      drawStateRef.current.moveStartOrigin = null;
      selectionFrameMoveRef.current = null;
      selectionFrameResizeRef.current = null;
    },
    [
      applyStrokeSegment,
      beginSelectInteractionFromClient,
      beginFloatingResize,
      beginSelectionFrameMove,
      beginSelectionFrameResize,
      beginPan,
      canvasPointerRef,
      clearFloatingPaste,
      createFloodFillResult,
      drawStateRef,
      getCellFromEvent,
      isStaticSelectionEdgeHitFromClientPoint,
      isSpacePressed,
      pixels,
      pushUndo,
      resolveFloatingResizeHandleFromClientPoint,
      resolveCanvasPointFromClient,
      resolveStaticSelectionResizeHandleFromClientPoint,
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

      if (tool === 'select') {
        updateSelectCanvasCursor(event.clientX, event.clientY);
      } else {
        setCanvasCursor(null);
      }

      if (tool === 'slice') {
        return;
      }

      if (panStateRef.current.active) {
        updatePan(event.clientX, event.clientY);
        return;
      }

      if (!drawStateRef.current.active) {
        return;
      }

      if (updateFloatingInteractionFromClient(event.clientX, event.clientY, { maintainAspectRatio: event.shiftKey })) {
        return;
      }

      if (tool === 'select') {
        updateSelectInteractionFromClient(event.clientX, event.clientY, { constrainSquare: event.shiftKey });
        return;
      }

      const cell = hoveredCell;
      if (!cell) {
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
      panStateRef,
      resolveCanvasCellFromClient,
      setCanvasCursor,
      tool,
      updateSelectCanvasCursor,
      updateFloatingInteractionFromClient,
      updateHoveredPixelInfo,
      updatePan
    ]
  );

  const onMouseUp = useCallback(() => {
    if (tool === 'slice') {
      if (panStateRef.current.active) {
        endPan();
      }
      return;
    }

    if (panStateRef.current.active) {
      endPan();
      return;
    }

    const wasMovingPaste = drawStateRef.current.moveStartPoint !== null && floatingPasteRef.current !== null;
    const wasResizingPaste = floatingResizeRef.current !== null && floatingPasteRef.current !== null;
    const didMoveSelectionFrame = selectionFrameMoveRef.current?.didPushUndo ?? false;
    const didResizeSelectionFrame = selectionFrameResizeRef.current?.didPushUndo ?? false;
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
      !drawStateRef.current.startedFromVisibleMargin &&
      !wasResizingPaste;

    if (shouldClearSelection) {
      clearSelectionState();
    }
    if (shouldSelectSingleTile && selectStart) {
      if (gridSpacing > 0) {
        setSelection(resolveSingleTileSelection(selectStart));
        setStatusText('1タイルを選択しました', 'success');
      }
    }
    resetDrawState();
    if (wasMovingPaste || wasResizingPaste) {
      completeFloatingInteractionPreview();
    }
    if (wasMovingPaste && !shouldSelectSingleTile) {
      setStatusText('選択範囲を配置しました', 'success');
    }
    if (wasResizingPaste) {
      setStatusText('選択範囲のサイズを変更しました', 'success');
    }
    if (didMoveSelectionFrame) {
      setStatusText('選択枠を移動しました', 'success');
    }
    if (didResizeSelectionFrame) {
      setStatusText('選択範囲を調整しました', 'success');
    }

    const pointer = canvasPointerRef.current;
    if (pointer) {
      updateSelectCanvasCursor(pointer.clientX, pointer.clientY);
      return;
    }
    setCanvasCursor(null);
  }, [
    canvasPointerRef,
    drawStateRef,
    endPan,
    completeFloatingInteractionPreview,
    floatingPasteRef,
    floatingResizeRef,
    gridSpacing,
    panStateRef,
    resetDrawState,
    resolveSingleTileSelection,
    clearSelectionState,
    setCanvasCursor,
    setSelection,
    setStatusText,
    tool,
    updateSelectCanvasCursor
  ]);

  const onMouseLeaveCanvas = useCallback(() => {
    canvasPointerRef.current = null;
    const shouldKeepInteractionAlive = panStateRef.current.active || (tool === 'select' && drawStateRef.current.active);
    if (!shouldKeepInteractionAlive) {
      onMouseUp();
    }
    setCanvasCursor(null);
    clearHoveredPixelInfo();
  }, [canvasPointerRef, clearHoveredPixelInfo, drawStateRef, onMouseUp, panStateRef, setCanvasCursor, tool]);

  useEffect(() => {
    const onWindowMouseMove = (event: MouseEvent) => {
      canvasPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
      if (panStateRef.current.active) {
        updatePan(event.clientX, event.clientY);
        return;
      }
      if (!drawStateRef.current.active) {
        return;
      }
      if (updateFloatingInteractionFromClient(event.clientX, event.clientY, { maintainAspectRatio: event.shiftKey })) {
        return;
      }
      updateSelectInteractionFromClient(event.clientX, event.clientY, { constrainSquare: event.shiftKey });
    };

    const onWindowMouseUp = () => {
      if (!drawStateRef.current.active && !panStateRef.current.active) {
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
  }, [canvasPointerRef, drawStateRef, onMouseUp, panStateRef, updateFloatingInteractionFromClient, updatePan, updateSelectInteractionFromClient]);

  useEffect(() => {
    const syncShiftSensitiveDrag = (event: KeyboardEvent) => {
      if (event.key !== 'Shift') {
        return;
      }
      if (!drawStateRef.current.active || panStateRef.current.active) {
        return;
      }

      const pointer = canvasPointerRef.current;
      if (!pointer) {
        return;
      }

      if (updateFloatingInteractionFromClient(pointer.clientX, pointer.clientY, { maintainAspectRatio: event.shiftKey })) {
        return;
      }
      updateSelectInteractionFromClient(pointer.clientX, pointer.clientY, { constrainSquare: event.shiftKey });
    };

    window.addEventListener('keydown', syncShiftSensitiveDrag);
    window.addEventListener('keyup', syncShiftSensitiveDrag);
    return () => {
      window.removeEventListener('keydown', syncShiftSensitiveDrag);
      window.removeEventListener('keyup', syncShiftSensitiveDrag);
    };
  }, [canvasPointerRef, drawStateRef, panStateRef, updateFloatingInteractionFromClient, updateSelectInteractionFromClient]);

  const onCanvasStageMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      canvasPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
      if (isSpacePressed || isPanning) {
        return;
      }
      if (tool !== 'select') {
        return;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const isWithinVisibleMargin = isClientWithinCanvasMargin(
          rect,
          event.clientX,
          event.clientY,
          canvasStageVisibleMarginPx
        );
        if (isWithinVisibleMargin && beginSelectInteractionFromVisibleMargin(event.clientX, event.clientY)) {
          event.preventDefault();
          return;
        }
      }

      if (floatingPasteRef.current) {
        event.preventDefault();
        finalizeFloatingPasteAndClearSelection();
        return;
      }

      if (!selection) {
        return;
      }

      event.preventDefault();
      clearSelectionState();
    },
    [
      beginSelectInteractionFromVisibleMargin,
      canvasRef,
      canvasPointerRef,
      canvasStageVisibleMarginPx,
      clearSelectionState,
      finalizeFloatingPasteAndClearSelection,
      isPanning,
      isSpacePressed,
      floatingPasteRef,
      selection,
      tool
    ]
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
