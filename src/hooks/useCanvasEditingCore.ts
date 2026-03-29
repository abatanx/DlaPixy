/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useEffect, useMemo, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Selection } from '../editor/types';
import { clonePixels, hexToRgba, pointInSelection, rasterLinePoints } from '../editor/utils';

type UseCanvasEditingCoreOptions = {
  canvasSize: number;
  gridSpacing: number;
  zoom: number;
  pixels: Uint8ClampedArray;
  selectedColor: string;
  selection: Selection;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  setPixels: Dispatch<SetStateAction<Uint8ClampedArray>>;
  setHasUnsavedChanges: Dispatch<SetStateAction<boolean>>;
};

type CanvasRenderBuffer = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  imageData: ImageData;
  size: number;
};

export function useCanvasEditingCore({
  canvasSize,
  gridSpacing,
  zoom,
  pixels,
  selectedColor,
  selection,
  canvasRef,
  setPixels,
  setHasUnsavedChanges
}: UseCanvasEditingCoreOptions) {
  const renderBufferRef = useRef<CanvasRenderBuffer | null>(null);

  const drawCanvas = useCallback(
    (sourcePixels: Uint8ClampedArray) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      let renderBuffer = renderBufferRef.current;
      if (!renderBuffer || renderBuffer.size !== canvasSize) {
        const bufferCanvas = document.createElement('canvas');
        bufferCanvas.width = canvasSize;
        bufferCanvas.height = canvasSize;
        const bufferCtx = bufferCanvas.getContext('2d');
        if (!bufferCtx) {
          return;
        }
        renderBuffer = {
          canvas: bufferCanvas,
          ctx: bufferCtx,
          imageData: new ImageData(canvasSize, canvasSize),
          size: canvasSize
        };
        renderBufferRef.current = renderBuffer;
      }

      renderBuffer.imageData.data.set(sourcePixels);
      renderBuffer.ctx.putImageData(renderBuffer.imageData, 0, 0);

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(renderBuffer.canvas, 0, 0, canvas.width, canvas.height);

      // Grid is a visual overlay only (not a paint constraint).
      if (gridSpacing > 0) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= canvasSize; i += gridSpacing) {
          const p = i * zoom + 0.5;
          ctx.beginPath();
          ctx.moveTo(p, 0);
          ctx.lineTo(p, canvas.height);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(0, p);
          ctx.lineTo(canvas.width, p);
          ctx.stroke();
        }
      }
    },
    [canvasRef, canvasSize, gridSpacing, zoom]
  );

  useEffect(() => {
    drawCanvas(pixels);
  }, [drawCanvas, pixels]);

  const colorBytes = useMemo(() => hexToRgba(selectedColor), [selectedColor]);

  const resolveCanvasPointFromClient = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return null;
      }

      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return null;
      }
      const x = (((clientX - rect.left) / rect.width) * canvas.width) / zoom;
      const y = (((clientY - rect.top) / rect.height) * canvas.height) / zoom;
      return { x, y };
    },
    [canvasRef, zoom]
  );

  const resolveCanvasCellFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const point = resolveCanvasPointFromClient(clientX, clientY);
      if (!point) {
        return null;
      }

      const x = Math.floor(point.x);
      const y = Math.floor(point.y);
      if (x < 0 || y < 0 || x >= canvasSize || y >= canvasSize) {
        return null;
      }
      return { x, y };
    },
    [canvasSize, resolveCanvasPointFromClient]
  );

  const applyStrokeSegment = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }, erase = false) => {
      // Interpolate pointer movement so fast drags don't leave gaps.
      const points = rasterLinePoints(from.x, from.y, to.x, to.y);
      let changedInStroke = false;
      setPixels((prev) => {
        const next = clonePixels(prev);
        let changed = false;
        for (const point of points) {
          // When selection is active, draw/erase must stay inside selection bounds.
          if (selection && !pointInSelection(point, selection)) {
            continue;
          }
          const idx = (point.y * canvasSize + point.x) * 4;
          if (erase) {
            if (next[idx + 3] === 0) {
              continue;
            }
            next[idx] = 0;
            next[idx + 1] = 0;
            next[idx + 2] = 0;
            next[idx + 3] = 0;
            changed = true;
            continue;
          }
          if (
            next[idx] === colorBytes.r &&
            next[idx + 1] === colorBytes.g &&
            next[idx + 2] === colorBytes.b &&
            next[idx + 3] === colorBytes.a
          ) {
            continue;
          }
          next[idx] = colorBytes.r;
          next[idx + 1] = colorBytes.g;
          next[idx + 2] = colorBytes.b;
          next[idx + 3] = colorBytes.a;
          changed = true;
        }
        // Preserve previous reference when no change happened to avoid extra renders.
        changedInStroke = changed;
        return changed ? next : prev;
      });
      if (changedInStroke) {
        setHasUnsavedChanges(true);
      }
    },
    [canvasSize, colorBytes, selection, setHasUnsavedChanges, setPixels]
  );

  const createFloodFillResult = useCallback(
    (source: Uint8ClampedArray, start: { x: number; y: number }): Uint8ClampedArray | null => {
      // Selection-aware fill: ignore clicks that start outside current selection.
      if (selection && !pointInSelection(start, selection)) {
        return null;
      }
      const next = clonePixels(source);
      const startIdx = (start.y * canvasSize + start.x) * 4;
      const target = [
        source[startIdx],
        source[startIdx + 1],
        source[startIdx + 2],
        source[startIdx + 3]
      ] as const;
      const replacement = [colorBytes.r, colorBytes.g, colorBytes.b, colorBytes.a] as const;

      if (
        target[0] === replacement[0] &&
        target[1] === replacement[1] &&
        target[2] === replacement[2] &&
        target[3] === replacement[3]
      ) {
        return null;
      }

      let changed = false;
      // Iterative DFS stack (avoids recursive call depth issues on large fills).
      const stack: Array<{ x: number; y: number }> = [{ x: start.x, y: start.y }];
      while (stack.length > 0) {
        const node = stack.pop();
        if (!node) {
          continue;
        }
        if (selection && !pointInSelection(node, selection)) {
          continue;
        }
        const idx = (node.y * canvasSize + node.x) * 4;
        if (
          next[idx] !== target[0] ||
          next[idx + 1] !== target[1] ||
          next[idx + 2] !== target[2] ||
          next[idx + 3] !== target[3]
        ) {
          continue;
        }

        next[idx] = replacement[0];
        next[idx + 1] = replacement[1];
        next[idx + 2] = replacement[2];
        next[idx + 3] = replacement[3];
        changed = true;

        // Only enqueue neighbors that are still inside selection (if active).
        if (node.x > 0 && (!selection || pointInSelection({ x: node.x - 1, y: node.y }, selection))) {
          stack.push({ x: node.x - 1, y: node.y });
        }
        if (
          node.x + 1 < canvasSize &&
          (!selection || pointInSelection({ x: node.x + 1, y: node.y }, selection))
        ) {
          stack.push({ x: node.x + 1, y: node.y });
        }
        if (node.y > 0 && (!selection || pointInSelection({ x: node.x, y: node.y - 1 }, selection))) {
          stack.push({ x: node.x, y: node.y - 1 });
        }
        if (
          node.y + 1 < canvasSize &&
          (!selection || pointInSelection({ x: node.x, y: node.y + 1 }, selection))
        ) {
          stack.push({ x: node.x, y: node.y + 1 });
        }
      }

      return changed ? next : null;
    },
    [canvasSize, colorBytes, selection]
  );

  return {
    resolveCanvasPointFromClient,
    resolveCanvasCellFromClient,
    applyStrokeSegment,
    createFloodFillResult
  };
}
