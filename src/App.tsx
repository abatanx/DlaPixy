import { useMemo, useRef, useState } from 'react';
import { EditorCanvasWorkspace } from './components/EditorCanvasWorkspace';
import { EditorSidebar } from './components/EditorSidebar';
import { CanvasSizeModal } from './components/modals/CanvasSizeModal';
import { ConfirmModal } from './components/modals/ConfirmModal';
import { GridSpacingModal } from './components/modals/GridSpacingModal';
import { KMeansQuantizeModal } from './components/modals/KMeansQuantizeModal';
import { SelectionRotateModal } from './components/modals/SelectionRotateModal';
import { ZoomModal } from './components/modals/ZoomModal';
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
  const floatingPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
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
    isFloatingPasteActive,
    canvasRef,
    floatingPreviewCanvasRef,
    floatingPasteRef,
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
    selectionOverlayBaseStyle,
    selectionOverlayVisualStyle
  } = useSelectionOverlay({
    selection,
    zoom,
    displaySize,
    isFloatingPasteActive,
    canvasFramePx: CANVAS_FRAME_PX
  });

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
