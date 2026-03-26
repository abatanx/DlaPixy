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
import { usePaletteManagement } from './hooks/usePaletteManagement';
import { useEditorPreviews } from './hooks/useEditorPreviews';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { useFloatingPaste } from './hooks/useFloatingPaste';
import { usePixelReferences } from './hooks/usePixelReferences';
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
  PaletteEntry,
  Selection,
  Tool
} from './editor/types';
import type { ClipboardPixelBlock, FloatingPasteState } from './editor/floating-paste';
import type { DrawState } from './editor/canvas-pointer';
import { hasSamePaletteEntries, resolveNextSelectedColor } from './editor/app-utils';
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

const INITIAL_PALETTE = normalizePaletteEntries(clonePaletteEntries(DEFAULT_PALETTE));
const INITIAL_SELECTED_COLOR = INITIAL_PALETTE[0]?.color ?? '#000000ff';
const CANVAS_FRAME_PX = 1;

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
  const [statusText, setStatusTextRaw] = useState<string>('準備OK');
  const [toastType, setToastType] = useState<ToastType>('info');
  const [isToastVisible, setIsToastVisible] = useState<boolean>(false);
  const [toastSequence, setToastSequence] = useState<number>(0);
  const [paletteColorModalRequest, setPaletteColorModalRequest] = useState<PaletteColorModalRequest>(null);
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
  const transparentBackgroundClassName = getTransparentBackgroundSurfaceClassName(transparentBackgroundMode);

  useEffect(() => {
    document.title = `DlaPixy${hasUnsavedChanges ? ' *' : ''}`;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    void window.pixelApi.setTransparentBackgroundMode(transparentBackgroundMode).catch(() => undefined);
  }, [transparentBackgroundMode]);
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
  const {
    paletteRemovalRequest,
    addPaletteColor,
    removeSelectedColorFromPalette,
    applySelectedColorChange,
    importGplPalette,
    exportGplPalette,
    confirmPaletteRemoval,
    closePaletteRemovalModal
  } = usePaletteManagement({
    currentFilePath,
    palette,
    selectedColor,
    pixels,
    paletteUsageByColor: paletteUsage.byColor,
    pushUndo,
    setPalette,
    setSelectedColor,
    setPixels,
    setHasUnsavedChanges,
    setStatusText
  });

  const {
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
    setAnimationPreviewLoop,
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
  } = useEditorPreviews({
    canvasSize,
    pixels,
    selection,
    isFloatingPasteActive,
    setStatusText
  });

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
            setAnimationPreviewLoop={setAnimationPreviewLoop}
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
          onConfirm={confirmPaletteRemoval}
          onClose={closePaletteRemovalModal}
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
