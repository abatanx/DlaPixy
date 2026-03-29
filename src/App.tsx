/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useMemo, useRef, useState } from 'react';
import { EditorCanvasWorkspace } from './components/EditorCanvasWorkspace';
import { EditorModalLayer } from './components/EditorModalLayer';
import { EditorSidebar } from './components/EditorSidebar';
import { EditorStatusFooter } from './components/EditorStatusFooter';
import type { PaletteColorModalRequest } from './components/sidebar/types';
import { useCanvasSettings } from './hooks/useCanvasSettings';
import { useCanvasViewport } from './hooks/useCanvasViewport';
import { useCanvasPointerInteractions } from './hooks/useCanvasPointerInteractions';
import { useCanvasEditingCore } from './hooks/useCanvasEditingCore';
import { useDocumentFileActions } from './hooks/useDocumentFileActions';
import { useEditorShellUi } from './hooks/useEditorShellUi';
import { useFloatingSelectionState } from './hooks/useFloatingSelectionState';
import { usePaletteManagement } from './hooks/usePaletteManagement';
import { useEditorPreviews } from './hooks/useEditorPreviews';
import { useSelectionOperations } from './hooks/useSelectionOperations';
import { useSelectionOverlay } from './hooks/useSelectionOverlay';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { useFloatingPaste } from './hooks/useFloatingPaste';
import { usePixelReferences } from './hooks/usePixelReferences';
import { useUndoHistory } from './hooks/useUndoHistory';
import {
  DEFAULT_FLOATING_COMPOSITE_MODE,
  type FloatingCompositeMode
} from '../shared/floating-composite';
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
  MIN_CANVAS_SIZE
} from './editor/constants';
import type {
  PaletteEntry,
  Selection,
  Tool
} from './editor/types';
import type { DrawState } from './editor/canvas-pointer';
import {
  FLOATING_HANDLE_ORDER,
  FLOATING_STAGE_PADDING_PX,
  getFloatingHandleStyle
} from './editor/floating-interaction';
import { collectPaletteUsageFromPixels, type PaletteUsageAnalysis } from './editor/palette-sync';
import { clonePaletteEntries, createEmptyPixels, normalizePaletteEntries } from './editor/utils';

const INITIAL_PALETTE = normalizePaletteEntries(clonePaletteEntries(DEFAULT_PALETTE));
const INITIAL_SELECTED_COLOR = INITIAL_PALETTE[0]?.color ?? '#000000ff';
const CANVAS_FRAME_PX = 1;

// エディター全体の状態管理とイベント制御を担当するルートコンポーネント。
export function App() {
  // ---- UI / editor state ----
  const [canvasSize, setCanvasSize] = useState<number>(DEFAULT_CANVAS_SIZE);
  const [gridSpacing, setGridSpacing] = useState<number>(DEFAULT_GRID_SPACING);
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
  const [floatingCompositeMode, setFloatingCompositeMode] = useState<FloatingCompositeMode>(
    DEFAULT_FLOATING_COMPOSITE_MODE
  );
  const [transparentBackgroundMode, setTransparentBackgroundMode] = useState<TransparentBackgroundMode>(
    DEFAULT_TRANSPARENT_BACKGROUND_MODE
  );
  const [pixels, setPixels] = useState<Uint8ClampedArray>(() => createEmptyPixels(DEFAULT_CANVAS_SIZE));
  const [palette, setPalette] = useState<PaletteEntry[]>(INITIAL_PALETTE);
  const [selectedColor, setSelectedColor] = useState<string>(INITIAL_SELECTED_COLOR);
  const [tool, setTool] = useState<Tool>('select');
  const [selection, setSelection] = useState<Selection>(null);
  const [paletteColorModalRequest, setPaletteColorModalRequest] = useState<PaletteColorModalRequest>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | undefined>(undefined);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasStageRef = useRef<HTMLDivElement | null>(null);
  const canvasPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const {
    statusText,
    toastType,
    isToastVisible,
    setStatusText,
    transparentBackgroundClassName
  } = useEditorShellUi({
    hasUnsavedChanges,
    transparentBackgroundMode
  });
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
  const { selectionClipboardRef, floatingPasteRef, floatingResizeRef, clearFloatingPaste } = useFloatingSelectionState({
    drawStateRef
  });

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
  const {
    resolveCanvasPointFromClient,
    resolveCanvasCellFromClient,
    applyStrokeSegment,
    createFloodFillResult
  } = useCanvasEditingCore({
    canvasSize,
    gridSpacing,
    zoom,
    pixels,
    selectedColor,
    selection,
    canvasRef,
    setPixels,
    setHasUnsavedChanges
  });
  const { undoStackRef, pushUndo, doUndo } = useUndoHistory({
    canvasSize,
    pixels,
    selection,
    palette,
    selectedColor,
    clearFloatingPaste,
    resetAnimationFrames,
    setCanvasSize,
    setPixels,
    setSelection,
    setLastTilePreviewSelection,
    setPalette,
    setSelectedColor,
    setHasUnsavedChanges,
    setStatusText
  });
  const {
    paletteRemovalRequest,
    addPaletteColor,
    removeSelectedColorFromPalette,
    applySelectedColorChange,
    importGplPalette,
    exportGplPalette,
    confirmPaletteRemoval,
    closePaletteRemovalModal,
    syncPaletteAfterPaste
  } = usePaletteManagement({
    canvasSize,
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
    applyFloatingPasteBlock,
    liftSelectionToFloatingPaste,
    copySelection,
    pasteSelection,
    finalizeFloatingPaste,
    cancelFloatingPaste,
    nudgeFloatingPaste
  } = useFloatingPaste({
    canvasSize,
    floatingCompositeMode,
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
    zoom,
    palette,
    paletteUsageByColor: paletteUsage.byColor,
    floatingPasteRef,
    canvasStageRef,
    canvasRef,
    setSelection,
    setLastTilePreviewSelection,
    setSelectedColor,
    setPaletteColorModalRequest,
    setStatusText
  });
  const {
    kMeansQuantizeRequest,
    selectionRotateRequest,
    openSelectionRotateModal,
    closeSelectionRotateModal,
    applySelectionRotate,
    openKMeansQuantizeModal,
    closeKMeansQuantizeModal,
    applyKMeansQuantize,
    deleteSelection,
    selectEntireCanvas,
    clearSelection
  } = useSelectionOperations({
    canvasSize,
    palette,
    pixels,
    selectedColor,
    selection,
    floatingPasteRef,
    pushUndo,
    clearFloatingPaste,
    setPalette,
    setPixels,
    setSelectedColor,
    setSelection,
    setTool,
    setLastTilePreviewSelection,
    setHasUnsavedChanges,
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
  const {
    isCanvasSizeModalOpen,
    isGridSpacingModalOpen,
    isZoomModalOpen,
    applyCanvasSize,
    openCanvasSizeModal,
    closeCanvasSizeModal,
    applyGridSpacing,
    openGridSpacingModal,
    closeGridSpacingModal,
    openZoomModal,
    closeZoomModal
  } = useCanvasSettings({
    canvasSize,
    pushUndo,
    clearFloatingPaste,
    resetTilePreviewLayers,
    resetAnimationFrames,
    setCanvasSize,
    setPixels,
    setSelection,
    setLastTilePreviewSelection,
    setGridSpacing,
    setHasUnsavedChanges,
    setStatusText
  });
  const {
    hasCommittedSelection,
    selectionOverlaySelection,
    selectionOverlayBaseStyle
  } = useSelectionOverlay({
    selection,
    zoom,
    isFloatingPasteActive,
    canvasFramePx: CANVAS_FRAME_PX
  });

  const { savePng, saveAsPng, loadPng } = useDocumentFileActions({
    canvasSize,
    currentFilePath,
    floatingCompositeMode,
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
    setFloatingCompositeMode,
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

  const onValidationError = (message: string) => {
    setStatusText(message, 'warning');
  };

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
            isFloatingPasteActive={isFloatingPasteActive}
            floatingCompositeMode={floatingCompositeMode}
            setFloatingCompositeMode={setFloatingCompositeMode}
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
        <EditorModalLayer
          toast={{
            text: statusText,
            type: toastType,
            isVisible: isToastVisible
          }}
          canvasSizeModal={{
            isOpen: isCanvasSizeModalOpen,
            canvasSize,
            onApply: applyCanvasSize,
            onClose: closeCanvasSizeModal
          }}
          gridSpacingModal={{
            isOpen: isGridSpacingModalOpen,
            gridSpacing,
            canvasSize,
            onApply: applyGridSpacing,
            onClose: closeGridSpacingModal
          }}
          zoomModal={{
            isOpen: isZoomModalOpen,
            zoom,
            onApply: applyZoom,
            onClose: closeZoomModal
          }}
          transparentBackgroundMode={transparentBackgroundMode}
          kMeansQuantizeModal={{
            request: kMeansQuantizeRequest,
            onApply: applyKMeansQuantize,
            onClose: closeKMeansQuantizeModal
          }}
          selectionRotateModal={{
            request: selectionRotateRequest,
            onApply: applySelectionRotate,
            onClose: closeSelectionRotateModal
          }}
          paletteRemovalModal={{
            request: paletteRemovalRequest,
            onConfirm: confirmPaletteRemoval,
            onClose: closePaletteRemovalModal
          }}
          onValidationError={onValidationError}
        />
      </div>
      <EditorStatusFooter
        canvasSize={canvasSize}
        gridSpacing={gridSpacing}
        zoom={zoom}
        currentFilePath={currentFilePath}
        hasUnsavedChanges={hasUnsavedChanges}
        onOpenCanvasSizeModal={openCanvasSizeModal}
        onOpenGridSpacingModal={openGridSpacingModal}
        onOpenZoomModal={openZoomModal}
      />
    </div>
  );
}
