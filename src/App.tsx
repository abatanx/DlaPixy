import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { EditorCanvasWorkspace } from './components/EditorCanvasWorkspace';
import { EditorSidebar } from './components/EditorSidebar';
import { CanvasSizeModal } from './components/modals/CanvasSizeModal';
import { ConfirmModal } from './components/modals/ConfirmModal';
import { GridSpacingModal } from './components/modals/GridSpacingModal';
import { KMeansQuantizeModal } from './components/modals/KMeansQuantizeModal';
import { SelectionRotateModal } from './components/modals/SelectionRotateModal';
import { ZoomModal } from './components/modals/ZoomModal';
import type { PaletteColorModalRequest } from './components/sidebar/types';
import { useCanvasViewport } from './hooks/useCanvasViewport';
import { useCanvasPointerInteractions } from './hooks/useCanvasPointerInteractions';
import { useDocumentFileActions } from './hooks/useDocumentFileActions';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { useFloatingPaste } from './hooks/useFloatingPaste';
import { usePixelReferences } from './hooks/usePixelReferences';
import type { GplExportFormat } from '../shared/palette-gpl';
import {
  DEFAULT_TRANSPARENT_BACKGROUND_MODE,
  type TransparentBackgroundMode
} from '../shared/transparent-background';
import {
  DEFAULT_CANVAS_SIZE,
  DEFAULT_GRID_SPACING,
  DEFAULT_PALETTE,
  DEFAULT_ZOOM,
  MAX_CANVAS_SIZE,
  MAX_UNDO,
  MIN_CANVAS_SIZE
} from './editor/constants';
import type {
  AnimationFrame,
  PaletteEntry,
  Selection,
  TilePreviewLayer,
  Tool
} from './editor/types';
import type { ClipboardPixelBlock, FloatingPasteState } from './editor/floating-paste';
import type { DrawState } from './editor/canvas-pointer';
import { getFileNameFromPath, replaceFileExtension, resolveNextSelectedColor } from './editor/app-utils';
import {
  FLOATING_HANDLE_ORDER,
  FLOATING_STAGE_PADDING_PX,
  getFloatingHandleStyle,
  type FloatingResizeSession
} from './editor/floating-interaction';
import {
  extractSelectionPixels,
  quantizeSelectionWithKMeans,
  suggestKMeansColorCount,
  type QuantizeSelectionResult,
  type QuantizeSelectionSource
} from './editor/kmeans-quantize';
import {
  collectPaletteUsageFromPixels,
  syncPaletteEntriesFromPixels,
  type PaletteUsageAnalysis
} from './editor/palette-sync';
import {
  createRegionPreviewDataUrl,
  createTilePreviewLayerDataUrl,
  createTilePreviewLayerThumbnailDataUrl
} from './editor/preview';
import { getTransparentBackgroundSurfaceClassName } from './editor/transparent-background';
import {
  applySelectionPixelBlock,
  extractSelectionPixelBlock,
  hasSamePixelBlock,
  type SelectionPixelBlock
} from './editor/selection-rotate';
import {
  clampSelectionToCanvas,
  clonePaletteEntries,
  clonePixels,
  cloneSelection,
  createEmptyPixels,
  hexToRgba,
  normalizePaletteEntries,
  pointInSelection,
  rasterLinePoints,
  resizeCanvasPixels
} from './editor/utils';

type ToastType = 'success' | 'warning' | 'error' | 'info';

type UndoSnapshot = {
  canvasSize: number;
  pixels: Uint8ClampedArray;
  selection: Selection;
  palette: PaletteEntry[];
  selectedColor: string;
};

type SelectionRect = Exclude<Selection, null>;

type KMeansQuantizeRequest = {
  selection: SelectionRect;
  source: QuantizeSelectionSource;
  initialColorCount: number;
};

type SelectionRotateRequest = {
  selection: SelectionRect;
  source: SelectionPixelBlock;
};

type PaletteRemovalRequest = {
  color: string;
  usedPixelCount: number;
};

const INITIAL_PALETTE = normalizePaletteEntries(clonePaletteEntries(DEFAULT_PALETTE));
const INITIAL_SELECTED_COLOR = INITIAL_PALETTE[0]?.color ?? '#000000ff';
const DEFAULT_ANIMATION_PREVIEW_FPS = 6;
const MIN_ANIMATION_PREVIEW_FPS = 1;
const MAX_ANIMATION_PREVIEW_FPS = 24;
const CANVAS_FRAME_PX = 1;

function hasSamePaletteEntries(left: PaletteEntry[], right: PaletteEntry[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (entry, index) =>
      entry.color === right[index]?.color &&
      entry.caption === right[index]?.caption &&
      entry.locked === right[index]?.locked
  );
}

// エディター全体の状態管理とイベント制御を担当するルートコンポーネント。
export function App() {
  // ---- UI / editor state ----
  const [canvasSize, setCanvasSize] = useState<number>(DEFAULT_CANVAS_SIZE);
  const [gridSpacing, setGridSpacing] = useState<number>(DEFAULT_GRID_SPACING);
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
  const [transparentBackgroundMode, setTransparentBackgroundMode] = useState<TransparentBackgroundMode>(
    DEFAULT_TRANSPARENT_BACKGROUND_MODE
  );
  const [pixels, setPixels] = useState<Uint8ClampedArray>(() => createEmptyPixels(DEFAULT_CANVAS_SIZE));
  const [palette, setPalette] = useState<PaletteEntry[]>(INITIAL_PALETTE);
  const [selectedColor, setSelectedColor] = useState<string>(INITIAL_SELECTED_COLOR);
  const [tool, setTool] = useState<Tool>('select');
  const [selection, setSelection] = useState<Selection>(null);
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
  const [statusText, setStatusTextRaw] = useState<string>('準備OK');
  const [toastType, setToastType] = useState<ToastType>('info');
  const [isToastVisible, setIsToastVisible] = useState<boolean>(false);
  const [toastSequence, setToastSequence] = useState<number>(0);
  const [paletteColorModalRequest, setPaletteColorModalRequest] = useState<PaletteColorModalRequest>(null);
  const [paletteRemovalRequest, setPaletteRemovalRequest] = useState<PaletteRemovalRequest | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | undefined>(undefined);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isCanvasSizeModalOpen, setIsCanvasSizeModalOpen] = useState<boolean>(false);
  const [isGridSpacingModalOpen, setIsGridSpacingModalOpen] = useState<boolean>(false);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState<boolean>(false);
  const [kMeansQuantizeRequest, setKMeansQuantizeRequest] = useState<KMeansQuantizeRequest | null>(null);
  const [selectionRotateRequest, setSelectionRotateRequest] = useState<SelectionRotateRequest | null>(null);

  const setStatusText = useCallback((text: string, type: ToastType) => {
    setStatusTextRaw(text);
    setToastType(type);
    setIsToastVisible(true);
    setToastSequence((prev) => prev + 1);
  }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasStageRef = useRef<HTMLDivElement | null>(null);
  const floatingPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const tilePreviewLayerIdRef = useRef<number>(1);
  const animationFrameIdRef = useRef<number>(1);
  const transparentBackgroundClassName = getTransparentBackgroundSurfaceClassName(transparentBackgroundMode);

  useEffect(() => {
    document.title = `DlaPixy${hasUnsavedChanges ? ' *' : ''}`;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    void window.pixelApi.setTransparentBackgroundMode(transparentBackgroundMode).catch(() => undefined);
  }, [transparentBackgroundMode]);

  useEffect(() => {
    setSelectionChangeSequence((prev) => prev + 1);
  }, [selection]);
  // drawStateRef: pointer interaction state machine for draw/select/move.
  const drawStateRef = useRef<DrawState>({
    active: false,
    selectionStart: null,
    selectionMoved: false,
    clearSelectionOnMouseUp: false,
    lastDrawCell: null,
    moveStartPoint: null,
    moveStartOrigin: null
  });
  // Internal clipboard for pixel-exact copy/paste behavior.
  const selectionClipboardRef = useRef<ClipboardPixelBlock | null>(null);
  // Floating block used by paste/selection move until user confirms or cancels.
  const floatingPasteRef = useRef<FloatingPasteState | null>(null);
  const floatingResizeRef = useRef<FloatingResizeSession | null>(null);
  const undoStackRef = useRef<UndoSnapshot[]>([]);

  const displaySize = useMemo(() => canvasSize * zoom, [canvasSize, zoom]);
  const {
    isSpacePressed,
    isPanning,
    panStateRef,
    beginPan,
    updatePan,
    endPan,
    pendingZoomAnchorRef,
    pendingViewportRestoreRef,
    setViewportRestoreSequence,
    applyZoom,
    zoomIn,
    zoomOut
  } = useCanvasViewport({
    canvasSize,
    zoom,
    setZoom,
    canvasRef,
    canvasStageRef,
    canvasPointerRef,
    setStatusText
  });
  const isFloatingPasteActive = floatingPasteRef.current !== null;
  const floatingStagePaddingCells = useMemo(() => Math.max(1, Math.ceil(FLOATING_STAGE_PADDING_PX / zoom)), [zoom]);
  const paletteUsage = useMemo<PaletteUsageAnalysis>(
    () => collectPaletteUsageFromPixels(pixels, canvasSize),
    [canvasSize, pixels]
  );

  const syncPaletteAfterPaste = useCallback(
    (nextPixels: Uint8ClampedArray) => {
      const { palette: nextPalette } = syncPaletteEntriesFromPixels(palette, nextPixels, canvasSize, {
        removeUnusedColors: false,
        addUsedColors: true
      });
      if (!hasSamePaletteEntries(palette, nextPalette)) {
        setPalette(nextPalette);
        setSelectedColor(resolveNextSelectedColor(nextPalette, selectedColor));
      }
    },
    [canvasSize, palette, selectedColor]
  );

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
      const x = ((clientX - rect.left) / rect.width) * canvas.width / zoom;
      const y = ((clientY - rect.top) / rect.height) * canvas.height / zoom;
      return { x, y };
    },
    [zoom]
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
    () =>
      clampSelectionToCanvas(
        (isFloatingPasteActive ? lastTilePreviewSelection : selection) ?? lastTilePreviewSelection,
        canvasSize
      ),
    [canvasSize, isFloatingPasteActive, lastTilePreviewSelection, selection]
  );

  useEffect(() => {
    if (!selection || isFloatingPasteActive) {
      return;
    }
    setLastTilePreviewSelection(selection);
  }, [isFloatingPasteActive, selection]);

  const tilePreviewCandidateLayer = useMemo(() => {
    if (!selection || isFloatingPasteActive) {
      return null;
    }
    const block = extractSelectionPixelBlock(pixels, canvasSize, selection);
    return {
      width: block.width,
      height: block.height,
      pixels: block.pixels
    };
  }, [canvasSize, isFloatingPasteActive, pixels, selection]);
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
    selection !== null &&
    !isFloatingPasteActive &&
    (tilePreviewLayers.length === 0 || selectionChangeSequence !== lastRegisteredTilePreviewSelectionSequence);
  const tilePreviewDataUrl = useMemo(() => {
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
    if (!animationPreviewFrame) {
      return '';
    }
    return createRegionPreviewDataUrl(pixels, canvasSize, animationPreviewFrame);
  }, [animationPreviewFrame, canvasSize, pixels]);

  const pushUndo = useCallback(() => {
    // Keep immutable snapshots; cap history size to avoid unbounded memory growth.
    undoStackRef.current.push({
      canvasSize,
      pixels: clonePixels(pixels),
      selection: cloneSelection(selection),
      palette: clonePaletteEntries(palette),
      selectedColor
    });
    if (undoStackRef.current.length > MAX_UNDO) {
      undoStackRef.current.shift();
    }
  }, [canvasSize, palette, pixels, selectedColor, selection]);

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

      const floating = floatingPasteRef.current;
      const renderPixels = isFloatingPasteActive && floating ? floating.basePixels : sourcePixels;
      tctx.putImageData(new ImageData(renderPixels.slice(), canvasSize, canvasSize), 0, 0);

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

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
    [canvasSize, gridSpacing, isFloatingPasteActive, zoom]
  );

  useEffect(() => {
    drawCanvas(pixels, selection);
  }, [pixels, selection, drawCanvas]);

  useLayoutEffect(() => {
    const previewCanvas = floatingPreviewCanvasRef.current;
    const floating = floatingPasteRef.current;
    if (!previewCanvas || !floating || !selection) {
      return;
    }

    previewCanvas.width = floating.width;
    previewCanvas.height = floating.height;
    const ctx = previewCanvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, floating.width, floating.height);
    ctx.putImageData(new ImageData(floating.pixels.slice(), floating.width, floating.height), 0, 0);
  }, [pixels, selection]);

  useEffect(() => {
    if (!isToastVisible) {
      return;
    }
    const timer = window.setTimeout(() => {
      setIsToastVisible(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [isToastVisible, toastSequence]);

  const colorBytes = useMemo(() => hexToRgba(selectedColor), [selectedColor]);

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

  const clearFloatingPaste = useCallback(() => {
    floatingPasteRef.current = null;
    floatingResizeRef.current = null;
    drawStateRef.current.moveStartPoint = null;
    drawStateRef.current.moveStartOrigin = null;
  }, []);

  const {
    applyFloatingPasteBlock,
    liftSelectionToFloatingPaste,
    copySelection,
    pasteSelection,
    finalizeFloatingPaste,
    cancelFloatingPaste,
    nudgeFloatingPaste
  } = useFloatingPaste({
    canvasSize,
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
    setPixels,
    setSelection,
    setTool,
    setHasUnsavedChanges,
    setStatusText
  });

  const scrollCanvasStageToCell = useCallback(
    (cell: { x: number; y: number }) => {
      const stage = canvasStageRef.current;
      const canvas = canvasRef.current;
      if (!stage || !canvas) {
        return;
      }

      const targetCenterX = canvas.offsetLeft + (cell.x + 0.5) * zoom;
      const targetCenterY = canvas.offsetTop + (cell.y + 0.5) * zoom;
      const maxScrollLeft = Math.max(0, stage.scrollWidth - stage.clientWidth);
      const maxScrollTop = Math.max(0, stage.scrollHeight - stage.clientHeight);
      const nextScrollLeft = Math.max(0, Math.min(targetCenterX - stage.clientWidth / 2, maxScrollLeft));
      const nextScrollTop = Math.max(0, Math.min(targetCenterY - stage.clientHeight / 2, maxScrollTop));

      stage.scrollTo({
        left: nextScrollLeft,
        top: nextScrollTop,
        behavior: 'smooth'
      });
    },
    [zoom]
  );

  const {
    hoveredPixelInfo,
    setHoveredPaletteColor,
    referencePixelInfos,
    draggingReferenceKey,
    updateHoveredPixelInfo,
    clearHoveredPixelInfo,
    jumpToPaletteUsage,
    focusHoveredPixel,
    getPixelInfoFields,
    copyPixelField,
    selectReferenceByNumber,
    freezeHoveredPixelInfo,
    clearReferencePixelInfos,
    removeReferencePixelInfo,
    openReferencePaletteColorModal,
    getReferenceKey,
    onReferenceDragStart,
    onReferenceDragEnd,
    onReferenceDragOver,
    onReferenceDrop,
    syncReferencePixelInfo
  } = usePixelReferences({
    canvasSize,
    pixels,
    palette,
    paletteUsageByColor: paletteUsage.byColor,
    floatingPasteRef,
    scrollCanvasStageToCell,
    setSelection,
    setLastTilePreviewSelection,
    setSelectedColor,
    setPaletteColorModalRequest,
    setStatusText
  });

  const {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeaveCanvas,
    onCanvasStageMouseDown,
    onFloatingOverlayMouseDown
  } = useCanvasPointerInteractions({
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
  });

  const applyCanvasSize = useCallback((normalized: number) => {
    if (normalized === canvasSize) {
      setIsCanvasSizeModalOpen(false);
      return;
    }

    pushUndo();
    setCanvasSize(normalized);
    setPixels((prev) => resizeCanvasPixels(prev, canvasSize, normalized));
    setSelection(null);
    setLastTilePreviewSelection(null);
    resetTilePreviewLayers();
    resetAnimationFrames();
    clearFloatingPaste();
    setStatusText(`キャンバスを ${normalized}x${normalized} に変更しました`, 'success');
    setHasUnsavedChanges(true);
    setIsCanvasSizeModalOpen(false);
  }, [canvasSize, clearFloatingPaste, pushUndo, resetAnimationFrames, resetTilePreviewLayers, setStatusText]);

  const openCanvasSizeModal = useCallback(() => {
    setIsCanvasSizeModalOpen(true);
  }, []);

  const closeCanvasSizeModal = useCallback(() => {
    setIsCanvasSizeModalOpen(false);
  }, []);

  const applyGridSpacing = useCallback((value: number) => {
    setGridSpacing(value);
    setHasUnsavedChanges(true);
    setIsGridSpacingModalOpen(false);
    setStatusText(value === 0 ? '補助グリッドを非表示にしました' : `補助グリッドを ${value}px 間隔に変更しました`, 'success');
  }, []);

  const openGridSpacingModal = useCallback(() => {
    setIsGridSpacingModalOpen(true);
  }, []);

  const closeGridSpacingModal = useCallback(() => {
    setIsGridSpacingModalOpen(false);
  }, []);

  const openZoomModal = useCallback(() => {
    setIsZoomModalOpen(true);
  }, []);

  const closeZoomModal = useCallback(() => {
    setIsZoomModalOpen(false);
  }, []);

  const openSelectionRotateModal = useCallback(() => {
    if (floatingPasteRef.current) {
      setStatusText('ローテーションの前に Enter で確定するか Esc でキャンセルしてください', 'warning');
      return;
    }

    const normalizedSelection = clampSelectionToCanvas(selection, canvasSize);
    if (!normalizedSelection) {
      setStatusText('ローテーション: 先に矩形選択してください', 'warning');
      return;
    }

    setSelectionRotateRequest({
      selection: normalizedSelection,
      source: extractSelectionPixelBlock(pixels, canvasSize, normalizedSelection)
    });
  }, [canvasSize, pixels, selection, setStatusText]);

  const closeSelectionRotateModal = useCallback(() => {
    setSelectionRotateRequest(null);
  }, []);

  const applySelectionRotate = useCallback(
    (result: SelectionPixelBlock) => {
      if (!selectionRotateRequest) {
        return;
      }

      if (hasSamePixelBlock(selectionRotateRequest.source.pixels, result.pixels)) {
        setStatusText('ローテーションの変更がありません', 'warning');
        return;
      }

      pushUndo();
      setPixels((prev) =>
        applySelectionPixelBlock(prev, canvasSize, selectionRotateRequest.selection, result.pixels)
      );
      setSelection(selectionRotateRequest.selection);
      setLastTilePreviewSelection(selectionRotateRequest.selection);
      setHasUnsavedChanges(true);
      setStatusText(
        `ローテーションを適用しました: ${selectionRotateRequest.selection.w}x${selectionRotateRequest.selection.h}`,
        'success'
      );
    },
    [canvasSize, pushUndo, selectionRotateRequest, setStatusText]
  );

  const openKMeansQuantizeModal = useCallback(() => {
    if (floatingPasteRef.current) {
      setStatusText('減色の前に Enter で確定するか Esc でキャンセルしてください', 'warning');
      return;
    }

    const normalizedSelection = clampSelectionToCanvas(selection, canvasSize);
    if (!normalizedSelection) {
      setStatusText('K-Means減色: 先に矩形選択してください', 'warning');
      return;
    }

    const source = extractSelectionPixels(pixels, canvasSize, normalizedSelection);
    if (source.visiblePixelCount === 0) {
      setStatusText('選択範囲に可視ピクセルがありません', 'warning');
      return;
    }
    if (source.uniqueVisibleColorCount <= 1) {
      setStatusText('選択範囲の可視色数が 1 色以下のため減色できません', 'warning');
      return;
    }

    setKMeansQuantizeRequest({
      selection: normalizedSelection,
      source,
      initialColorCount: suggestKMeansColorCount(source.uniqueVisibleColorCount)
    });
  }, [canvasSize, pixels, selection, setStatusText]);

  const closeKMeansQuantizeModal = useCallback(() => {
    setKMeansQuantizeRequest(null);
  }, []);

  const applyKMeansQuantize = useCallback(
    (result: QuantizeSelectionResult) => {
      if (!kMeansQuantizeRequest) {
        return;
      }

      const { selection: requestSelection } = kMeansQuantizeRequest;
      const nextPixels = clonePixels(pixels);
      let changedPixelCount = 0;

      for (let y = 0; y < requestSelection.h; y += 1) {
        for (let x = 0; x < requestSelection.w; x += 1) {
          const sourceIndex = (y * requestSelection.w + x) * 4;
          const targetIndex = ((requestSelection.y + y) * canvasSize + (requestSelection.x + x)) * 4;
          const isSamePixel =
            nextPixels[targetIndex] === result.pixels[sourceIndex] &&
            nextPixels[targetIndex + 1] === result.pixels[sourceIndex + 1] &&
            nextPixels[targetIndex + 2] === result.pixels[sourceIndex + 2] &&
            nextPixels[targetIndex + 3] === result.pixels[sourceIndex + 3];

          if (!isSamePixel) {
            changedPixelCount += 1;
          }

          nextPixels[targetIndex] = result.pixels[sourceIndex];
          nextPixels[targetIndex + 1] = result.pixels[sourceIndex + 1];
          nextPixels[targetIndex + 2] = result.pixels[sourceIndex + 2];
          nextPixels[targetIndex + 3] = result.pixels[sourceIndex + 3];
        }
      }

      const { palette: nextPalette } = syncPaletteEntriesFromPixels(palette, nextPixels, canvasSize, {
        removeUnusedColors: true,
        addUsedColors: true
      });
      if (changedPixelCount === 0 && hasSamePaletteEntries(palette, nextPalette)) {
        setStatusText('減色結果は現在の内容と同じです', 'warning');
        return;
      }

      const previousPaletteColors = new Set(palette.map((entry) => entry.color));
      const nextPaletteColors = new Set(nextPalette.map((entry) => entry.color));
      const removedColorCount = palette.filter((entry) => !nextPaletteColors.has(entry.color)).length;
      const addedColorCount = nextPalette.filter((entry) => !previousPaletteColors.has(entry.color)).length;
      const nextSelectedColor = resolveNextSelectedColor(nextPalette, selectedColor);

      pushUndo();
      setPixels(nextPixels);
      setPalette(nextPalette);
      setSelectedColor(nextSelectedColor);
      setHasUnsavedChanges(true);
      setStatusText(
        `選択範囲を K-Means で減色しました: ${result.resultColorCount} 色 / パレット +${addedColorCount} -${removedColorCount}`,
        'success'
      );
    },
    [canvasSize, kMeansQuantizeRequest, palette, pixels, pushUndo, selectedColor, setStatusText]
  );

  const doUndo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) {
      setStatusText('Undo履歴がありません', 'warning');
      return;
    }
    setCanvasSize(previous.canvasSize);
    setPixels(previous.pixels);
    setSelection(previous.selection);
    setLastTilePreviewSelection(previous.selection);
    setPalette(clonePaletteEntries(previous.palette));
    setSelectedColor(previous.selectedColor);
    if (previous.canvasSize !== canvasSize) {
      resetAnimationFrames();
    }
    clearFloatingPaste();
    setHasUnsavedChanges(true);
    setStatusText('1手戻しました', 'success');
  }, [canvasSize, clearFloatingPaste, resetAnimationFrames]);

  const addTilePreviewLayer = useCallback(() => {
    if (floatingPasteRef.current) {
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
  }, [selection, selectionChangeSequence, setStatusText, tilePreviewLayers.length]);

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
    if (floatingPasteRef.current) {
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
  }, [animationFrames.length, selection, setStatusText]);

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

  const deleteSelection = useCallback(() => {
    if (floatingPasteRef.current) {
      setStatusText('削除の前に Enter で確定するか Esc でキャンセルしてください', 'warning');
      return;
    }
    if (!selection) {
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

  const selectEntireCanvas = useCallback(() => {
    if (floatingPasteRef.current) {
      setStatusText('全選択の前に Enter で確定するか Esc でキャンセルしてください', 'warning');
      return;
    }

    setTool('select');
    setSelection({ x: 0, y: 0, w: canvasSize, h: canvasSize });
    setStatusText(`キャンバス全体を選択しました (${canvasSize}x${canvasSize})`, 'success');
  }, [canvasSize, setStatusText]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setStatusText('選択を解除しました', 'success');
  }, [setStatusText]);

  const addPaletteColor = useCallback(
    ({ color: nextColor, caption: nextCaption, locked: nextLocked }: PaletteEntry) => {
      if (palette.some((entry) => entry.color === nextColor)) {
        setStatusText('同じ色はすでにパレットにあります', 'warning');
        return;
      }

      pushUndo();
      setSelectedColor(nextColor);
      setPalette((prev) => [...prev, { color: nextColor, caption: nextCaption, locked: nextLocked }]);
      setHasUnsavedChanges(true);
      setStatusText(`パレットに追加しました: ${nextColor.toUpperCase()}`, 'success');
    },
    [palette, pushUndo, setStatusText]
  );

  const removePaletteColor = useCallback(
    (colorToRemove: string, clearUsedPixels: boolean) => {
      const selectedPaletteIndex = palette.findIndex((entry) => entry.color === colorToRemove);
      if (selectedPaletteIndex < 0) {
        setPaletteRemovalRequest(null);
        setStatusText('削除対象の色はパレットにありません', 'warning');
        return;
      }

      const nextPalette = palette.filter((_entry, index) => index !== selectedPaletteIndex);
      const nextSelectedColor = resolveNextSelectedColor(nextPalette, selectedColor);
      let nextPixels = pixels;
      let clearedPixelCount = 0;

      if (clearUsedPixels) {
        const targetColor = hexToRgba(colorToRemove);
        const clearedPixels = clonePixels(pixels);

        for (let index = 0; index < clearedPixels.length; index += 4) {
          if (
            clearedPixels[index] !== targetColor.r ||
            clearedPixels[index + 1] !== targetColor.g ||
            clearedPixels[index + 2] !== targetColor.b ||
            clearedPixels[index + 3] !== targetColor.a
          ) {
            continue;
          }

          clearedPixels[index] = 0;
          clearedPixels[index + 1] = 0;
          clearedPixels[index + 2] = 0;
          clearedPixels[index + 3] = 0;
          clearedPixelCount += 1;
        }

        nextPixels = clearedPixels;
      }

      pushUndo();
      setPalette(nextPalette);
      setSelectedColor(nextSelectedColor);
      if (clearUsedPixels) {
        setPixels(nextPixels);
      }
      setPaletteRemovalRequest(null);
      setHasUnsavedChanges(true);
      setStatusText(
        clearUsedPixels && clearedPixelCount > 0
          ? `使用中の色をクリアして削除しました: ${colorToRemove.toUpperCase()} / ${clearedPixelCount.toLocaleString()}px`
          : `パレットから削除しました: ${colorToRemove.toUpperCase()}`,
        'success'
      );
    },
    [palette, pixels, pushUndo, selectedColor, setStatusText]
  );

  const removeSelectedColorFromPalette = useCallback(() => {
    const selectedPaletteIndex = palette.findIndex((entry) => entry.color === selectedColor);
    if (selectedPaletteIndex < 0) {
      setStatusText('選択色はパレットにありません', 'warning');
      return;
    }

    const usedPixelCount = paletteUsage.byColor[selectedColor]?.count ?? 0;
    if (usedPixelCount > 0) {
      setPaletteRemovalRequest({
        color: selectedColor,
        usedPixelCount
      });
      return;
    }

    removePaletteColor(selectedColor, false);
  }, [palette, paletteUsage.byColor, removePaletteColor, selectedColor, setStatusText]);

  const applySelectedColorChange = useCallback(
    ({ color: nextColor, caption: nextCaption, locked: nextLocked }: PaletteEntry) => {
      const selectedPaletteIndex = palette.findIndex((entry) => entry.color === selectedColor);
      const currentEntry = selectedPaletteIndex >= 0 ? palette[selectedPaletteIndex] ?? null : null;
      const currentCaption = currentEntry?.caption ?? '';
      const currentLocked = currentEntry?.locked ?? false;
      if (nextColor === selectedColor && nextCaption === currentCaption && nextLocked === currentLocked) {
        return;
      }

      if (selectedPaletteIndex < 0) {
        setSelectedColor(nextColor);
        return;
      }

      const previousColor = hexToRgba(selectedColor);
      const updatedColor = hexToRgba(nextColor);
      const nextPixels = clonePixels(pixels);
      let replacedPixelCount = 0;

      for (let index = 0; index < nextPixels.length; index += 4) {
        if (
          nextPixels[index] !== previousColor.r ||
          nextPixels[index + 1] !== previousColor.g ||
          nextPixels[index + 2] !== previousColor.b ||
          nextPixels[index + 3] !== previousColor.a
        ) {
          continue;
        }

        nextPixels[index] = updatedColor.r;
        nextPixels[index + 1] = updatedColor.g;
        nextPixels[index + 2] = updatedColor.b;
        nextPixels[index + 3] = updatedColor.a;
        replacedPixelCount += 1;
      }

      const nextPalette = palette.map((entry, index) =>
        index === selectedPaletteIndex ? { color: nextColor, caption: nextCaption, locked: nextLocked } : entry
      );

      pushUndo();
      setSelectedColor(nextColor);
      setPalette(nextPalette);
      setPixels(replacedPixelCount > 0 ? nextPixels : pixels);
      setHasUnsavedChanges(true);
      if (nextColor !== selectedColor) {
        setStatusText(
          `パレット色を更新しました: ${selectedColor.toUpperCase()} -> ${nextColor.toUpperCase()}${replacedPixelCount > 0 ? ` / ${replacedPixelCount}px` : ''}`,
          'success'
        );
      } else {
        setStatusText('パレット設定を更新しました', 'success');
      }
    },
    [palette, pixels, pushUndo, selectedColor, setStatusText]
  );

  const applyImportedPalette = useCallback(
    (importedPalette: PaletteEntry[], mode: 'replace' | 'append', filePath?: string) => {
      const normalizedImported = normalizePaletteEntries(importedPalette);
      if (normalizedImported.length === 0) {
        setStatusText('インポートできる色がありませんでした', 'warning');
        return;
      }

      const nextPalette =
        mode === 'append'
          ? normalizePaletteEntries([...clonePaletteEntries(palette), ...clonePaletteEntries(normalizedImported)])
          : clonePaletteEntries(normalizedImported);

      if (hasSamePaletteEntries(palette, nextPalette)) {
        setStatusText(
          mode === 'append'
            ? '追加できる新しい色がありませんでした'
            : '読み込んだパレットは現在の内容と同じです',
          'warning'
        );
        return;
      }

      const nextSelectedColor = resolveNextSelectedColor(nextPalette, selectedColor);
      const importedCount =
        mode === 'append' ? Math.max(0, nextPalette.length - palette.length) : nextPalette.length;
      const sourceLabel = getFileNameFromPath(filePath) ?? 'palette.gpl';

      pushUndo();
      setPalette(nextPalette);
      setSelectedColor(nextSelectedColor);
      setHasUnsavedChanges(true);
      setStatusText(
        mode === 'append'
          ? `パレットを追加インポートしました: ${sourceLabel} / +${importedCount} colors`
          : `パレットを置換インポートしました: ${sourceLabel} / ${importedCount} colors`,
        'success'
      );
    },
    [palette, pushUndo, selectedColor, setStatusText]
  );

  const importGplPalette = useCallback(
    async (mode: 'replace' | 'append') => {
      try {
        const result = await window.pixelApi.importGplPalette({ mode });
        if (result.canceled) {
          setStatusText('パレットのインポートをキャンセルしました', 'warning');
          return;
        }
        if (result.error) {
          const label = result.filePath ? `: ${result.filePath}` : '';
          const detail = result.message ? ` / ${result.message}` : '';
          if (result.error === 'not-found') {
            setStatusText(`パレットファイルが見つかりません${label}`, 'error');
            return;
          }
          if (result.error === 'read-failed') {
            setStatusText(`パレットの読み込みに失敗しました${label}`, 'error');
            return;
          }
          setStatusText(`GPL の解析に失敗しました${label}${detail}`, 'error');
          return;
        }
        if (!result.palette) {
          setStatusText('パレットのインポート結果が空です', 'error');
          return;
        }
        applyImportedPalette(result.palette, result.mode ?? mode, result.filePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : '不明なエラー';
        setStatusText(`パレットのインポートに失敗しました: ${message}`, 'error');
      }
    },
    [applyImportedPalette, setStatusText]
  );

  const exportGplPalette = useCallback(async (format: GplExportFormat) => {
    try {
      const currentFileName = getFileNameFromPath(currentFilePath);
      const suggestedFileName = replaceFileExtension(
        currentFileName ?? 'palette',
        format === 'rgba' ? '-rgba.gpl' : '.gpl'
      );
      const exportLabel = format === 'rgba' ? 'Aseprite向け RGBA GPL' : '標準 GPL';
      const result = await window.pixelApi.exportGplPalette({
        palette: clonePaletteEntries(palette),
        format,
        suggestedFileName,
        paletteName: currentFileName ? currentFileName.replace(/\.[^.]+$/, '') : 'DlaPixy Palette'
      });

      if (result.canceled) {
        setStatusText('パレットのエクスポートをキャンセルしました', 'warning');
        return;
      }
      if (result.error) {
        const detail = result.message ? `: ${result.message}` : '';
        setStatusText(`パレットのエクスポートに失敗しました${detail}`, 'error');
        return;
      }

      setStatusText(
        `パレットを${exportLabel}でエクスポートしました: ${result.filePath ?? suggestedFileName}`,
        'success'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '不明なエラー';
      setStatusText(`パレットのエクスポートに失敗しました: ${message}`, 'error');
    }
  }, [currentFilePath, palette, setStatusText]);

  const { savePng, saveAsPng, loadPng } = useDocumentFileActions({
    canvasSize,
    currentFilePath,
    gridSpacing,
    hasUnsavedChanges,
    palette,
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
    setPalette,
    setSelectedColor,
    setTool,
    setGridSpacing,
    setZoom,
    setTransparentBackgroundMode,
    setViewportRestoreSequence,
    setHasUnsavedChanges,
    resetTilePreviewLayers,
    resetAnimationFrames,
    clearFloatingPaste,
    setStatusText
  });

  useEditorShortcuts({
    selectionRotateRequestActive: selectionRotateRequest !== null,
    hasSelection: selection !== null,
    floatingPasteRef,
    setTool,
    setTransparentBackgroundMode,
    setStatusText,
    clearSelection,
    doUndo,
    copySelection,
    pasteSelection,
    selectEntireCanvas,
    deleteSelection,
    selectReferenceByNumber,
    finalizeFloatingPaste,
    cancelFloatingPaste,
    nudgeFloatingPaste,
    addAnimationFrame,
    addTilePreviewLayer,
    openSelectionRotateModal,
    zoomIn,
    zoomOut,
    freezeHoveredPixelInfo,
    focusHoveredPixel,
    savePng,
    saveAsPng,
    loadPng,
    openZoomModal,
    openCanvasSizeModal,
    openGridSpacingModal,
    openKMeansQuantizeModal,
    importGplPalette,
    exportGplPalette,
  });

  const hasCommittedSelection = selection !== null && !isFloatingPasteActive;
  const selectionOverlaySelection = selection;
  const selectionOverlayLeftPx = selectionOverlaySelection ? selectionOverlaySelection.x * zoom : 0;
  const selectionOverlayTopPx = selectionOverlaySelection ? selectionOverlaySelection.y * zoom : 0;
  const selectionOverlayWidthPx = selectionOverlaySelection ? selectionOverlaySelection.w * zoom : 0;
  const selectionOverlayHeightPx = selectionOverlaySelection ? selectionOverlaySelection.h * zoom : 0;
  const selectionOverlayBaseStyle = selectionOverlaySelection
    ? ({
        left: `${CANVAS_FRAME_PX + selectionOverlayLeftPx}px`,
        top: `${CANVAS_FRAME_PX + selectionOverlayTopPx}px`,
        width: `${selectionOverlayWidthPx}px`,
        height: `${selectionOverlayHeightPx}px`
      } as CSSProperties)
    : undefined;
  const selectionOverlayVisualStyle = selectionOverlaySelection
    ? ({
        ...selectionOverlayBaseStyle,
        clipPath: `inset(${Math.max(0, -selectionOverlayTopPx)}px ${Math.max(
          0,
          selectionOverlayLeftPx + selectionOverlayWidthPx - displaySize
        )}px ${Math.max(0, selectionOverlayTopPx + selectionOverlayHeightPx - displaySize)}px ${Math.max(
          0,
          -selectionOverlayLeftPx
        )}px)`
      } as CSSProperties)
    : undefined;

  return (
    <div className="app-layout">
      <div className="container-fluid pt-3 pb-0 mb-0 app-shell">
        <div className="row g-3 app-main-row">
          <EditorSidebar
            canvasSize={canvasSize}
            transparentBackgroundMode={transparentBackgroundMode}
            previewDataUrl={previewDataUrl}
            tilePreviewDataUrl={tilePreviewDataUrl}
            tilePreviewSelection={tilePreviewSelection}
            selection={selection}
            tilePreviewLayerCount={tilePreviewLayers.length}
            tilePreviewLayers={tilePreviewLayerSummaries}
            tilePreviewBaseSize={tilePreviewBaseSize}
            hasTilePreviewCandidate={hasTilePreviewCandidate}
            clearTilePreviewLayers={clearTilePreviewLayers}
            reorderTilePreviewLayers={reorderTilePreviewLayers}
            removeTilePreviewLayer={removeTilePreviewLayer}
            tilePreviewFocusSequence={tilePreviewFocusSequence}
            animationPreviewDataUrl={animationPreviewDataUrl}
            animationFrames={animationFrames}
            animationPreviewIndex={animationPreviewIndex}
            animationPreviewFps={animationPreviewFps}
            isAnimationPreviewPlaying={isAnimationPreviewPlaying}
            isAnimationPreviewLoop={isAnimationPreviewLoop}
            addAnimationFrame={addAnimationFrame}
            clearAnimationFrames={clearAnimationFrames}
            selectAnimationFrame={selectAnimationFrame}
            moveAnimationFrame={moveAnimationFrame}
            removeAnimationFrame={removeAnimationFrame}
            toggleAnimationPreviewPlayback={toggleAnimationPreviewPlayback}
            setAnimationPreviewFps={updateAnimationPreviewFps}
            setAnimationPreviewLoop={setIsAnimationPreviewLoop}
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            applySelectedColorChange={applySelectedColorChange}
            palette={palette}
            paletteUsageByColor={paletteUsage.byColor}
            setHoveredPaletteColor={setHoveredPaletteColor}
            addPaletteColor={addPaletteColor}
            removeSelectedColorFromPalette={removeSelectedColorFromPalette}
            jumpToPaletteUsage={jumpToPaletteUsage}
            paletteColorModalRequest={paletteColorModalRequest}
          />

          <EditorCanvasWorkspace
            canvasStageRef={canvasStageRef}
            canvasRef={canvasRef}
            floatingPreviewCanvasRef={floatingPreviewCanvasRef}
            displaySize={displaySize}
            floatingStagePaddingPx={FLOATING_STAGE_PADDING_PX}
            transparentBackgroundClassName={transparentBackgroundClassName}
            isPanning={isPanning}
            isSpacePressed={isSpacePressed}
            onCanvasStageMouseDown={onCanvasStageMouseDown}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeaveCanvas={onMouseLeaveCanvas}
            selectionOverlaySelection={selectionOverlaySelection}
            selectionOverlayBaseStyle={selectionOverlayBaseStyle}
            selectionOverlayVisualStyle={selectionOverlayVisualStyle}
            isFloatingPasteActive={isFloatingPasteActive}
            zoom={zoom}
            floatingHandleOrder={FLOATING_HANDLE_ORDER}
            getFloatingHandleStyle={getFloatingHandleStyle}
            onFloatingOverlayMouseDown={onFloatingOverlayMouseDown}
            hoveredPixelInfo={hoveredPixelInfo}
            getPixelInfoFields={getPixelInfoFields}
            referencePixelInfos={referencePixelInfos}
            clearReferencePixelInfos={clearReferencePixelInfos}
            syncReferencePixelInfo={syncReferencePixelInfo}
            getReferenceKey={getReferenceKey}
            draggingReferenceKey={draggingReferenceKey}
            onReferenceDragStart={onReferenceDragStart}
            onReferenceDragEnd={onReferenceDragEnd}
            onReferenceDragOver={onReferenceDragOver}
            onReferenceDrop={onReferenceDrop}
            openReferencePaletteColorModal={openReferencePaletteColorModal}
            copyPixelField={copyPixelField}
            removeReferencePixelInfo={removeReferencePixelInfo}
            tool={tool}
            setTool={setTool}
            hasCommittedSelection={hasCommittedSelection}
            addAnimationFrame={addAnimationFrame}
            openSelectionRotateModal={openSelectionRotateModal}
            zoomIn={zoomIn}
            zoomOut={zoomOut}
            doUndo={doUndo}
            copySelection={copySelection}
            pasteSelection={pasteSelection}
            deleteSelection={deleteSelection}
          />
        </div>
        <div className={`status-toast ${isToastVisible ? 'show' : ''} ${toastType}`} role="status" aria-live="polite">
          {statusText}
        </div>
        <CanvasSizeModal
          isOpen={isCanvasSizeModalOpen}
          canvasSize={canvasSize}
          onApply={applyCanvasSize}
          onClose={closeCanvasSizeModal}
          onValidationError={(message) => setStatusText(message, 'warning')}
        />
        <GridSpacingModal
          isOpen={isGridSpacingModalOpen}
          gridSpacing={gridSpacing}
          canvasSize={canvasSize}
          onApply={applyGridSpacing}
          onClose={closeGridSpacingModal}
          onValidationError={(message) => setStatusText(message, 'warning')}
        />
        <ZoomModal
          isOpen={isZoomModalOpen}
          zoom={zoom}
          onApply={applyZoom}
          onClose={closeZoomModal}
          onValidationError={(message) => setStatusText(message, 'warning')}
        />
        <KMeansQuantizeModal
          isOpen={kMeansQuantizeRequest !== null}
          transparentBackgroundMode={transparentBackgroundMode}
          selection={kMeansQuantizeRequest?.selection ?? null}
          source={kMeansQuantizeRequest?.source ?? null}
          initialColorCount={kMeansQuantizeRequest?.initialColorCount ?? 1}
          onApply={applyKMeansQuantize}
          onClose={closeKMeansQuantizeModal}
          onValidationError={(message) => setStatusText(message, 'warning')}
        />
        <SelectionRotateModal
          isOpen={selectionRotateRequest !== null}
          transparentBackgroundMode={transparentBackgroundMode}
          selection={selectionRotateRequest?.selection ?? null}
          source={selectionRotateRequest?.source ?? null}
          onApply={applySelectionRotate}
          onClose={closeSelectionRotateModal}
          onValidationError={(message) => setStatusText(message, 'warning')}
        />
        <ConfirmModal
          isOpen={paletteRemovalRequest !== null}
          title="使用中の色を削除しますか？"
          confirmLabel="クリアして削除"
          onConfirm={() => {
            if (!paletteRemovalRequest) {
              return;
            }
            removePaletteColor(paletteRemovalRequest.color, true);
          }}
          onClose={() => setPaletteRemovalRequest(null)}
        >
          <p className="mb-2">
            <span className="font-monospace">{paletteRemovalRequest?.color.toUpperCase() ?? '-'}</span>
            {' '}はキャンバス上で{' '}
            <strong>{paletteRemovalRequest?.usedPixelCount.toLocaleString() ?? '0'} px</strong>
            {' '}使用されています。
          </p>
          <p className="mb-0 text-body-secondary">
            この色を削除すると、該当するピクセルはすべて透明になります。続けてよければ削除してください。
          </p>
        </ConfirmModal>
      </div>
      <footer className="container-fluid app-footer font-monospace small border-top">
        <div className="app-footer-status">
          <button
            type="button"
            className="app-footer-action"
            onClick={openCanvasSizeModal}
            aria-label="キャンバスサイズ変更を開く (⌘I)"
            title="キャンバスサイズ変更を開く (⌘I)"
          >
            キャンバス(⌘I):{canvasSize}x{canvasSize}
          </button>
          <button
            type="button"
            className="app-footer-action"
            onClick={openGridSpacingModal}
            aria-label="グリッド線間隔変更を開く (⌘G)"
            title="グリッド線間隔変更を開く (⌘G)"
          >
            グリッド線(⌘G):{gridSpacing === 0 ? 'なし' : `${gridSpacing}px 間隔`}
          </button>
          <button
            type="button"
            className="app-footer-action"
            onClick={openZoomModal}
            aria-label="表示倍率変更を開く (⌘R)"
            title="表示倍率変更を開く (⌘R)"
          >
            倍率(⌘R):{zoom}x
          </button>
          <span>
            ファイル:{currentFilePath ?? '未保存'}
            {hasUnsavedChanges ? ' *' : ''}
          </span>
        </div>
      </footer>
    </div>
  );
}
