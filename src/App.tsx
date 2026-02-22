import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorSidebar } from './components/EditorSidebar';
import { EditorToolbar } from './components/EditorToolbar';
import {
  DEFAULT_CANVAS_SIZE,
  DEFAULT_GRID_SPACING,
  DEFAULT_PALETTE,
  DEFAULT_ZOOM,
  GRID_SPACING_OPTIONS,
  MAX_CANVAS_SIZE,
  MAX_ZOOM,
  MAX_UNDO,
  MIN_CANVAS_SIZE,
  MIN_ZOOM
} from './editor/constants';
import type { EditorMeta, HoveredPixelInfo, Selection, Tool } from './editor/types';
import {
  blitBlockOnCanvas,
  clampCanvasSize,
  clampSelectionToCanvas,
  clonePixels,
  cloneSelection,
  createEmptyPixels,
  pointInSelection,
  rasterLinePoints,
  rgbaToHex,
  rgbaToHex8,
  rgbaToHsva
} from './editor/utils';

type ToastType = 'success' | 'warning' | 'error' | 'info';

// エディター全体の状態管理とイベント制御を担当するルートコンポーネント。
export function App() {
  // ---- UI / editor state ----
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
  const [statusText, setStatusTextRaw] = useState<string>('準備OK');
  const [toastType, setToastType] = useState<ToastType>('info');
  const [isToastVisible, setIsToastVisible] = useState<boolean>(false);
  const [toastSequence, setToastSequence] = useState<number>(0);
  const [hoveredPixelInfo, setHoveredPixelInfo] = useState<HoveredPixelInfo>(null);
  const [hoveredPaletteColor, setHoveredPaletteColor] = useState<{ hex: string; index: number } | null>(null);
  const [referencePixelInfos, setReferencePixelInfos] = useState<Array<NonNullable<HoveredPixelInfo>>>([]);
  const [draggingReferenceKey, setDraggingReferenceKey] = useState<string | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | undefined>(undefined);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isPanning, setIsPanning] = useState<boolean>(false);

  const setStatusText = useCallback((text: string, type: ToastType) => {
    setStatusTextRaw(text);
    setToastType(type);
    setIsToastVisible(true);
    setToastSequence((prev) => prev + 1);
  }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasStageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.title = `DlaPixy${hasUnsavedChanges ? ' *' : ''}`;
  }, [hasUnsavedChanges]);
  // drawStateRef: pointer interaction state machine for draw/select/move.
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
  // panStateRef: remembers scroll origin while Space + drag panning.
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
  // Internal clipboard for pixel-exact copy/paste behavior.
  const selectionClipboardRef = useRef<{
    width: number;
    height: number;
    pixels: Uint8ClampedArray;
    sourceX: number;
    sourceY: number;
  } | null>(null);
  // Floating block used by paste/selection move until user confirms or cancels.
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
    // Keep immutable snapshots; cap history size to avoid unbounded memory growth.
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

      // Grid is a visual overlay only (not a paint constraint).
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
        // Active selection border (red dashed rectangle).
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

  useEffect(() => {
    if (!isToastVisible) {
      return;
    }
    const timer = window.setTimeout(() => {
      setIsToastVisible(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [isToastVisible, toastSequence]);

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
            next[idx + 3] === 255
          ) {
            continue;
          }
          next[idx] = colorBytes.r;
          next[idx + 1] = colorBytes.g;
          next[idx + 2] = colorBytes.b;
          next[idx + 3] = 255;
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
    [canvasSize, colorBytes, selection]
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

  const updateHoveredPixelInfo = useCallback(
    (cell: { x: number; y: number } | null) => {
      if (!cell) {
        setHoveredPixelInfo(null);
        return;
      }

      const idx = (cell.y * canvasSize + cell.x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];
      const hsva = rgbaToHsva(r, g, b, a);
      const paletteIndex = palette.findIndex((color) => color.toLowerCase() === rgbaToHex(r, g, b).toLowerCase());

      setHoveredPixelInfo({
        x: cell.x,
        y: cell.y,
        rgba: { r, g, b, a },
        hex8: rgbaToHex8(r, g, b, a).toUpperCase(),
        hsva,
        paletteIndex: paletteIndex >= 0 ? paletteIndex : null
      });
    },
    [canvasSize, palette, pixels]
  );

  const getPixelInfoFields = useCallback((info: NonNullable<HoveredPixelInfo>) => {
    return {
      rgba: `${info.rgba.r}, ${info.rgba.g}, ${info.rgba.b}, ${info.rgba.a}`,
      hex8: info.hex8,
      hsva: `${info.hsva.h.toFixed(1)}, ${info.hsva.s.toFixed(1)}%, ${info.hsva.v.toFixed(1)}%, ${info.hsva.a.toFixed(3)}`,
      paletteIndex: String(info.paletteIndex ?? '-')
    };
  }, []);

  const copyTextToClipboard = useCallback(async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fall through to legacy copy path.
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }, []);

  const copyPixelField = useCallback(
    async (label: string, value: string) => {
      const copied = await copyTextToClipboard(value);
      setStatusText(copied ? `${label}をコピーしました` : `${label}のコピーに失敗しました`, copied ? 'success' : 'error');
    },
    [copyTextToClipboard]
  );

  const selectReferenceByNumber = useCallback(
    (number: number): boolean => {
      // Shortcut target is only 1-9. Lines after 9 are explicitly not selectable.
      if (number < 1 || number > 9) {
        return false;
      }
      const info = referencePixelInfos[number - 1];
      if (!info) {
        return false;
      }
      setSelectedColor(rgbaToHex(info.rgba.r, info.rgba.g, info.rgba.b));
      setStatusText(`参照 ${number} の色を選択しました`, 'success');
      return true;
    },
    [referencePixelInfos]
  );

  const freezeHoveredPixelInfo = useCallback(() => {
    const infoFromPalette = (() => {
      if (!hoveredPaletteColor) {
        return null;
      }
      const rgb = hoveredPaletteColor.hex.replace('#', '');
      const r = Number.parseInt(rgb.slice(0, 2), 16);
      const g = Number.parseInt(rgb.slice(2, 4), 16);
      const b = Number.parseInt(rgb.slice(4, 6), 16);
      const a = 255;
      return {
        x: -1,
        y: hoveredPaletteColor.index,
        rgba: { r, g, b, a },
        hex8: rgbaToHex8(r, g, b, a).toUpperCase(),
        hsva: rgbaToHsva(r, g, b, a),
        paletteIndex: hoveredPaletteColor.index
      } satisfies NonNullable<HoveredPixelInfo>;
    })();

    const activeInfo = hoveredPixelInfo ?? infoFromPalette;
    if (!activeInfo) {
      setStatusText('参照追加: キャンバスまたはパレット上にマウスを置いてから F を押してください', 'warning');
      return;
    }

    const hasSameInfoIgnoringCoordinate = referencePixelInfos.some(
      (info) =>
        info.rgba.r === activeInfo.rgba.r &&
        info.rgba.g === activeInfo.rgba.g &&
        info.rgba.b === activeInfo.rgba.b &&
        info.rgba.a === activeInfo.rgba.a &&
        info.hex8 === activeInfo.hex8 &&
        info.hsva.h === activeInfo.hsva.h &&
        info.hsva.s === activeInfo.hsva.s &&
        info.hsva.v === activeInfo.hsva.v &&
        info.hsva.a === activeInfo.hsva.a &&
        info.paletteIndex === activeInfo.paletteIndex &&
        !(info.x === activeInfo.x && info.y === activeInfo.y)
    );
    if (hasSameInfoIgnoringCoordinate) {
      setStatusText('参照追加: 同じ色情報がすでに登録済みです', 'warning');
      return;
    }

    const existingIndex = referencePixelInfos.findIndex((info) => info.x === activeInfo.x && info.y === activeInfo.y);
    if (existingIndex < 0) {
      setReferencePixelInfos((prev) => [...prev, activeInfo]);
      if (activeInfo.x >= 0) {
        setStatusText(`参照追加: (${activeInfo.x}, ${activeInfo.y}) ${activeInfo.hex8}`, 'success');
      } else {
        setStatusText(`参照追加: パレット[${activeInfo.paletteIndex}] ${activeInfo.hex8}`, 'success');
      }
      return;
    }

    if (referencePixelInfos[existingIndex].hex8 === activeInfo.hex8) {
      if (activeInfo.x >= 0) {
        setStatusText(`参照維持: (${activeInfo.x}, ${activeInfo.y}) は同じ色です`, 'warning');
      } else {
        setStatusText(`参照維持: パレット[${activeInfo.paletteIndex}] は同じ色です`, 'warning');
      }
      return;
    }

    setReferencePixelInfos((prev) => {
      const next = [...prev];
      next[existingIndex] = activeInfo;
      return next;
    });
    if (activeInfo.x >= 0) {
      setStatusText(`参照更新: (${activeInfo.x}, ${activeInfo.y}) -> ${activeInfo.hex8}`, 'success');
    } else {
      setStatusText(`参照更新: パレット[${activeInfo.paletteIndex}] -> ${activeInfo.hex8}`, 'success');
    }
  }, [hoveredPaletteColor, hoveredPixelInfo, referencePixelInfos]);

  const clearReferencePixelInfos = useCallback(() => {
    if (referencePixelInfos.length === 0) {
      setStatusText('参照はすでに空です', 'warning');
      return;
    }
    setReferencePixelInfos([]);
    setStatusText('参照ラインをクリアしました', 'success');
  }, [referencePixelInfos.length]);

  const removeReferencePixelInfo = useCallback((x: number, y: number) => {
    let removed = false;
    setReferencePixelInfos((prev) => {
      const next = prev.filter((info) => {
        const isTarget = info.x === x && info.y === y;
        if (isTarget) {
          removed = true;
        }
        return !isTarget;
      });
      return next.length === prev.length ? prev : next;
    });
    if (removed) {
      setStatusText(`参照を削除しました: (${x}, ${y})`, 'success');
    }
  }, []);

  const getReferenceKey = useCallback((info: NonNullable<HoveredPixelInfo>): string => `${info.x}:${info.y}`, []);

  const onReferenceDragStart = useCallback((event: React.DragEvent<HTMLDivElement>, sourceKey: string) => {
    setDraggingReferenceKey(sourceKey);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', sourceKey);
  }, []);

  const onReferenceDragEnd = useCallback(() => {
    setDraggingReferenceKey(null);
  }, []);

  const onReferenceDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onReferenceDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>, targetKey: string) => {
      event.preventDefault();
      const sourceKey = draggingReferenceKey ?? event.dataTransfer.getData('text/plain');
      setDraggingReferenceKey(null);
      if (!sourceKey || sourceKey === targetKey) {
        return;
      }

      let moved = false;
      setReferencePixelInfos((prev) => {
        const sourceIndex = prev.findIndex((info) => getReferenceKey(info) === sourceKey);
        const targetIndex = prev.findIndex((info) => getReferenceKey(info) === targetKey);
        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
          return prev;
        }

        const next = [...prev];
        const [movedItem] = next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, movedItem);
        moved = true;
        return next;
      });
      if (moved) {
        setStatusText('参照ラインの順序を変更しました', 'success');
      }
    },
    [draggingReferenceKey, getReferenceKey]
  );

  const finalizeFloatingPaste = useCallback(() => {
    if (!floatingPasteRef.current) {
      return;
    }
    clearFloatingPaste();
    setHasUnsavedChanges(true);
    setStatusText('貼り付け移動を確定しました', 'success');
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
    setStatusText('貼り付け移動をキャンセルしました', 'warning');
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
        // Continue dragging an already-floating block.
        drawStateRef.current.active = true;
        drawStateRef.current.selectionStart = null;
        drawStateRef.current.selectionMoved = false;
        drawStateRef.current.clearSelectionOnMouseUp = false;
        drawStateRef.current.lastDrawCell = null;
        drawStateRef.current.moveStartCell = cell;
        drawStateRef.current.moveStartOrigin = { x: floatingPasteRef.current.x, y: floatingPasteRef.current.y };
        setStatusText('選択範囲を移動中', 'info');
        return;
      }

      if (tool === 'select' && selection && pointInSelection(cell, selection)) {
        // Dragging existing selection converts it to floating block for move.
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
        setStatusText('選択範囲を移動中', 'info');
        return;
      }

      if (tool === 'fill') {
        // Fill executes immediately on mouse down (single action, not drag stream).
        const filled = createFloodFillResult(pixels, cell);
        if (filled) {
          pushUndo();
          setPixels(filled);
          setHasUnsavedChanges(true);
        }
        clearFloatingPaste();
        drawStateRef.current.active = false;
        drawStateRef.current.selectionStart = null;
        drawStateRef.current.selectionMoved = false;
        drawStateRef.current.clearSelectionOnMouseUp = false;
        drawStateRef.current.lastDrawCell = null;
        drawStateRef.current.moveStartCell = null;
        drawStateRef.current.moveStartOrigin = null;
        setStatusText(filled ? '塗りつぶしました' : '塗りつぶし対象がありません', filled ? 'success' : 'warning');
        return;
      }

      clearFloatingPaste();
      pushUndo();
      drawStateRef.current.active = true;

      if (tool === 'select') {
        // Only outside click clears selection; inside click/drag keeps selection state.
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
        // Pencil/Eraser start with an initial dot, then extend on mouse move.
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
      const hoveredCell = getCellFromEvent(event);
      updateHoveredPixelInfo(hoveredCell);

      if (panStateRef.current.active) {
        updatePan(event.clientX, event.clientY);
        return;
      }

      if (!drawStateRef.current.active) {
        return;
      }

      const cell = hoveredCell;
      if (!cell) {
        return;
      }

      if (drawStateRef.current.moveStartCell && drawStateRef.current.moveStartOrigin && floatingPasteRef.current) {
        // Move floating block with clamped bounds inside canvas.
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
        // Selection drag updates live rectangle preview.
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
    [applyStrokeSegment, canvasSize, getCellFromEvent, normalizeSelection, tool, updateHoveredPixelInfo, updatePan]
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
    // Single click in Select tool creates grid-aligned tile selection.
    if (shouldClearSelection) {
      setSelection(null);
      setStatusText('選択を解除しました', 'success');
    }
    if (shouldSelectSingleTile && selectStart) {
      setSelection(resolveSingleTileSelection(selectStart));
      setStatusText('1タイルを選択しました', 'success');
    }
    drawStateRef.current.active = false;
    drawStateRef.current.selectionStart = null;
    drawStateRef.current.selectionMoved = false;
    drawStateRef.current.clearSelectionOnMouseUp = false;
    drawStateRef.current.lastDrawCell = null;
    drawStateRef.current.moveStartCell = null;
    drawStateRef.current.moveStartOrigin = null;
    if (wasMovingPaste && !shouldSelectSingleTile) {
      setStatusText('選択範囲を配置しました', 'success');
    }
  }, [endPan, resolveSingleTileSelection, tool]);

  const onMouseLeaveCanvas = useCallback(() => {
    onMouseUp();
    setHoveredPixelInfo(null);
  }, [onMouseUp]);

  const applyCanvasSize = useCallback(() => {
    const parsed = Number.parseInt(pendingCanvasSize, 10);
    if (!Number.isFinite(parsed)) {
      setStatusText('キャンバスサイズは数値で指定してください', 'warning');
      return;
    }

    const normalized = clampCanvasSize(parsed, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE);
    setCanvasSize(normalized);
    setPixels(createEmptyPixels(normalized));
    setSelection(null);
    clearFloatingPaste();
    setStatusText(`キャンバスを ${normalized}x${normalized} に変更しました`, 'success');
    setHasUnsavedChanges(true);
    setPendingCanvasSize(String(normalized));
    undoStackRef.current = [];
  }, [clearFloatingPaste, pendingCanvasSize]);

  const updateGridSpacing = useCallback((value: number) => {
    setGridSpacing(value);
    setHasUnsavedChanges(true);
    setStatusText(`補助グリッドを ${value}px 間隔に変更しました`, 'success');
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((prev) => {
      const next = Math.min(MAX_ZOOM, prev + 1);
      setStatusText(`表示倍率: ${next}x`, 'success');
      return next;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => {
      const next = Math.max(MIN_ZOOM, prev - 1);
      setStatusText(`表示倍率: ${next}x`, 'success');
      return next;
    });
  }, []);

  const clearCanvas = useCallback(() => {
    pushUndo();
    if (selection) {
      // With active selection, clear only selected pixels (not full canvas).
      setPixels((prev) => {
        const next = clonePixels(prev);
        let changed = false;
        for (let y = selection.y; y < selection.y + selection.h; y += 1) {
          for (let x = selection.x; x < selection.x + selection.w; x += 1) {
            const idx = (y * canvasSize + x) * 4;
            if (next[idx + 3] === 0) {
              continue;
            }
            next[idx] = 0;
            next[idx + 1] = 0;
            next[idx + 2] = 0;
            next[idx + 3] = 0;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      setHasUnsavedChanges(true);
      setStatusText('選択範囲をクリアしました', 'success');
    } else {
      // Without selection, keep existing "clear all" behavior.
      setPixels(createEmptyPixels(canvasSize));
      setSelection(null);
      setHasUnsavedChanges(true);
      setStatusText('キャンバスをクリアしました', 'success');
    }
    clearFloatingPaste();
  }, [canvasSize, clearFloatingPaste, pushUndo, selection]);

  const doUndo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) {
      setStatusText('Undo履歴がありません', 'warning');
      return;
    }
    setPixels(previous);
    clearFloatingPaste();
    setHasUnsavedChanges(true);
    setStatusText('1手戻しました', 'success');
  }, [clearFloatingPaste]);

  const deleteSelection = useCallback(() => {
    if (!selection) {
      setStatusText('選択範囲がありません', 'warning');
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
    setHasUnsavedChanges(true);
    setStatusText('選択範囲を削除しました', 'success');
  }, [canvasSize, clearFloatingPaste, pushUndo, selection]);

  const copySelection = useCallback(async () => {
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
    setStatusText('選択範囲をクリップボードにコピーしました', 'success');
  }, [canvasSize, pixels, selection]);

  const pasteSelection = useCallback(() => {
    const clip = selectionClipboardRef.current;
    if (!clip) {
      setStatusText('貼り付けできる選択コピーがありません', 'warning');
      return;
    }

    const baseX = selection ? selection.x : Math.min(clip.sourceX + 1, canvasSize - 1);
    const baseY = selection ? selection.y : Math.min(clip.sourceY + 1, canvasSize - 1);
    const pasteX = Math.max(0, Math.min(baseX, canvasSize - 1));
    const pasteY = Math.max(0, Math.min(baseY, canvasSize - 1));
    const pasteWidth = Math.max(0, Math.min(clip.width, canvasSize - pasteX));
    const pasteHeight = Math.max(0, Math.min(clip.height, canvasSize - pasteY));

    if (pasteWidth === 0 || pasteHeight === 0) {
      setStatusText('貼り付け先がキャンバス外です', 'warning');
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
    setStatusText(`選択範囲を貼り付けました (${pasteWidth}x${pasteHeight}) - Enterで確定 / Escでキャンセル`, 'success');
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
          // Esc priority: cancel floating paste first, otherwise clear active selection.
          if (floatingPasteRef.current) {
            event.preventDefault();
            cancelFloatingPaste();
            break;
          }
          if (selection) {
            event.preventDefault();
            setSelection(null);
            setStatusText('選択を解除しました', 'success');
          }
          break;
        case 'KeyB':
          event.preventDefault();
          setTool('pencil');
          setStatusText('ツール: 描画', 'info');
          break;
        case 'KeyE':
          event.preventDefault();
          setTool('eraser');
          setStatusText('ツール: 消しゴム', 'info');
          break;
        case 'KeyG':
          event.preventDefault();
          setTool('fill');
          setStatusText('ツール: 塗りつぶし', 'info');
          break;
        case 'KeyV':
          event.preventDefault();
          setTool('select');
          setStatusText('ツール: 矩形選択', 'info');
          break;
        case 'KeyF':
          event.preventDefault();
          freezeHoveredPixelInfo();
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
  }, [
    cancelFloatingPaste,
    copySelection,
    doUndo,
    finalizeFloatingPaste,
    freezeHoveredPixelInfo,
    pasteSelection,
    selectReferenceByNumber,
    selection,
    zoomIn,
    zoomOut
  ]);

  const addColorToPalette = useCallback((hex: string) => {
    setPalette((prev) => {
      if (prev.includes(hex)) {
        return prev;
      }
      setHasUnsavedChanges(true);
      return [...prev, hex];
    });
  }, []);

  const createSavePayload = useCallback(() => {
    const canvas = document.createElement('canvas');
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
      version: 2,
      canvasSize,
      gridSpacing,
      palette,
      lastTool: tool
    };

    return { base64Png, metadata };
  }, [canvasSize, gridSpacing, palette, pixels, tool]);

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
    [createSavePayload, currentFilePath]
  );

  const savePng = useCallback(async () => {
    await performSave({ saveAs: false });
  }, [performSave]);

  const saveAsPng = useCallback(async () => {
    await performSave({ saveAs: true });
  }, [performSave]);

  const loadPng = useCallback(async () => {
    if (hasUnsavedChanges) {
      const confirmResult = await window.pixelApi.confirmOpenWithUnsaved();
      if (confirmResult.action === 'cancel') {
        setStatusText('読み込みをキャンセルしました', 'warning');
        return;
      }
      if (confirmResult.action === 'save-open') {
        const saveResult = await performSave({ saveAs: false, suppressCancelToast: true });
        if (saveResult === 'saved') {
          // Continue loading.
        } else if (saveResult === 'canceled') {
          setStatusText('保存がキャンセルされたため、読み込みを中止しました', 'warning');
          return;
        } else {
          setStatusText('保存に失敗したため、読み込みを中止しました', 'error');
          return;
        }
      }
    }

    try {
      const result = await window.pixelApi.openPng();
      if (result.canceled || !result.base64Png) {
        setStatusText('読み込みをキャンセルしました', 'warning');
        return;
      }

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('PNG画像の読み込みに失敗'));
        img.src = `data:image/png;base64,${result.base64Png}`;
      });

      const fallbackSize = img.width === img.height ? img.width : DEFAULT_CANVAS_SIZE;
      const targetCanvasSize = clampCanvasSize(
        result.metadata?.canvasSize ?? fallbackSize,
        MIN_CANVAS_SIZE,
        MAX_CANVAS_SIZE
      );

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

      setHasUnsavedChanges(false);

      const nonSquareNote = img.width !== img.height ? ' / 非正方形PNGは正方形キャンバスに合わせて変換' : '';
      setStatusText(`読み込みました: ${result.filePath} (${img.width}x${img.height})${nonSquareNote}`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : '不明なエラー';
      setStatusText(`読み込みに失敗しました: ${message}`, 'error');
    }
  }, [clearFloatingPaste, hasUnsavedChanges, performSave]);

  return (
    <div className="container-fluid py-3 app-shell">
      <div className="row g-3 app-main-row">
        <EditorSidebar
          canvasSize={canvasSize}
          previewDataUrl={previewDataUrl}
          selectionTilePreviewDataUrl={selectionTilePreviewDataUrl}
          tilePreviewSelection={tilePreviewSelection}
          selection={selection}
          pendingCanvasSize={pendingCanvasSize}
          setPendingCanvasSize={setPendingCanvasSize}
          applyCanvasSize={applyCanvasSize}
          gridSpacing={gridSpacing}
          updateGridSpacing={updateGridSpacing}
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
          addColorToPalette={addColorToPalette}
          palette={palette}
          setHoveredPaletteColor={setHoveredPaletteColor}
          savePng={savePng}
          saveAsPng={saveAsPng}
          loadPng={loadPng}
          zoom={zoom}
          currentFilePath={currentFilePath}
          hasUnsavedChanges={hasUnsavedChanges}
        />

        <main className="col-12 col-lg-8 col-xl-9 d-flex">
          <div className="card shadow-sm editor-card flex-grow-1">
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
                onMouseLeave={onMouseLeaveCanvas}
              />
            </div>
            <div className="canvas-hover-info px-3 py-2 border-top">
              {hoveredPixelInfo ? (
                (() => {
                  const fields = getPixelInfoFields(hoveredPixelInfo);
                  return (
                    <span className="canvas-hover-row">
                      <span className="canvas-hover-swatch" title={hoveredPixelInfo.hex8}>
                        <span
                          className="canvas-hover-swatch-color"
                          style={{
                            backgroundColor: `rgba(${hoveredPixelInfo.rgba.r}, ${hoveredPixelInfo.rgba.g}, ${hoveredPixelInfo.rgba.b}, ${hoveredPixelInfo.rgba.a / 255})`
                          }}
                        />
                      </span>
                      <span className="canvas-hover-text">x,y: {hoveredPixelInfo.x}, {hoveredPixelInfo.y}</span>
                      <span className="canvas-data-field">
                        RGBA: {fields.rgba}
                      </span>
                      <span className="canvas-data-field">
                        HEX8: {fields.hex8}
                      </span>
                      <span className="canvas-data-field">
                        HSVA: {fields.hsva}
                      </span>
                      <span className="canvas-data-field">
                        PaletteIndex: {fields.paletteIndex}
                      </span>
                    </span>
                  );
                })()
              ) : (
                <span className="canvas-hover-row">
                  <span className="canvas-hover-swatch" aria-hidden="true" />
                  <span className="canvas-hover-text">x,y: -</span>
                  <span className="canvas-data-field">RGBA: -</span>
                  <span className="canvas-data-field">HEX8: -</span>
                  <span className="canvas-data-field">HSVA: -</span>
                  <span className="canvas-data-field">PaletteIndex: -</span>
                </span>
              )}
            </div>
            <div className="canvas-reference-info px-3 py-2 border-top">
              <div className="canvas-reference-header">
                <span className="canvas-reference-label">参照 (F):</span>
                <button
                  type="button"
                  className="canvas-copy-btn"
                  onClick={clearReferencePixelInfos}
                  title="参照をクリア"
                  aria-label="参照をクリア"
                >
                  <i className="fa-solid fa-trash-can" aria-hidden="true" />
                </button>
              </div>
              {referencePixelInfos.length > 0 ? (
                <div className="canvas-reference-list">
                  {referencePixelInfos.map((info, index) => {
                    const fields = getPixelInfoFields(info);
                    const referenceKey = getReferenceKey(info);
                    const lineNumber = index < 9 ? String(index + 1) : '-';
                    return (
                      <div
                        key={referenceKey}
                        className={`canvas-reference-line ${draggingReferenceKey === referenceKey ? 'is-dragging' : ''}`}
                        title={info.hex8}
                        draggable
                        onDragStart={(event) => onReferenceDragStart(event, referenceKey)}
                        onDragEnd={onReferenceDragEnd}
                        onDragOver={onReferenceDragOver}
                        onDrop={(event) => onReferenceDrop(event, referenceKey)}
                      >
                        <span className="canvas-reference-number">{lineNumber}</span>
                        <span className="canvas-reference-swatch">
                          <span
                            className="canvas-hover-swatch-color"
                            style={{ backgroundColor: `rgba(${info.rgba.r}, ${info.rgba.g}, ${info.rgba.b}, ${info.rgba.a / 255})` }}
                          />
                        </span>
                        <span className="canvas-reference-text canvas-data-field">
                          RGBA: {fields.rgba}
                          <button
                            type="button"
                            className="canvas-copy-btn"
                            onClick={() => void copyPixelField('RGBA', fields.rgba)}
                            title="RGBAをコピー"
                            aria-label="RGBAをコピー"
                          >
                            <i className="fa-regular fa-copy" aria-hidden="true" />
                          </button>
                        </span>
                        <span className="canvas-reference-text canvas-data-field">
                          HEX8: {fields.hex8}
                          <button
                            type="button"
                            className="canvas-copy-btn"
                            onClick={() => void copyPixelField('HEX8', fields.hex8)}
                            title="HEX8をコピー"
                            aria-label="HEX8をコピー"
                          >
                            <i className="fa-regular fa-copy" aria-hidden="true" />
                          </button>
                        </span>
                        <span className="canvas-reference-text canvas-data-field">
                          HSVA: {fields.hsva}
                          <button
                            type="button"
                            className="canvas-copy-btn"
                            onClick={() => void copyPixelField('HSVA', fields.hsva)}
                            title="HSVAをコピー"
                            aria-label="HSVAをコピー"
                          >
                            <i className="fa-regular fa-copy" aria-hidden="true" />
                          </button>
                        </span>
                        <span className="canvas-reference-text canvas-data-field">
                          PaletteIndex: {fields.paletteIndex}
                          <button
                            type="button"
                            className="canvas-copy-btn"
                            onClick={() => void copyPixelField('PaletteIndex', fields.paletteIndex)}
                            title="PaletteIndexをコピー"
                            aria-label="PaletteIndexをコピー"
                          >
                            <i className="fa-regular fa-copy" aria-hidden="true" />
                          </button>
                        </span>
                        <button
                          type="button"
                          className="canvas-copy-btn"
                          onClick={() => removeReferencePixelInfo(info.x, info.y)}
                          title="この参照を削除"
                          aria-label="この参照を削除"
                        >
                          <i className="fa-solid fa-xmark" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className="canvas-reference-empty">-</span>
              )}
            </div>
            <EditorToolbar
              tool={tool}
              setTool={setTool}
              zoom={zoom}
              zoomIn={zoomIn}
              zoomOut={zoomOut}
              doUndo={doUndo}
              copySelection={copySelection}
              pasteSelection={pasteSelection}
              deleteSelection={deleteSelection}
              clearCanvas={clearCanvas}
            />
          </div>
        </main>
      </div>
      <div className={`status-toast ${isToastVisible ? 'show' : ''} ${toastType}`} role="status" aria-live="polite">
        {statusText}
      </div>
    </div>
  );
}
