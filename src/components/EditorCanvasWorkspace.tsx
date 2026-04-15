/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import {
  useCallback,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type MutableRefObject,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  FLOATING_COMPOSITE_MODE_LABELS,
  FLOATING_COMPOSITE_MODES
} from '../../shared/floating-composite';
import {
  FLOATING_SCALE_MODE_LABELS,
  FLOATING_SCALE_MODES
} from '../../shared/floating-scale-mode';
import { EditorToolbar } from './EditorToolbar';
import type { FloatingResizeHandle } from '../editor/floating-interaction';
import {
  SLICE_RESIZE_HANDLE_ORDER,
  isClientInsideCanvasRect,
  isClientWithinCanvasMargin,
  getSliceHandleStyle,
  type SliceResizeHandle
} from '../editor/slices';
import { getEnabledSliceExportTargets } from '../../shared/slice';
import { SliceExportTargetMarks } from './SliceExportTargetMarks';
import type { EditorSlice, FloatingCompositeMode, FloatingScaleMode, HoveredPixelInfo, Selection, Tool } from '../editor/types';

type PixelInfoFields = {
  rgba: string;
  hex8: string;
  hsva: string;
  paletteIndex: string;
  paletteCaption: string;
};

type EditorCanvasWorkspaceProps = {
  canvasStageRef: MutableRefObject<HTMLDivElement | null>;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  displaySize: number;
  canvasStageVisibleMarginPx: number;
  transparentBackgroundClassName: string;
  isPanning: boolean;
  isSpacePressed: boolean;
  onCanvasStageMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onMouseDown: (event: ReactMouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (event: ReactMouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: () => void;
  onMouseLeaveCanvas: () => void;
  slices: EditorSlice[];
  draftSlice: Omit<EditorSlice, 'id' | 'name'> | null;
  selectionMarquee: Omit<EditorSlice, 'id' | 'name'> | null;
  selectedSliceIds: string[];
  activeSliceId: string | null;
  onSliceMouseDown: (event: ReactMouseEvent<HTMLDivElement>, sliceId: string) => void;
  onSliceHandleMouseDown: (event: ReactMouseEvent<HTMLButtonElement>, sliceId: string, handle: SliceResizeHandle) => void;
  selectionOverlaySelection: Selection;
  selectionOverlayBaseStyle?: CSSProperties;
  isFloatingPasteActive: boolean;
  floatingCompositeMode: FloatingCompositeMode;
  setFloatingCompositeMode: (mode: FloatingCompositeMode) => void;
  floatingScaleMode: FloatingScaleMode;
  setFloatingScaleMode: (mode: FloatingScaleMode) => void;
  zoom: number;
  floatingHandleOrder: FloatingResizeHandle[];
  getFloatingHandleStyle: (handle: FloatingResizeHandle) => CSSProperties;
  onFloatingOverlayMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
  hoveredPixelInfo: HoveredPixelInfo;
  getPixelInfoFields: (info: NonNullable<HoveredPixelInfo>) => PixelInfoFields;
  referencePixelInfos: Array<NonNullable<HoveredPixelInfo>>;
  clearReferencePixelInfos: () => void;
  syncReferencePixelInfo: (info: NonNullable<HoveredPixelInfo>) => NonNullable<HoveredPixelInfo>;
  getReferenceKey: (info: NonNullable<HoveredPixelInfo>) => string;
  draggingReferenceKey: string | null;
  onReferenceDragStart: (event: ReactDragEvent<HTMLDivElement>, sourceKey: string) => void;
  onReferenceDragEnd: () => void;
  onReferenceDragOver: (event: ReactDragEvent<HTMLDivElement>) => void;
  onReferenceDrop: (event: ReactDragEvent<HTMLDivElement>, targetKey: string) => void;
  openReferencePaletteColorModal: (info: NonNullable<HoveredPixelInfo>) => void;
  copyPixelField: (label: string, value: string) => Promise<void>;
  removeReferencePixelInfo: (referenceKey: string) => void;
  tool: Tool;
  setTool: (tool: Tool) => void;
  activateSliceTool: () => boolean;
  hasCommittedSelection: boolean;
  canDeleteAction: boolean;
  addAnimationFrame: () => void;
  openSelectionRotateModal: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  doUndo: () => void;
  copySelection: () => Promise<void>;
  pasteSelection: () => void;
  deleteSelection: () => void;
};

export function EditorCanvasWorkspace({
  canvasStageRef,
  canvasRef,
  displaySize,
  canvasStageVisibleMarginPx,
  transparentBackgroundClassName,
  isPanning,
  isSpacePressed,
  onCanvasStageMouseDown,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeaveCanvas,
  slices,
  draftSlice,
  selectionMarquee,
  selectedSliceIds,
  activeSliceId,
  onSliceMouseDown,
  onSliceHandleMouseDown,
  selectionOverlaySelection,
  selectionOverlayBaseStyle,
  isFloatingPasteActive,
  floatingCompositeMode,
  setFloatingCompositeMode,
  floatingScaleMode,
  setFloatingScaleMode,
  zoom,
  floatingHandleOrder,
  getFloatingHandleStyle,
  onFloatingOverlayMouseDown,
  hoveredPixelInfo,
  getPixelInfoFields,
  referencePixelInfos,
  clearReferencePixelInfos,
  syncReferencePixelInfo,
  getReferenceKey,
  draggingReferenceKey,
  onReferenceDragStart,
  onReferenceDragEnd,
  onReferenceDragOver,
  onReferenceDrop,
  openReferencePaletteColorModal,
  copyPixelField,
  removeReferencePixelInfo,
  tool,
  setTool,
  activateSliceTool,
  hasCommittedSelection,
  canDeleteAction,
  addAnimationFrame,
  openSelectionRotateModal,
  zoomIn,
  zoomOut,
  doUndo,
  copySelection,
  pasteSelection,
  deleteSelection
}: EditorCanvasWorkspaceProps) {
  const [isSliceCreateHotzoneHovered, setIsSliceCreateHotzoneHovered] = useState(false);
  const stopFloatingOverlayControlPointerDown = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const selectedSliceIdSet = new Set(selectedSliceIds);
  const isSlicePanPassThrough = tool === 'slice' && (isSpacePressed || isPanning);
  const updateSliceCreateHotzoneHover = useCallback(
    (clientX: number, clientY: number) => {
      if (tool !== 'slice' || isSpacePressed || isPanning || !canvasRef.current) {
        setIsSliceCreateHotzoneHovered(false);
        return;
      }

      const rect = canvasRef.current.getBoundingClientRect();
      const isWithinExpandedCanvas = isClientWithinCanvasMargin(
        rect,
        clientX,
        clientY,
        canvasStageVisibleMarginPx
      );
      const isInsideVisibleCanvas = isClientInsideCanvasRect(rect, clientX, clientY);

      setIsSliceCreateHotzoneHovered(isWithinExpandedCanvas && !isInsideVisibleCanvas);
    },
    [canvasRef, canvasStageVisibleMarginPx, isPanning, isSpacePressed, tool]
  );
  const onCanvasStageMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      updateSliceCreateHotzoneHover(event.clientX, event.clientY);
    },
    [updateSliceCreateHotzoneHover]
  );
  const onCanvasStageMouseLeave = useCallback(() => {
    setIsSliceCreateHotzoneHovered(false);
  }, []);

  return (
    <main className="editor-workspace d-flex flex-column flex-grow-1">
      <div className="card shadow-sm editor-card flex-grow-1">
        <div
          ref={canvasStageRef}
          className={`card-body d-flex canvas-stage canvas-stage-with-toolbar ${isPanning ? 'is-panning' : ''} ${
            isSliceCreateHotzoneHovered ? 'is-slice-create-hotzone' : ''
          }`}
          style={{ '--canvas-stage-visible-margin': `${canvasStageVisibleMarginPx}px` } as CSSProperties}
          onMouseDown={onCanvasStageMouseDown}
          onMouseMove={onCanvasStageMouseMove}
          onMouseLeave={onCanvasStageMouseLeave}
        >
          <div className="canvas-surface">
            <canvas
              ref={canvasRef}
              width={displaySize}
              height={displaySize}
              className={`pixel-canvas ${transparentBackgroundClassName} ${isPanning ? 'is-panning' : isSpacePressed ? 'is-space-pan' : ''}`}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseLeaveCanvas}
            />
            {tool === 'slice'
              ? slices.map((slice) => {
                  const isSelected = selectedSliceIdSet.has(slice.id);
                  const isActive = activeSliceId === slice.id;
                  const enabledTargets = getEnabledSliceExportTargets(slice);
                  return (
                    <div
                      key={slice.id}
                      className={`canvas-slice-overlay ${isSelected ? 'is-selected' : ''} ${isActive ? 'is-active' : ''} ${
                        isSlicePanPassThrough ? 'is-pan-pass-through' : ''
                      }`}
                      style={{
                        left: `${slice.x * zoom + 1}px`,
                        top: `${slice.y * zoom + 1}px`,
                        width: `${slice.w * zoom}px`,
                        height: `${slice.h * zoom}px`
                      }}
                      onMouseDown={(event) => onSliceMouseDown(event, slice.id)}
                    >
                      <div
                        className="canvas-slice-hit-area"
                        aria-hidden="true"
                      />
                      <div className="canvas-slice-center-stack">
                        <span className="canvas-slice-label corner">
                          {slice.name || 'slice'}
                        </span>
                        <SliceExportTargetMarks
                          targets={enabledTargets}
                          className="canvas-slice-targets"
                        />
                      </div>
                      <span className="canvas-slice-label top">{slice.w}</span>
                      <span className="canvas-slice-label left">{slice.h}</span>
                      {isActive && selectedSliceIds.length === 1
                        ? SLICE_RESIZE_HANDLE_ORDER.map((handle) => (
                            <button
                              key={handle}
                              type="button"
                              className="canvas-slice-handle"
                              data-handle={handle}
                              aria-label={`slice-resize-${handle}`}
                              style={getSliceHandleStyle(handle)}
                              onMouseDown={(event) => onSliceHandleMouseDown(event, slice.id, handle)}
                              tabIndex={-1}
                            />
                          ))
                        : null}
                    </div>
                  );
                })
              : null}
            {tool === 'slice' && draftSlice ? (
              <div
                className={`canvas-slice-overlay is-draft ${isSlicePanPassThrough ? 'is-pan-pass-through' : ''}`}
                style={{
                  left: `${draftSlice.x * zoom + 1}px`,
                  top: `${draftSlice.y * zoom + 1}px`,
                  width: `${draftSlice.w * zoom}px`,
                  height: `${draftSlice.h * zoom}px`
                }}
                aria-hidden="true"
              />
            ) : null}
            {tool === 'slice' && selectionMarquee ? (
              <div
                className={`canvas-slice-selection-marquee ${isSlicePanPassThrough ? 'is-pan-pass-through' : ''}`}
                style={{
                  left: `${selectionMarquee.x * zoom + 1}px`,
                  top: `${selectionMarquee.y * zoom + 1}px`,
                  width: `${selectionMarquee.w * zoom}px`,
                  height: `${selectionMarquee.h * zoom}px`
                }}
                aria-hidden="true"
              />
            ) : null}
            {selectionOverlaySelection ? (
              <>
                <div
                  className={`canvas-selection-overlay ${isFloatingPasteActive ? 'is-floating' : 'is-static'}`}
                  style={selectionOverlayBaseStyle}
                  onMouseDown={isFloatingPasteActive ? onFloatingOverlayMouseDown : undefined}
                >
                  {isFloatingPasteActive
                    ? floatingHandleOrder.map((handle) => (
                        <button
                          key={handle}
                          type="button"
                          className="canvas-floating-handle"
                          data-handle={handle}
                          aria-label={`resize-${handle}`}
                          style={getFloatingHandleStyle(handle)}
                          tabIndex={-1}
                        />
                      ))
                    : null}
                  <span className="canvas-selection-size-label corner">
                    {selectionOverlaySelection.x},{selectionOverlaySelection.y}
                  </span>
                  <span className="canvas-selection-size-label top">{selectionOverlaySelection.w}</span>
                  <span className="canvas-selection-size-label bottom">{selectionOverlaySelection.w}</span>
                  <span className="canvas-selection-size-label left">{selectionOverlaySelection.h}</span>
                  <span className="canvas-selection-size-label right">{selectionOverlaySelection.h}</span>
                  {isFloatingPasteActive ? (
                    <div
                      className="canvas-floating-overlay-controls"
                      onMouseDown={stopFloatingOverlayControlPointerDown}
                    >
                      <div
                        className="btn-group btn-group-sm canvas-floating-mode-toggle"
                        role="group"
                        aria-label="floating-composite-mode"
                      >
                        {FLOATING_COMPOSITE_MODES.map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            className={`btn ${
                              floatingCompositeMode === mode ? 'btn-danger active' : 'btn-light'
                            }`}
                            aria-pressed={floatingCompositeMode === mode}
                            onClick={() => setFloatingCompositeMode(mode)}
                          >
                            {FLOATING_COMPOSITE_MODE_LABELS[mode]}
                          </button>
                        ))}
                      </div>
                      <div
                        className="btn-group btn-group-sm canvas-floating-mode-toggle canvas-floating-scale-toggle"
                        role="group"
                        aria-label="floating-scale-mode"
                      >
                        {FLOATING_SCALE_MODES.map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            className={`btn ${
                              floatingScaleMode === mode ? 'btn-danger active' : 'btn-light'
                            }`}
                            aria-pressed={floatingScaleMode === mode}
                            onClick={() => setFloatingScaleMode(mode)}
                          >
                            {FLOATING_SCALE_MODE_LABELS[mode]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
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
                  <span className="canvas-data-field">RGBA: {fields.rgba}</span>
                  <span className="canvas-data-field">HEX8: {fields.hex8}</span>
                  <span className="canvas-data-field">HSVA: {fields.hsva}</span>
                  <span className="canvas-data-field">PaletteIndex: {fields.paletteIndex}</span>
                  <span className="canvas-data-field">Caption: {fields.paletteCaption}</span>
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
              <span className="canvas-data-field">Caption: -</span>
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
                const syncedInfo = syncReferencePixelInfo(info);
                const fields = getPixelInfoFields(syncedInfo);
                const referenceKey = getReferenceKey(info);
                const lineNumber = index < 9 ? String(index + 1) : '-';

                return (
                  <div
                    key={referenceKey}
                    className={`canvas-reference-line ${draggingReferenceKey === referenceKey ? 'is-dragging' : ''}`}
                    title={syncedInfo.hex8}
                    draggable
                    onDragStart={(event) => onReferenceDragStart(event, referenceKey)}
                    onDragEnd={onReferenceDragEnd}
                    onDragOver={onReferenceDragOver}
                    onDrop={(event) => onReferenceDrop(event, referenceKey)}
                  >
                    <span className="canvas-reference-number">{lineNumber}</span>
                    <span
                      className="canvas-reference-swatch"
                      onDoubleClick={() => openReferencePaletteColorModal(info)}
                      title="ダブルクリックで色モーダルを開く"
                      aria-label="ダブルクリックで色モーダルを開く"
                    >
                      <span
                        className="canvas-hover-swatch-color"
                        style={{
                          backgroundColor: `rgba(${syncedInfo.rgba.r}, ${syncedInfo.rgba.g}, ${syncedInfo.rgba.b}, ${syncedInfo.rgba.a / 255})`
                        }}
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
                    <span className="canvas-reference-text canvas-data-field">
                      Caption: {fields.paletteCaption}
                      <button
                        type="button"
                        className="canvas-copy-btn"
                        onClick={() => void copyPixelField('Caption', fields.paletteCaption)}
                        title="Captionをコピー"
                        aria-label="Captionをコピー"
                      >
                        <i className="fa-regular fa-copy" aria-hidden="true" />
                      </button>
                    </span>
                    <button
                      type="button"
                      className="canvas-copy-btn"
                      onClick={() => removeReferencePixelInfo(referenceKey)}
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
          activateSliceTool={activateSliceTool}
          canAddAnimationFrame={hasCommittedSelection}
          canDeleteSelection={canDeleteAction}
          addAnimationFrame={addAnimationFrame}
          canRotateSelection={hasCommittedSelection}
          openSelectionRotateModal={openSelectionRotateModal}
          zoom={zoom}
          zoomIn={zoomIn}
          zoomOut={zoomOut}
          doUndo={doUndo}
          copySelection={copySelection}
          pasteSelection={pasteSelection}
          deleteSelection={deleteSelection}
        />
      </div>
    </main>
  );
}
