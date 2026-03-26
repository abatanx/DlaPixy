/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, type MouseEvent as ReactMouseEvent, type MutableRefObject } from 'react';
import type { FloatingPasteState } from '../editor/floating-paste';
import {
  clampFloatingRectToVisibleCanvasBounds,
  createResizedRectFromHandle,
  FLOATING_HANDLE_RADIUS,
  getFloatingHandlePoints,
  getResizeAnchorForHandle,
  type FloatingResizeHandle,
  type FloatingResizeSession
} from '../editor/floating-interaction';
import type { Selection, Tool } from '../editor/types';

type StatusType = 'success' | 'warning' | 'error' | 'info';

type DrawState = {
  active: boolean;
  selectionStart: { x: number; y: number } | null;
  selectionMoved: boolean;
  clearSelectionOnMouseUp: boolean;
  lastDrawCell: { x: number; y: number } | null;
  moveStartPoint: { x: number; y: number } | null;
  moveStartOrigin: { x: number; y: number } | null;
};

type UseFloatingInteractionOptions = {
  canvasSize: number;
  zoom: number;
  selection: Selection;
  tool: Tool;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  drawStateRef: MutableRefObject<DrawState>;
  floatingPasteRef: MutableRefObject<FloatingPasteState | null>;
  floatingResizeRef: MutableRefObject<FloatingResizeSession | null>;
  floatingStagePaddingCells: number;
  resolveCanvasPointFromClient: (clientX: number, clientY: number) => { x: number; y: number } | null;
  applyFloatingPasteBlock: (
    floating: FloatingPasteState,
    nextX: number,
    nextY: number,
    nextWidth: number,
    nextHeight: number
  ) => void;
  setStatusText: (text: string, type: StatusType) => void;
};

export function useFloatingInteraction({
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

      const rect = canvas.getBoundingClientRect();
      const localX = ((clientX - rect.left) / rect.width) * canvas.width;
      const localY = ((clientY - rect.top) / rect.height) * canvas.height;

      let nearest: { handle: FloatingResizeHandle; distance: number } | null = null;
      for (const point of getFloatingHandlePoints(selection, zoom)) {
        const distance = Math.hypot(localX - point.x, localY - point.y);
        if (distance > FLOATING_HANDLE_RADIUS) {
          continue;
        }
        if (!nearest || distance < nearest.distance) {
          nearest = { handle: point.handle, distance };
        }
      }

      return nearest?.handle ?? null;
    },
    [canvasRef, floatingPasteRef, selection, zoom]
  );

  const beginFloatingMove = useCallback(
    (point: { x: number; y: number }, origin: { x: number; y: number }) => {
      drawStateRef.current.active = true;
      drawStateRef.current.selectionStart = null;
      drawStateRef.current.selectionMoved = false;
      drawStateRef.current.clearSelectionOnMouseUp = false;
      drawStateRef.current.lastDrawCell = null;
      drawStateRef.current.moveStartPoint = point;
      drawStateRef.current.moveStartOrigin = origin;
      floatingResizeRef.current = null;
    },
    [drawStateRef, floatingResizeRef]
  );

  const beginFloatingResize = useCallback(
    (handle: FloatingResizeHandle, selectionRect: Exclude<Selection, null>) => {
      drawStateRef.current.active = true;
      drawStateRef.current.selectionStart = null;
      drawStateRef.current.selectionMoved = false;
      drawStateRef.current.clearSelectionOnMouseUp = false;
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
    },
    [drawStateRef, floatingResizeRef]
  );

  const updateFloatingInteractionFromClient = useCallback(
    (clientX: number, clientY: number): boolean => {
      if (floatingResizeRef.current && floatingPasteRef.current) {
        const pointer = resolveCanvasPointFromClient(clientX, clientY);
        if (!pointer) {
          return false;
        }

        const floating = floatingPasteRef.current;
        const nextRect = createResizedRectFromHandle(
          floatingResizeRef.current.handle,
          floatingResizeRef.current.anchor,
          pointer.x,
          pointer.y,
          floating,
          floatingResizeRef.current.startRect,
          canvasSize,
          floatingStagePaddingCells
        );
        if (
          nextRect.x !== floating.x ||
          nextRect.y !== floating.y ||
          nextRect.width !== floating.width ||
          nextRect.height !== floating.height
        ) {
          applyFloatingPasteBlock(floating, nextRect.x, nextRect.y, nextRect.width, nextRect.height);
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
          applyFloatingPasteBlock(floating, nextRect.x, nextRect.y, floating.width, floating.height);
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
      floatingStagePaddingCells,
      resolveCanvasPointFromClient
    ]
  );

  const onFloatingOverlayMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (tool !== 'select' || !selection || !floatingPasteRef.current) {
        return;
      }

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
