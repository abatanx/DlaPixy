/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { EditorCanvasWorkspace } from './components/EditorCanvasWorkspace';
import { EditorModalLayer } from './components/EditorModalLayer';
import { EditorPaletteMergeBar } from './components/EditorPaletteMergeBar';
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
import { usePaletteMergeSelection } from './hooks/usePaletteMergeSelection';
import { usePaletteOrdering } from './hooks/usePaletteOrdering';
import { useEditorPreviews } from './hooks/useEditorPreviews';
import { useSelectionOperations } from './hooks/useSelectionOperations';
import { useSelectionOverlay } from './hooks/useSelectionOverlay';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { useFloatingPaste } from './hooks/useFloatingPaste';
import { usePixelReferences } from './hooks/usePixelReferences';
import { useSliceMode } from './hooks/useSliceMode';
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
  EditorSlice,
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
import { SLICE_CANVAS_EDGE_HIT_PADDING_PX, SLICE_RESIZE_HANDLE_ORDER } from './editor/slices';
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
  const [slices, setSlices] = useState<EditorSlice[]>([]);
  const [selectedSliceIds, setSelectedSliceIds] = useState<string[]>([]);
  const [activeSliceId, setActiveSliceId] = useState<string | null>(null);
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
    disabled: tool === 'slice',
    setStatusText
  });
  const {
    resolveCanvasPointFromClient,
    resolveCanvasCellFromClient,
    resolveCanvasClampedCellFromClient,
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
    slices,
    selectedSliceIds,
    activeSliceId,
    selectedColor,
    clearFloatingPaste,
    resetAnimationFrames,
    setCanvasSize,
    setPixels,
    setSelection,
    setLastTilePreviewSelection,
    setPalette,
    setSlices,
    setSelectedSliceIds,
    setActiveSliceId,
    setSelectedColor,
    setHasUnsavedChanges,
    setStatusText
  });
  const {
    isSliceMode,
    orderedSlices,
    draftSlice,
    selectionMarquee,
    activeSlice,
    canDeleteSlices,
    resetSliceUiState,
    clearSliceSelection,
    nudgeSelectedSlices,
    selectAllSlices,
    selectSliceFromList,
    deleteSelectedSlices,
    copySelectedSlices,
    pasteSlices,
    duplicateSelectedSlices,
    updateActiveSliceName,
    updateActiveSliceBounds,
    updateSelectedSliceSize,
    beginCanvasInteractionFromClient,
    onCanvasMouseDown: onSliceCanvasMouseDown,
    onSliceMouseDown,
    onSliceHandleMouseDown,
    onMouseMoveCanvas: onSliceMouseMoveCanvas,
    onMouseUpCanvas: onSliceMouseUpCanvas,
    onMouseLeaveCanvas: onSliceMouseLeaveCanvas
  } = useSliceMode({
    canvasSize,
    tool,
    slices,
    selectedSliceIds,
    activeSliceId,
    pushUndo,
    clearFloatingPaste,
    setSlices,
    setSelectedSliceIds,
    setActiveSliceId,
    setSelection,
    setHasUnsavedChanges,
    setStatusText,
    resolveCanvasCellFromClient,
    resolveCanvasClampedCellFromClient
  });
  const {
    paletteRemovalRequest,
    addPaletteColor,
    removeSelectedColorFromPalette,
    removePaletteColors,
    mergePaletteColors,
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
    paletteMergeSelection,
    paletteMergeDestinationId,
    showPaletteMergeUi,
    clearPaletteMergeSelection,
    togglePaletteMergeColor,
    selectPaletteMergeDestination,
    removePaletteMergeColor
  } = usePaletteMergeSelection({
    palette,
    selectedColor,
    setSelectedColor
  });
  const {
    paletteOrderMode,
    setPaletteOrderMode,
    paletteAutoSortKey,
    setPaletteAutoSortKey,
    displayPalette,
    canManualPaletteReorder,
    canApplyDisplayPaletteOrder,
    reorderPaletteEntries,
    applyDisplayPaletteOrder,
    resetPaletteOrderViewState
  } = usePaletteOrdering({
    palette,
    paletteMergeSelection,
    pushUndo,
    setPalette,
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
    displayPalette,
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
    slices,
    pushUndo,
    clearFloatingPaste,
    resetTilePreviewLayers,
    resetAnimationFrames,
    resetSliceUiState,
    setCanvasSize,
    setPixels,
    setSlices,
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
    canvasFramePx: CANVAS_FRAME_PX,
    disabled: isSliceMode
  });

  const { savePng, saveAsPng, loadPng } = useDocumentFileActions({
    canvasSize,
    currentFilePath,
    floatingCompositeMode,
    gridSpacing,
    hasUnsavedChanges,
    palette,
    slices,
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
    setSlices,
    setSelectedColor,
    setTool,
    setGridSpacing,
    setZoom,
    setTransparentBackgroundMode,
    setViewportRestoreSequence,
    setHasUnsavedChanges,
    resetTilePreviewLayers,
    resetAnimationFrames,
    resetPaletteOrderViewState,
    resetSliceUiState,
    clearFloatingPaste,
    setStatusText
  });

  useEditorShortcuts({
    selectionRotateRequestActive: selectionRotateRequest !== null,
    hasSelection: selection !== null,
    hasSelectedSlices: selectedSliceIds.length > 0,
    floatingPasteRef,
    tool,
    setTool,
    setTransparentBackgroundMode,
    setStatusText,
    clearSelection,
    clearSliceSelection,
    doUndo,
    copySelection,
    copySelectedSlices,
    pasteSelection,
    pasteSlices,
    selectEntireCanvas,
    selectAllSlices,
    deleteSelection,
    deleteSelectedSlices,
    duplicateSelectedSlices,
    selectReferenceByNumber,
    finalizeFloatingPaste,
    cancelFloatingPaste,
    nudgeFloatingPaste,
    nudgeSelectedSlices,
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

  const handleCanvasMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      if (!isSliceMode || (!isSpacePressed && !isPanning)) {
        onSliceCanvasMouseDown(event);
      }
      onMouseDown(event);
    },
    [isPanning, isSliceMode, isSpacePressed, onMouseDown, onSliceCanvasMouseDown]
  );

  const handleCanvasStageMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (
        isSliceMode &&
        !isSpacePressed &&
        !isPanning &&
        event.target === event.currentTarget &&
        canvasRef.current
      ) {
        const rect = canvasRef.current.getBoundingClientRect();
        const isWithinExpandedCanvas =
          event.clientX >= rect.left - SLICE_CANVAS_EDGE_HIT_PADDING_PX &&
          event.clientX <= rect.right + SLICE_CANVAS_EDGE_HIT_PADDING_PX &&
          event.clientY >= rect.top - SLICE_CANVAS_EDGE_HIT_PADDING_PX &&
          event.clientY <= rect.bottom + SLICE_CANVAS_EDGE_HIT_PADDING_PX;

        if (isWithinExpandedCanvas) {
          beginCanvasInteractionFromClient(event.clientX, event.clientY, {
            shiftKey: event.shiftKey,
            preserveSelection: event.metaKey || event.ctrlKey
          });
        }
      }

      onCanvasStageMouseDown(event);
    },
    [beginCanvasInteractionFromClient, isPanning, isSliceMode, isSpacePressed, onCanvasStageMouseDown]
  );

  const handleCanvasMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      onSliceMouseMoveCanvas(event.clientX, event.clientY);
      onMouseMove(event);
    },
    [onMouseMove, onSliceMouseMoveCanvas]
  );

  const handleCanvasMouseUp = useCallback(() => {
    onSliceMouseUpCanvas();
    onMouseUp();
  }, [onMouseUp, onSliceMouseUpCanvas]);

  const handleCanvasMouseLeave = useCallback(() => {
    onSliceMouseLeaveCanvas();
    onMouseLeaveCanvas();
  }, [onMouseLeaveCanvas, onSliceMouseLeaveCanvas]);

  const handleContextualCopy = useCallback(async () => {
    if (isSliceMode) {
      copySelectedSlices();
      return;
    }
    await copySelection();
  }, [copySelectedSlices, copySelection, isSliceMode]);

  const handleContextualPaste = useCallback(() => {
    if (isSliceMode) {
      pasteSlices();
      return;
    }
    pasteSelection();
  }, [isSliceMode, pasteSelection, pasteSlices]);

  const handleContextualDelete = useCallback(() => {
    if (isSliceMode) {
      deleteSelectedSlices();
      return;
    }
    deleteSelection();
  }, [deleteSelectedSlices, deleteSelection, isSliceMode]);

  return (
    <div className="app-layout">
      <div className="container-fluid pt-3 pb-0 mb-0 app-shell">
        <div className="row g-3 app-main-row">
          <EditorSidebar
            tool={tool}
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
            slices={orderedSlices}
            selectedSliceIds={selectedSliceIds}
            activeSlice={activeSlice}
            selectSliceFromList={selectSliceFromList}
            updateActiveSliceName={updateActiveSliceName}
            updateActiveSliceBounds={updateActiveSliceBounds}
            updateSelectedSliceSize={updateSelectedSliceSize}
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            applySelectedColorChange={applySelectedColorChange}
            palette={palette}
            displayPalette={displayPalette}
            paletteUsageByColor={paletteUsage.byColor}
            setHoveredPaletteColor={setHoveredPaletteColor}
            addPaletteColor={addPaletteColor}
            removeSelectedColorFromPalette={removeSelectedColorFromPalette}
            jumpToPaletteUsage={jumpToPaletteUsage}
            paletteOrderMode={paletteOrderMode}
            setPaletteOrderMode={setPaletteOrderMode}
            paletteAutoSortKey={paletteAutoSortKey}
            setPaletteAutoSortKey={setPaletteAutoSortKey}
            canManualPaletteReorder={canManualPaletteReorder}
            canApplyDisplayPaletteOrder={canApplyDisplayPaletteOrder}
            reorderPaletteEntries={reorderPaletteEntries}
            applyDisplayPaletteOrder={applyDisplayPaletteOrder}
            paletteMergeSelection={paletteMergeSelection}
            paletteMergeDestinationId={paletteMergeDestinationId}
            togglePaletteMergeColor={togglePaletteMergeColor}
            clearPaletteMergeSelection={clearPaletteMergeSelection}
            paletteColorModalRequest={paletteColorModalRequest}
          />
          <div className="col-12 col-lg-8 col-xl-9 d-flex flex-column gap-3 editor-workspace-column">
            {!isSliceMode && showPaletteMergeUi ? (
              <EditorPaletteMergeBar
                palette={displayPalette}
                paletteUsageByColor={paletteUsage.byColor}
                paletteMergeSelection={paletteMergeSelection}
                paletteMergeDestinationId={paletteMergeDestinationId}
                selectPaletteMergeDestination={selectPaletteMergeDestination}
                removePaletteMergeColor={removePaletteMergeColor}
                clearPaletteMergeSelection={clearPaletteMergeSelection}
                removePaletteColors={removePaletteColors}
                mergePaletteColors={mergePaletteColors}
              />
            ) : null}
            <EditorCanvasWorkspace
              canvasStageRef={canvasStageRef}
              canvasRef={canvasRef}
              displaySize={displaySize}
              floatingStagePaddingPx={FLOATING_STAGE_PADDING_PX}
              transparentBackgroundClassName={transparentBackgroundClassName}
              isPanning={isPanning}
              isSpacePressed={isSpacePressed}
              onCanvasStageMouseDown={handleCanvasStageMouseDown}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeaveCanvas={handleCanvasMouseLeave}
              slices={slices}
              draftSlice={draftSlice}
              selectionMarquee={selectionMarquee}
              selectedSliceIds={selectedSliceIds}
              activeSliceId={activeSliceId}
              onSliceMouseDown={onSliceMouseDown}
              onSliceHandleMouseDown={onSliceHandleMouseDown}
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
              hasCommittedSelection={!isSliceMode && hasCommittedSelection}
              canDeleteAction={isSliceMode ? canDeleteSlices : hasCommittedSelection}
              addAnimationFrame={addAnimationFrame}
              openSelectionRotateModal={openSelectionRotateModal}
              zoomIn={zoomIn}
              zoomOut={zoomOut}
              doUndo={doUndo}
              copySelection={handleContextualCopy}
              pasteSelection={handleContextualPaste}
              deleteSelection={handleContextualDelete}
            />
          </div>
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
