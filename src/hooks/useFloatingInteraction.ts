/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, type MouseEvent as ReactMouseEvent, type MutableRefObject } from 'react';
import type { FloatingPasteState } from '../editor/floating-paste';
import {
  clampFloatingRectToVisibleCanvasBounds,
  createResizedRectFromHandle,
  getResizeAnchorForHandle,
  resolveResizeHandleFromClientPoint,
  type FloatingResizeHandle,
  type FloatingResizeSession
} from '../editor/floating-interaction';
import type { CanvasSize, Selection, Tool } from '../editor/types';

type StatusType = 'success' | 'warning' | 'error' | 'info';

type DrawState = {
  active: boolean;
  selectionStart: { x: number; y: number } | null;
  selectionMoved: boolean;
  clearSelectionOnMouseUp: boolean;
  startedFromVisibleMargin: boolean;
  pendingMovePoint: { x: number; y: number } | null;
  pendingMoveOrigin: { x: number; y: number } | null;
  pendingLiftSelection: boolean;
  lastDrawCell: { x: number; y: number } | null;
  moveStartPoint: { x: number; y: number } | null;
  moveStartOrigin: { x: number; y: number } | null;
};

type UseFloatingInteractionOptions = {
  canvasSize: CanvasSize;
  zoom: number;
  selection: Selection;
  tool: Tool;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  canvasPointerRef: MutableRefObject<{ clientX: number; clientY: number } | null>;
  drawStateRef: MutableRefObject<DrawState>;
  floatingPasteRef: MutableRefObject<FloatingPasteState | null>;
  floatingResizeRef: MutableRefObject<FloatingResizeSession | null>;
  floatingInteractionStagePaddingCells: number;
  resolveCanvasPointFromClient: (clientX: number, clientY: number) => { x: number; y: number } | null;
  applyFloatingPasteBlock: (
    floating: FloatingPasteState,
    nextX: number,
    nextY: number,
    nextWidth: number,
    nextHeight: number,
    quality?: 'interactive' | 'final'
  ) => void;
  startFloatingInteractionPreview: () => void;
  setStatusText: (text: string, type: StatusType) => void;
};

export function useFloatingInteraction({
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
}: UseFloatingInteractionOptions) {
  const resolveFloatingResizeHandleFromClientPoint = useCallback(
    (clientX: number, clientY: number): FloatingResizeHandle | null => {
      if (!selection || !floatingPasteRef.current) {
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

  const beginFloatingMove = useCallback(
    (point: { x: number; y: number }, origin: { x: number; y: number }) => {
      drawStateRef.current.active = true;
      drawStateRef.current.selectionStart = null;
      drawStateRef.current.selectionMoved = false;
      drawStateRef.current.clearSelectionOnMouseUp = false;
      drawStateRef.current.startedFromVisibleMargin = false;
      drawStateRef.current.pendingMovePoint = null;
      drawStateRef.current.pendingMoveOrigin = null;
      drawStateRef.current.pendingLiftSelection = false;
      drawStateRef.current.lastDrawCell = null;
      drawStateRef.current.moveStartPoint = point;
      drawStateRef.current.moveStartOrigin = origin;
      floatingResizeRef.current = null;
      startFloatingInteractionPreview();
    },
    [drawStateRef, floatingResizeRef, startFloatingInteractionPreview]
  );

  const beginFloatingResize = useCallback(
    (handle: FloatingResizeHandle, selectionRect: Exclude<Selection, null>) => {
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
      floatingResizeRef.current = {
        handle,
        anchor: getResizeAnchorForHandle(handle, selectionRect),
        startRect: {
          x: selectionRect.x,
          y: selectionRect.y,
          width: selectionRect.w,
          height: selectionRect.h
        }
      };
      startFloatingInteractionPreview();
    },
    [drawStateRef, floatingResizeRef, startFloatingInteractionPreview]
  );

  const updateFloatingInteractionFromClient = useCallback(
    (
      clientX: number,
      clientY: number,
      options?: {
        maintainAspectRatio?: boolean;
      }
    ): boolean => {
      if (floatingResizeRef.current && floatingPasteRef.current) {
        const pointer = resolveCanvasPointFromClient(clientX, clientY);
        if (!pointer) {
          return false;
        }

        const floating = floatingPasteRef.current;
        const maintainAspectRatio = options?.maintainAspectRatio ?? false;
        const nextRect = createResizedRectFromHandle(
          floatingResizeRef.current.handle,
          floatingResizeRef.current.anchor,
          pointer.x,
          pointer.y,
          floating,
          floatingResizeRef.current.startRect,
          maintainAspectRatio,
          canvasSize,
          floatingInteractionStagePaddingCells
        );
        if (
          nextRect.x !== floating.x ||
          nextRect.y !== floating.y ||
          nextRect.width !== floating.width ||
          nextRect.height !== floating.height
        ) {
          applyFloatingPasteBlock(floating, nextRect.x, nextRect.y, nextRect.width, nextRect.height, 'interactive');
        }
        return true;
      }

      if (drawStateRef.current.moveStartPoint && drawStateRef.current.moveStartOrigin && floatingPasteRef.current) {
        const pointer = resolveCanvasPointFromClient(clientX, clientY);
        if (!pointer) {
          return false;
        }

        const floating = floatingPasteRef.current;
        const dx = pointer.x - drawStateRef.current.moveStartPoint.x;
        const dy = pointer.y - drawStateRef.current.moveStartPoint.y;
        const nextRect = clampFloatingRectToVisibleCanvasBounds(
          {
            x: Math.round(drawStateRef.current.moveStartOrigin.x + dx),
            y: Math.round(drawStateRef.current.moveStartOrigin.y + dy),
            width: floating.width,
            height: floating.height
          },
          canvasSize
        );

        if (nextRect.x !== floating.x || nextRect.y !== floating.y) {
          applyFloatingPasteBlock(floating, nextRect.x, nextRect.y, floating.width, floating.height, 'interactive');
        }
        return true;
      }

      return false;
    },
    [
      applyFloatingPasteBlock,
      canvasSize,
      drawStateRef,
      floatingPasteRef,
      floatingResizeRef,
      floatingInteractionStagePaddingCells,
      resolveCanvasPointFromClient
    ]
  );

  const onFloatingOverlayMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (tool !== 'select' || !selection || !floatingPasteRef.current) {
        return;
      }
      if (event.button !== 0) {
        return;
      }

      canvasPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
      event.preventDefault();
      event.stopPropagation();

      const handle = (event.target as HTMLElement | null)?.dataset.handle as FloatingResizeHandle | undefined;
      if (handle) {
        beginFloatingResize(handle, selection);
        setStatusText('選択範囲のサイズを変更中', 'info');
        return;
      }

      const pointer = resolveCanvasPointFromClient(event.clientX, event.clientY);
      if (!pointer) {
        return;
      }

      beginFloatingMove(pointer, { x: floatingPasteRef.current.x, y: floatingPasteRef.current.y });
      setStatusText('選択範囲を移動中', 'info');
    },
    [
      beginFloatingMove,
      beginFloatingResize,
      floatingPasteRef,
      canvasPointerRef,
      resolveCanvasPointFromClient,
      selection,
      setStatusText,
      tool
    ]
  );

  return {
    resolveFloatingResizeHandleFromClientPoint,
    beginFloatingMove,
    beginFloatingResize,
    updateFloatingInteractionFromClient,
    onFloatingOverlayMouseDown
  };
}
