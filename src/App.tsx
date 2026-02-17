import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Tool = 'pencil' | 'eraser' | 'fill' | 'select';
type Selection = { x: number; y: number; w: number; h: number } | null;

type EditorMeta = {
  version: number;
  canvasSize?: number;
  gridSpacing?: number;
  // legacy: older saves used `grid` for canvas size
  grid?: number;
  palette: string[];
  lastTool: Tool;
};

const GRID_SPACING_OPTIONS = [8, 16, 32] as const;
const DEFAULT_GRID_SPACING = 16;
const DEFAULT_CANVAS_SIZE = 256;
const DEFAULT_ZOOM = 3;
const MIN_ZOOM = 1;
const MAX_ZOOM = 12;
const MAX_UNDO = 40;
const MIN_CANVAS_SIZE = 8;
const MAX_CANVAS_SIZE = 1024;

const DEFAULT_PALETTE = ['#000000', '#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#0ea5e9'];

function rgbaToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function clampCanvasSize(size: number): number {
  return Math.max(MIN_CANVAS_SIZE, Math.min(MAX_CANVAS_SIZE, size));
}

function createEmptyPixels(canvasSize: number): Uint8ClampedArray {
  return new Uint8ClampedArray(canvasSize * canvasSize * 4);
}

function clonePixels(pixels: Uint8ClampedArray): Uint8ClampedArray {
  return new Uint8ClampedArray(pixels);
}

function rasterLinePoints(x0: number, y0: number, x1: number, y1: number): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  let cx = x0;
  let cy = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push({ x: cx, y: cy });
    if (cx === x1 && cy === y1) {
      break;
    }
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }

  return points;
}

function pointInSelection(point: { x: number; y: number }, selection: Selection): boolean {
  if (!selection) {
    return false;
  }
  return (
    point.x >= selection.x &&
    point.y >= selection.y &&
    point.x < selection.x + selection.w &&
    point.y < selection.y + selection.h
  );
}

function clampSelectionToCanvas(selection: Selection, canvasSize: number): Selection {
  if (!selection) {
    return null;
  }
  if (selection.x >= canvasSize || selection.y >= canvasSize) {
    return null;
  }

  const w = Math.min(selection.w, canvasSize - selection.x);
  const h = Math.min(selection.h, canvasSize - selection.y);
  if (w <= 0 || h <= 0) {
    return null;
  }

  return { x: selection.x, y: selection.y, w, h };
}

function cloneSelection(selection: Selection): Selection {
  if (!selection) {
    return null;
  }
  return { x: selection.x, y: selection.y, w: selection.w, h: selection.h };
}

function blitBlockOnCanvas(
  basePixels: Uint8ClampedArray,
  canvasSize: number,
  blockPixels: Uint8ClampedArray,
  blockWidth: number,
  blockHeight: number,
  destX: number,
  destY: number
): Uint8ClampedArray {
  const next = clonePixels(basePixels);
  for (let y = 0; y < blockHeight; y += 1) {
    for (let x = 0; x < blockWidth; x += 1) {
      const srcIdx = (y * blockWidth + x) * 4;
      const dstIdx = ((destY + y) * canvasSize + (destX + x)) * 4;
      next[dstIdx] = blockPixels[srcIdx];
      next[dstIdx + 1] = blockPixels[srcIdx + 1];
      next[dstIdx + 2] = blockPixels[srcIdx + 2];
      next[dstIdx + 3] = blockPixels[srcIdx + 3];
    }
  }
  return next;
}

export function App() {
  const [canvasSize, setCanvasSize] = useState<number>(DEFAULT_CANVAS_SIZE);
  const [pendingCanvasSize, setPendingCanvasSize] = useState<string>(String(DEFAULT_CANVAS_SIZE));
  const [gridSpacing, setGridSpacing] = useState<number>(DEFAULT_GRID_SPACING);
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
  const [pixels, setPixels] = useState<Uint8ClampedArray>(() => createEmptyPixels(DEFAULT_CANVAS_SIZE));
  const [palette, setPalette] = useState<string[]>(DEFAULT_PALETTE);
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_PALETTE[0]);
  const [tool, setTool] = useState<Tool>('pencil');
  const [selection, setSelection] = useState<Selection>(null);
  const [lastTilePreviewSelection, setLastTilePreviewSelection] = useState<Selection>(null);
  const [statusText, setStatusText] = useState<string>('準備OK');
  const [currentFilePath, setCurrentFilePath] = useState<string | undefined>(undefined);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isPanning, setIsPanning] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasStageRef = useRef<HTMLDivElement | null>(null);
  const drawStateRef = useRef<{
    active: boolean;
    selectionStart: { x: number; y: number } | null;
    selectionMoved: boolean;
    clearSelectionOnMouseUp: boolean;
    lastDrawCell: { x: number; y: number } | null;
    moveStartCell: { x: number; y: number } | null;
    moveStartOrigin: { x: number; y: number } | null;
  }>({
    active: false,
    selectionStart: null,
    selectionMoved: false,
    clearSelectionOnMouseUp: false,
    lastDrawCell: null,
    moveStartCell: null,
    moveStartOrigin: null
  });
  const panStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    startScrollTop: 0
  });
  const selectionClipboardRef = useRef<{
    width: number;
    height: number;
    pixels: Uint8ClampedArray;
    sourceX: number;
    sourceY: number;
  } | null>(null);
  const floatingPasteRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
    pixels: Uint8ClampedArray;
    basePixels: Uint8ClampedArray;
    restorePixels: Uint8ClampedArray;
    restoreSelection: Selection;
    restoreTool: Tool;
  } | null>(null);
  const undoStackRef = useRef<Uint8ClampedArray[]>([]);

  const displaySize = useMemo(() => canvasSize * zoom, [canvasSize, zoom]);
  const previewDataUrl = useMemo(() => {
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = canvasSize;
    previewCanvas.height = canvasSize;
    const pctx = previewCanvas.getContext('2d');
    if (!pctx) {
      return '';
    }
    pctx.putImageData(new ImageData(pixels.slice(), canvasSize, canvasSize), 0, 0);
    return previewCanvas.toDataURL('image/png');
  }, [canvasSize, pixels]);
  const tilePreviewSelection = useMemo(
    () => clampSelectionToCanvas(selection ?? lastTilePreviewSelection, canvasSize),
    [canvasSize, lastTilePreviewSelection, selection]
  );

  useEffect(() => {
    if (!selection) {
      return;
    }
    setLastTilePreviewSelection(selection);
  }, [selection]);

  const selectionTilePreviewDataUrl = useMemo(() => {
    if (!tilePreviewSelection) {
      return '';
    }

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = tilePreviewSelection.w;
    sourceCanvas.height = tilePreviewSelection.h;
    const sctx = sourceCanvas.getContext('2d');
    if (!sctx) {
      return '';
    }

    const sourceImageData = sctx.createImageData(tilePreviewSelection.w, tilePreviewSelection.h);
    for (let y = 0; y < tilePreviewSelection.h; y += 1) {
      for (let x = 0; x < tilePreviewSelection.w; x += 1) {
        const srcIdx = ((tilePreviewSelection.y + y) * canvasSize + (tilePreviewSelection.x + x)) * 4;
        const dstIdx = (y * tilePreviewSelection.w + x) * 4;
        sourceImageData.data[dstIdx] = pixels[srcIdx];
        sourceImageData.data[dstIdx + 1] = pixels[srcIdx + 1];
        sourceImageData.data[dstIdx + 2] = pixels[srcIdx + 2];
        sourceImageData.data[dstIdx + 3] = pixels[srcIdx + 3];
      }
    }
    sctx.putImageData(sourceImageData, 0, 0);

    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = tilePreviewSelection.w * 3;
    tileCanvas.height = tilePreviewSelection.h * 3;
    const tctx = tileCanvas.getContext('2d');
    if (!tctx) {
      return '';
    }

    tctx.imageSmoothingEnabled = false;
    for (let ty = 0; ty < 3; ty += 1) {
      for (let tx = 0; tx < 3; tx += 1) {
        tctx.drawImage(sourceCanvas, tx * tilePreviewSelection.w, ty * tilePreviewSelection.h);
      }
    }

    return tileCanvas.toDataURL('image/png');
  }, [canvasSize, pixels, tilePreviewSelection]);

  const pushUndo = useCallback(() => {
    undoStackRef.current.push(clonePixels(pixels));
    if (undoStackRef.current.length > MAX_UNDO) {
      undoStackRef.current.shift();
    }
  }, [pixels]);

  const drawCanvas = useCallback(
    (sourcePixels: Uint8ClampedArray, maybeSelection: Selection) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvasSize;
      tempCanvas.height = canvasSize;
      const tctx = tempCanvas.getContext('2d');
      if (!tctx) {
        return;
      }

      tctx.putImageData(new ImageData(sourcePixels.slice(), canvasSize, canvasSize), 0, 0);

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

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

      if (maybeSelection) {
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.95)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(
          maybeSelection.x * zoom,
          maybeSelection.y * zoom,
          maybeSelection.w * zoom,
          maybeSelection.h * zoom
        );
        ctx.setLineDash([]);
      }
    },
    [canvasSize, gridSpacing, zoom]
  );

  useEffect(() => {
    drawCanvas(pixels, selection);
  }, [pixels, selection, drawCanvas]);

  const endPan = useCallback(() => {
    if (!panStateRef.current.active) {
      return;
    }
    panStateRef.current.active = false;
    setIsPanning(false);
  }, []);

  const beginPan = useCallback((clientX: number, clientY: number) => {
    const stage = canvasStageRef.current;
    if (!stage) {
      return;
    }

    panStateRef.current = {
      active: true,
      startX: clientX,
      startY: clientY,
      startScrollLeft: stage.scrollLeft,
      startScrollTop: stage.scrollTop
    };
    setIsPanning(true);
  }, []);

  const updatePan = useCallback((clientX: number, clientY: number) => {
    const stage = canvasStageRef.current;
    if (!stage || !panStateRef.current.active) {
      return;
    }

    const dx = clientX - panStateRef.current.startX;
    const dy = clientY - panStateRef.current.startY;
    stage.scrollLeft = panStateRef.current.startScrollLeft - dx;
    stage.scrollTop = panStateRef.current.startScrollTop - dy;
  }, []);

  useEffect(() => {
    const isEditableElement = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      const tag = target.tagName;
      return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return;
      }
      if (isEditableElement(event.target)) {
        return;
      }
      event.preventDefault();
      setIsSpacePressed(true);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return;
      }
      setIsSpacePressed(false);
      endPan();
    };

    const onBlur = () => {
      setIsSpacePressed(false);
      endPan();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [endPan]);

  useEffect(() => {
    if (!isPanning) {
      return;
    }

    const onMouseMove = (event: MouseEvent) => {
      updatePan(event.clientX, event.clientY);
    };
    const onMouseUp = () => {
      endPan();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isPanning, updatePan, endPan]);

  const colorBytes = useMemo(() => {
    const rgb = selectedColor.replace('#', '');
    return {
      r: Number.parseInt(rgb.slice(0, 2), 16),
      g: Number.parseInt(rgb.slice(2, 4), 16),
      b: Number.parseInt(rgb.slice(4, 6), 16)
    };
  }, [selectedColor]);

  const applyStrokeSegment = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }, erase = false) => {
      const points = rasterLinePoints(from.x, from.y, to.x, to.y);
      setPixels((prev) => {
        const next = clonePixels(prev);
        for (const point of points) {
          const idx = (point.y * canvasSize + point.x) * 4;
          if (erase) {
            next[idx] = 0;
            next[idx + 1] = 0;
            next[idx + 2] = 0;
            next[idx + 3] = 0;
            continue;
          }
          next[idx] = colorBytes.r;
          next[idx + 1] = colorBytes.g;
          next[idx + 2] = colorBytes.b;
          next[idx + 3] = 255;
        }
        return next;
      });
    },
    [canvasSize, colorBytes]
  );

  const createFloodFillResult = useCallback(
    (source: Uint8ClampedArray, start: { x: number; y: number }): Uint8ClampedArray | null => {
      const next = clonePixels(source);
      const startIdx = (start.y * canvasSize + start.x) * 4;
      const target = [
        source[startIdx],
        source[startIdx + 1],
        source[startIdx + 2],
        source[startIdx + 3]
      ] as const;
      const replacement = [colorBytes.r, colorBytes.g, colorBytes.b, 255] as const;

      if (
        target[0] === replacement[0] &&
        target[1] === replacement[1] &&
        target[2] === replacement[2] &&
        target[3] === replacement[3]
      ) {
        return null;
      }

      let changed = false;
      const stack: Array<{ x: number; y: number }> = [{ x: start.x, y: start.y }];
      while (stack.length > 0) {
        const node = stack.pop();
        if (!node) {
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

        if (node.x > 0) {
          stack.push({ x: node.x - 1, y: node.y });
        }
        if (node.x + 1 < canvasSize) {
          stack.push({ x: node.x + 1, y: node.y });
        }
        if (node.y > 0) {
          stack.push({ x: node.x, y: node.y - 1 });
        }
        if (node.y + 1 < canvasSize) {
          stack.push({ x: node.x, y: node.y + 1 });
        }
      }

      return changed ? next : null;
    },
    [canvasSize, colorBytes]
  );

  const getCellFromEvent = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = Math.floor(((event.clientX - rect.left) / rect.width) * canvasSize);
      const y = Math.floor(((event.clientY - rect.top) / rect.height) * canvasSize);
      if (x < 0 || y < 0 || x >= canvasSize || y >= canvasSize) {
        return null;
      }
      return { x, y };
    },
    [canvasSize]
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
      const startX = Math.floor(cell.x / gridSpacing) * gridSpacing;
      const startY = Math.floor(cell.y / gridSpacing) * gridSpacing;
      const w = Math.min(gridSpacing, canvasSize - startX);
      const h = Math.min(gridSpacing, canvasSize - startY);
      return { x: startX, y: startY, w, h };
    },
    [canvasSize, gridSpacing]
  );

  const clearFloatingPaste = useCallback(() => {
    floatingPasteRef.current = null;
    drawStateRef.current.moveStartCell = null;
    drawStateRef.current.moveStartOrigin = null;
  }, []);

  const finalizeFloatingPaste = useCallback(() => {
    if (!floatingPasteRef.current) {
      return;
    }
    clearFloatingPaste();
    setStatusText('貼り付け移動を確定しました');
  }, [clearFloatingPaste]);

  const cancelFloatingPaste = useCallback(() => {
    const floating = floatingPasteRef.current;
    if (!floating) {
      return;
    }
    setPixels(clonePixels(floating.restorePixels));
    setSelection(cloneSelection(floating.restoreSelection));
    setTool(floating.restoreTool);
    clearFloatingPaste();
    setStatusText('貼り付け移動をキャンセルしました');
  }, [clearFloatingPaste]);

  const onMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (isSpacePressed) {
        beginPan(event.clientX, event.clientY);
        return;
      }

      const cell = getCellFromEvent(event);
      if (!cell) {
        return;
      }

      if (tool === 'select' && floatingPasteRef.current && pointInSelection(cell, selection)) {
        drawStateRef.current.active = true;
        drawStateRef.current.selectionStart = null;
        drawStateRef.current.selectionMoved = false;
        drawStateRef.current.clearSelectionOnMouseUp = false;
        drawStateRef.current.lastDrawCell = null;
        drawStateRef.current.moveStartCell = cell;
        drawStateRef.current.moveStartOrigin = { x: floatingPasteRef.current.x, y: floatingPasteRef.current.y };
        setStatusText('選択範囲を移動中');
        return;
      }

      if (tool === 'select' && selection && pointInSelection(cell, selection)) {
        pushUndo();
        const basePixels = clonePixels(pixels);
        const selectedPixels = new Uint8ClampedArray(selection.w * selection.h * 4);
        for (let y = 0; y < selection.h; y += 1) {
          for (let x = 0; x < selection.w; x += 1) {
            const srcIdx = ((selection.y + y) * canvasSize + (selection.x + x)) * 4;
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

        const composited = blitBlockOnCanvas(
          basePixels,
          canvasSize,
          selectedPixels,
          selection.w,
          selection.h,
          selection.x,
          selection.y
        );
        setPixels(composited);
        floatingPasteRef.current = {
          x: selection.x,
          y: selection.y,
          width: selection.w,
          height: selection.h,
          pixels: selectedPixels,
          basePixels,
          restorePixels: clonePixels(pixels),
          restoreSelection: cloneSelection(selection),
          restoreTool: tool
        };
        drawStateRef.current.active = true;
        drawStateRef.current.selectionStart = null;
        drawStateRef.current.selectionMoved = false;
        drawStateRef.current.clearSelectionOnMouseUp = false;
        drawStateRef.current.lastDrawCell = null;
        drawStateRef.current.moveStartCell = cell;
        drawStateRef.current.moveStartOrigin = { x: selection.x, y: selection.y };
        setStatusText('選択範囲を移動中');
        return;
      }

      if (tool === 'fill') {
        const filled = createFloodFillResult(pixels, cell);
        if (filled) {
          pushUndo();
          setPixels(filled);
        }
        clearFloatingPaste();
        drawStateRef.current.active = false;
        drawStateRef.current.selectionStart = null;
        drawStateRef.current.selectionMoved = false;
        drawStateRef.current.clearSelectionOnMouseUp = false;
        drawStateRef.current.lastDrawCell = null;
        drawStateRef.current.moveStartCell = null;
        drawStateRef.current.moveStartOrigin = null;
        setStatusText(filled ? '塗りつぶしました' : '塗りつぶし対象がありません');
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
        drawStateRef.current.moveStartCell = null;
        drawStateRef.current.moveStartOrigin = null;
        if (!shouldClearOnClick) {
          setSelection({ x: cell.x, y: cell.y, w: 1, h: 1 });
        }
      } else {
        applyStrokeSegment(cell, cell, tool === 'eraser');
        drawStateRef.current.selectionMoved = false;
        drawStateRef.current.clearSelectionOnMouseUp = false;
        drawStateRef.current.lastDrawCell = cell;
        drawStateRef.current.moveStartCell = null;
        drawStateRef.current.moveStartOrigin = null;
      }
    },
    [applyStrokeSegment, beginPan, clearFloatingPaste, createFloodFillResult, getCellFromEvent, isSpacePressed, pixels, pushUndo, selection, tool]
  );

  const onMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (panStateRef.current.active) {
        updatePan(event.clientX, event.clientY);
        return;
      }

      if (!drawStateRef.current.active) {
        return;
      }

      const cell = getCellFromEvent(event);
      if (!cell) {
        return;
      }

      if (drawStateRef.current.moveStartCell && drawStateRef.current.moveStartOrigin && floatingPasteRef.current) {
        const dx = cell.x - drawStateRef.current.moveStartCell.x;
        const dy = cell.y - drawStateRef.current.moveStartCell.y;
        const maxX = Math.max(0, canvasSize - floatingPasteRef.current.width);
        const maxY = Math.max(0, canvasSize - floatingPasteRef.current.height);
        const nextX = Math.max(0, Math.min(drawStateRef.current.moveStartOrigin.x + dx, maxX));
        const nextY = Math.max(0, Math.min(drawStateRef.current.moveStartOrigin.y + dy, maxY));

        if (nextX !== floatingPasteRef.current.x || nextY !== floatingPasteRef.current.y) {
          const composited = blitBlockOnCanvas(
            floatingPasteRef.current.basePixels,
            canvasSize,
            floatingPasteRef.current.pixels,
            floatingPasteRef.current.width,
            floatingPasteRef.current.height,
            nextX,
            nextY
          );
          setPixels(composited);
          setSelection({ x: nextX, y: nextY, w: floatingPasteRef.current.width, h: floatingPasteRef.current.height });
          floatingPasteRef.current.x = nextX;
          floatingPasteRef.current.y = nextY;
        }
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
    [applyStrokeSegment, canvasSize, getCellFromEvent, normalizeSelection, tool, updatePan]
  );

  const onMouseUp = useCallback(() => {
    if (panStateRef.current.active) {
      endPan();
      return;
    }

    const wasMovingPaste = drawStateRef.current.moveStartCell !== null && floatingPasteRef.current !== null;
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
      !drawStateRef.current.clearSelectionOnMouseUp;
    if (shouldClearSelection) {
      setSelection(null);
      setStatusText('選択を解除しました');
    }
    if (shouldSelectSingleTile && selectStart) {
      setSelection(resolveSingleTileSelection(selectStart));
      setStatusText('1タイルを選択しました');
    }
    drawStateRef.current.active = false;
    drawStateRef.current.selectionStart = null;
    drawStateRef.current.selectionMoved = false;
    drawStateRef.current.clearSelectionOnMouseUp = false;
    drawStateRef.current.lastDrawCell = null;
    drawStateRef.current.moveStartCell = null;
    drawStateRef.current.moveStartOrigin = null;
    if (wasMovingPaste && !shouldSelectSingleTile) {
      setStatusText('選択範囲を配置しました');
    }
  }, [endPan, resolveSingleTileSelection, tool]);

  const applyCanvasSize = useCallback(() => {
    const parsed = Number.parseInt(pendingCanvasSize, 10);
    if (!Number.isFinite(parsed)) {
      setStatusText('キャンバスサイズは数値で指定してください');
      return;
    }

    const normalized = clampCanvasSize(parsed);
    setCanvasSize(normalized);
    setPixels(createEmptyPixels(normalized));
    setSelection(null);
    clearFloatingPaste();
    setStatusText(`キャンバスを ${normalized}x${normalized} に変更しました`);
    setCurrentFilePath(undefined);
    setPendingCanvasSize(String(normalized));
    undoStackRef.current = [];
  }, [clearFloatingPaste, pendingCanvasSize]);

  const updateGridSpacing = useCallback((value: number) => {
    setGridSpacing(value);
    setStatusText(`補助グリッドを ${value}px 間隔に変更しました`);
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((prev) => {
      const next = Math.min(MAX_ZOOM, prev + 1);
      setStatusText(`表示倍率: ${next}x`);
      return next;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => {
      const next = Math.max(MIN_ZOOM, prev - 1);
      setStatusText(`表示倍率: ${next}x`);
      return next;
    });
  }, []);

  const clearCanvas = useCallback(() => {
    pushUndo();
    setPixels(createEmptyPixels(canvasSize));
    setSelection(null);
    clearFloatingPaste();
    setStatusText('キャンバスをクリアしました');
  }, [canvasSize, clearFloatingPaste, pushUndo]);

  const doUndo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) {
      setStatusText('Undo履歴がありません');
      return;
    }
    setPixels(previous);
    clearFloatingPaste();
    setStatusText('1手戻しました');
  }, [clearFloatingPaste]);

  const deleteSelection = useCallback(() => {
    if (!selection) {
      setStatusText('選択範囲がありません');
      return;
    }

    pushUndo();
    clearFloatingPaste();
    setPixels((prev) => {
      const next = clonePixels(prev);
      for (let y = selection.y; y < selection.y + selection.h; y += 1) {
        for (let x = selection.x; x < selection.x + selection.w; x += 1) {
          const idx = (y * canvasSize + x) * 4;
          next[idx] = 0;
          next[idx + 1] = 0;
          next[idx + 2] = 0;
          next[idx + 3] = 0;
        }
      }
      return next;
    });
    setStatusText('選択範囲を削除しました');
  }, [canvasSize, clearFloatingPaste, pushUndo, selection]);

  const copySelection = useCallback(async () => {
    if (!selection) {
      setStatusText('選択範囲がありません');
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
        const srcIdx = ((selection.y + y) * canvasSize + (selection.x + x)) * 4;
        const dstIdx = (y * selection.w + x) * 4;
        imageData.data[dstIdx] = pixels[srcIdx];
        imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
        imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
        imageData.data[dstIdx + 3] = pixels[srcIdx + 3];
      }
    }
    ctx.putImageData(imageData, 0, 0);
    selectionClipboardRef.current = {
      width: selection.w,
      height: selection.h,
      pixels: new Uint8ClampedArray(imageData.data),
      sourceX: selection.x,
      sourceY: selection.y
    };

    await window.pixelApi.copyImageDataUrl(canvas.toDataURL('image/png'));
    setStatusText('選択範囲をクリップボードにコピーしました');
  }, [canvasSize, pixels, selection]);

  const pasteSelection = useCallback(() => {
    const clip = selectionClipboardRef.current;
    if (!clip) {
      setStatusText('貼り付けできる選択コピーがありません');
      return;
    }

    const baseX = selection ? selection.x : Math.min(clip.sourceX + 1, canvasSize - 1);
    const baseY = selection ? selection.y : Math.min(clip.sourceY + 1, canvasSize - 1);
    const pasteX = Math.max(0, Math.min(baseX, canvasSize - 1));
    const pasteY = Math.max(0, Math.min(baseY, canvasSize - 1));
    const pasteWidth = Math.max(0, Math.min(clip.width, canvasSize - pasteX));
    const pasteHeight = Math.max(0, Math.min(clip.height, canvasSize - pasteY));

    if (pasteWidth === 0 || pasteHeight === 0) {
      setStatusText('貼り付け先がキャンバス外です');
      return;
    }

    pushUndo();
    const basePixels = clonePixels(pixels);
    const pastedPixels = new Uint8ClampedArray(pasteWidth * pasteHeight * 4);
    for (let y = 0; y < pasteHeight; y += 1) {
      for (let x = 0; x < pasteWidth; x += 1) {
        const srcIdx = (y * clip.width + x) * 4;
        const dstIdx = (y * pasteWidth + x) * 4;
        pastedPixels[dstIdx] = clip.pixels[srcIdx];
        pastedPixels[dstIdx + 1] = clip.pixels[srcIdx + 1];
        pastedPixels[dstIdx + 2] = clip.pixels[srcIdx + 2];
        pastedPixels[dstIdx + 3] = clip.pixels[srcIdx + 3];
      }
    }

    const composited = blitBlockOnCanvas(basePixels, canvasSize, pastedPixels, pasteWidth, pasteHeight, pasteX, pasteY);
    setPixels(composited);
    floatingPasteRef.current = {
      x: pasteX,
      y: pasteY,
      width: pasteWidth,
      height: pasteHeight,
      pixels: pastedPixels,
      basePixels,
      restorePixels: clonePixels(pixels),
      restoreSelection: cloneSelection(selection),
      restoreTool: tool
    };
    setTool('select');
    setSelection({ x: pasteX, y: pasteY, w: pasteWidth, h: pasteHeight });
    setStatusText(`選択範囲を貼り付けました (${pasteWidth}x${pasteHeight}) - Enterで確定 / Escでキャンセル`);
  }, [canvasSize, pixels, pushUndo, selection, tool]);

  useEffect(() => {
    const isEditableElement = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      const tag = target.tagName;
      return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target)) {
        return;
      }

      const withSystemKey = event.metaKey || event.ctrlKey;
      if (withSystemKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        doUndo();
        return;
      }
      if (withSystemKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        void copySelection();
        return;
      }
      if (withSystemKey && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        pasteSelection();
        return;
      }

      if (withSystemKey || event.altKey) {
        return;
      }

      switch (event.code) {
        case 'Enter':
        case 'NumpadEnter':
          if (!floatingPasteRef.current) {
            break;
          }
          event.preventDefault();
          finalizeFloatingPaste();
          break;
        case 'Escape':
          if (!floatingPasteRef.current) {
            break;
          }
          event.preventDefault();
          cancelFloatingPaste();
          break;
        case 'KeyB':
          event.preventDefault();
          setTool('pencil');
          setStatusText('ツール: 描画');
          break;
        case 'KeyE':
          event.preventDefault();
          setTool('eraser');
          setStatusText('ツール: 消しゴム');
          break;
        case 'KeyG':
          event.preventDefault();
          setTool('fill');
          setStatusText('ツール: 塗りつぶし');
          break;
        case 'KeyV':
          event.preventDefault();
          setTool('select');
          setStatusText('ツール: 矩形選択');
          break;
        case 'Equal':
        case 'NumpadAdd':
          event.preventDefault();
          zoomIn();
          break;
        case 'Minus':
        case 'NumpadSubtract':
          event.preventDefault();
          zoomOut();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [cancelFloatingPaste, copySelection, doUndo, finalizeFloatingPaste, pasteSelection, zoomIn, zoomOut]);

  const addColorToPalette = useCallback((hex: string) => {
    setPalette((prev) => (prev.includes(hex) ? prev : [...prev, hex]));
  }, []);

  const savePng = useCallback(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.putImageData(new ImageData(pixels.slice(), canvasSize, canvasSize), 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');

    const metadata: EditorMeta = {
      version: 2,
      canvasSize,
      gridSpacing,
      palette,
      lastTool: tool
    };

    const result = await window.pixelApi.savePng({
      base64Png: base64,
      metadata,
      filePath: currentFilePath
    });

    if (result.canceled) {
      setStatusText('保存をキャンセルしました');
      return;
    }

    setCurrentFilePath(result.filePath);
    setStatusText(`保存しました: ${result.filePath}`);
  }, [canvasSize, currentFilePath, gridSpacing, palette, pixels, tool]);

  const loadPng = useCallback(async () => {
    const result = await window.pixelApi.openPng();
    if (result.canceled || !result.base64Png) {
      setStatusText('読み込みをキャンセルしました');
      return;
    }

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('PNG画像の読み込みに失敗'));
      img.src = `data:image/png;base64,${result.base64Png}`;
    });

    const fallbackSize = img.width === img.height ? img.width : DEFAULT_CANVAS_SIZE;
    const targetCanvasSize = clampCanvasSize(result.metadata?.canvasSize ?? result.metadata?.grid ?? fallbackSize);

    const canvas = document.createElement('canvas');
    canvas.width = targetCanvasSize;
    canvas.height = targetCanvasSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, targetCanvasSize, targetCanvasSize);
    ctx.drawImage(img, 0, 0, targetCanvasSize, targetCanvasSize);

    const imageData = ctx.getImageData(0, 0, targetCanvasSize, targetCanvasSize);

    const detected = new Set<string>();
    for (let i = 0; i < imageData.data.length; i += 4) {
      const a = imageData.data[i + 3];
      if (a === 0) {
        continue;
      }
      detected.add(rgbaToHex(imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]));
      if (detected.size > 128) {
        break;
      }
    }

    setCanvasSize(targetCanvasSize);
    setPendingCanvasSize(String(targetCanvasSize));
    setPixels(new Uint8ClampedArray(imageData.data));
    setSelection(null);
    clearFloatingPaste();
    undoStackRef.current = [];
    setCurrentFilePath(result.filePath);

    if (result.metadata?.palette?.length) {
      setPalette(result.metadata.palette);
    } else if (detected.size > 0) {
      setPalette(Array.from(detected).slice(0, 64));
    }

    if (result.metadata?.lastTool) {
      setTool(result.metadata.lastTool);
    }

    const loadedGridSpacing = result.metadata?.gridSpacing ?? DEFAULT_GRID_SPACING;
    if (GRID_SPACING_OPTIONS.includes(loadedGridSpacing as (typeof GRID_SPACING_OPTIONS)[number])) {
      setGridSpacing(loadedGridSpacing);
    }

    const nonSquareNote = img.width !== img.height ? ' / 非正方形PNGは正方形キャンバスに合わせて変換' : '';
    setStatusText(`読み込みました: ${result.filePath} (${img.width}x${img.height})${nonSquareNote}`);
  }, [clearFloatingPaste]);

  return (
    <div className="container-fluid py-3 app-shell">
      <div className="row g-3">
        <aside className="col-12 col-lg-4 col-xl-3">
          <div className="card shadow-sm">
            <div className="card-body">
              <h1 className="h4 mb-3">Pixel Editor</h1>

              <div className="mb-3">
                <label className="form-label">1x PNGプレビュー</label>
                <div className="preview-wrap">
                  {previewDataUrl ? (
                    <img
                      src={previewDataUrl}
                      alt="PNG Preview"
                      className="preview-image"
                      width={canvasSize}
                      height={canvasSize}
                    />
                  ) : null}
                </div>
                <div className="form-text">{canvasSize}x{canvasSize} (1x)</div>
                <label className="form-label mt-2 mb-1">矩形選択 3x3タイルプレビュー</label>
                <div className="preview-wrap tile-preview-wrap">
                  {selectionTilePreviewDataUrl ? (
                    <img
                      src={selectionTilePreviewDataUrl}
                      alt="Selection 3x3 Tile Preview"
                      className="preview-image tile-preview-image"
                    />
                  ) : (
                    <div className="preview-placeholder">矩形選択するとここに3x3タイル表示</div>
                  )}
                </div>
                <div className="form-text">
                  {tilePreviewSelection
                    ? `${tilePreviewSelection.w}x${tilePreviewSelection.h} を3x3で表示${selection ? ' (現在選択中)' : ' (最終選択範囲)'}`
                    : '選択範囲なし'}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">キャンバスサイズ (px)</label>
                <div className="input-group">
                  <input
                    type="number"
                    min={MIN_CANVAS_SIZE}
                    max={MAX_CANVAS_SIZE}
                    className="form-control"
                    value={pendingCanvasSize}
                    onChange={(e) => setPendingCanvasSize(e.target.value)}
                  />
                  <button type="button" className="btn btn-outline-primary" onClick={applyCanvasSize}>
                    適用
                  </button>
                </div>
                <div className="form-text">初期値は 256x256。範囲は {MIN_CANVAS_SIZE} - {MAX_CANVAS_SIZE}</div>
              </div>

              <div className="mb-3">
                <label className="form-label">グリッド線の間隔</label>
                <div className="btn-group w-100" role="group">
                  {GRID_SPACING_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`btn ${gridSpacing === option ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => updateGridSpacing(option)}
                    >
                      {option}px
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">色</label>
                <input
                  type="color"
                  className="form-control form-control-color mb-2"
                  value={selectedColor}
                  onChange={(e) => {
                    setSelectedColor(e.target.value);
                    addColorToPalette(e.target.value);
                  }}
                />
                <div className="palette-grid">
                  {palette.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`palette-item ${selectedColor === color ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setSelectedColor(color)}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <div className="d-grid gap-2">
                <button type="button" className="btn btn-success" onClick={savePng}>
                  保存 (PNG)
                </button>
                <button type="button" className="btn btn-primary" onClick={loadPng}>
                  読み込み (PNG)
                </button>
              </div>

              <div className="small text-muted mt-3">
                <div>キャンバス: {canvasSize}x{canvasSize}</div>
                <div>グリッド線: {gridSpacing}px 間隔</div>
                <div>表示倍率: {zoom}x</div>
                <div>現在ファイル: {currentFilePath ?? '未保存'}</div>
                <div>状態: {statusText}</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="col-12 col-lg-8 col-xl-9">
          <div className="card shadow-sm editor-card">
            <div
              ref={canvasStageRef}
              className={`card-body d-flex canvas-stage canvas-stage-with-toolbar ${isPanning ? 'is-panning' : ''}`}
            >
              <canvas
                ref={canvasRef}
                width={displaySize}
                height={displaySize}
                className={`pixel-canvas ${isPanning ? 'is-panning' : isSpacePressed ? 'is-space-pan' : ''}`}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
              />
            </div>
            <div className="editor-toolbar" role="toolbar" aria-label="editor controls">
              <button
                type="button"
                className={`btn btn-sm editor-tool-btn ${tool === 'pencil' ? 'active' : ''}`}
                onClick={() => setTool('pencil')}
                title="描画ツール"
              >
                <span className="editor-btn-inner">
                  <i className="fa-solid fa-pencil" aria-hidden="true" />
                  <span className="editor-shortcut">B</span>
                </span>
              </button>
              <button
                type="button"
                className={`btn btn-sm editor-tool-btn ${tool === 'eraser' ? 'active' : ''}`}
                onClick={() => setTool('eraser')}
                title="消しゴム"
              >
                <span className="editor-btn-inner">
                  <i className="fa-solid fa-eraser" aria-hidden="true" />
                  <span className="editor-shortcut">E</span>
                </span>
              </button>
              <button
                type="button"
                className={`btn btn-sm editor-tool-btn ${tool === 'fill' ? 'active' : ''}`}
                onClick={() => setTool('fill')}
                title="塗りつぶし"
              >
                <span className="editor-btn-inner">
                  <i className="fa-solid fa-fill-drip" aria-hidden="true" />
                  <span className="editor-shortcut">G</span>
                </span>
              </button>
              <button
                type="button"
                className={`btn btn-sm editor-tool-btn ${tool === 'select' ? 'active' : ''}`}
                onClick={() => setTool('select')}
                title="矩形選択"
              >
                <span className="editor-btn-inner">
                  <i className="fa-regular fa-square" aria-hidden="true" />
                  <span className="editor-shortcut">V</span>
                </span>
              </button>

              <div className="editor-toolbar-separator" />

              <button
                type="button"
                className="btn btn-sm editor-tool-btn"
                onClick={zoomIn}
                disabled={zoom >= MAX_ZOOM}
                title="拡大 (+)"
              >
                <span className="editor-btn-inner">
                  <i className="fa-solid fa-magnifying-glass-plus" aria-hidden="true" />
                  <span className="editor-shortcut">+</span>
                </span>
              </button>
              <button
                type="button"
                className="btn btn-sm editor-tool-btn"
                onClick={zoomOut}
                disabled={zoom <= MIN_ZOOM}
                title="縮小 (-)"
              >
                <span className="editor-btn-inner">
                  <i className="fa-solid fa-magnifying-glass-minus" aria-hidden="true" />
                  <span className="editor-shortcut">-</span>
                </span>
              </button>
              <div className="editor-zoom-label">{zoom}x</div>

              <div className="editor-toolbar-separator" />

              <button type="button" className="btn btn-sm editor-tool-btn" onClick={doUndo} title="Undo (Cmd/Ctrl+Z)">
                <span className="editor-btn-inner">
                  <i className="fa-solid fa-rotate-left" aria-hidden="true" />
                  <span className="editor-shortcut">Z</span>
                </span>
              </button>
              <button type="button" className="btn btn-sm editor-tool-btn" onClick={copySelection} title="選択範囲をコピー">
                <i className="fa-regular fa-copy" aria-hidden="true" />
              </button>
              <button type="button" className="btn btn-sm editor-tool-btn" onClick={pasteSelection} title="貼り付け (Cmd/Ctrl+V)">
                <i className="fa-regular fa-paste" aria-hidden="true" />
              </button>
              <button type="button" className="btn btn-sm editor-tool-btn" onClick={deleteSelection} title="選択範囲を削除">
                <i className="fa-regular fa-trash-can" aria-hidden="true" />
              </button>
              <button type="button" className="btn btn-sm editor-tool-btn" onClick={clearCanvas} title="クリア">
                <i className="fa-solid fa-broom" aria-hidden="true" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
