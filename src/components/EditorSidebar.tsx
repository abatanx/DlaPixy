/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { memo } from 'react';
import { SidebarPaletteSection } from './sidebar/SidebarPaletteSection';
import { SidebarPreviewSection } from './sidebar/SidebarPreviewSection';
import { SidebarSliceSection } from './sidebar/SidebarSliceSection';
import type { EditorSidebarProps } from './sidebar/types';

// プレビューと編集設定をまとめた左サイドパネル。
export const EditorSidebar = memo(function EditorSidebar({
  tool,
  canvasSize,
  transparentBackgroundMode,
  previewDataUrl,
  tilePreviewDataUrl,
  tilePreviewSelection,
  selection,
  tilePreviewLayerCount,
  tilePreviewLayers,
  tilePreviewBaseSize,
  hasTilePreviewCandidate,
  clearTilePreviewLayers,
  reorderTilePreviewLayers,
  removeTilePreviewLayer,
  tilePreviewFocusSequence,
  animationPreviewDataUrl,
  animationFrames,
  animationPreviewIndex,
  animationPreviewFps,
  isAnimationPreviewPlaying,
  isAnimationPreviewLoop,
  addAnimationFrame,
  clearAnimationFrames,
  selectAnimationFrame,
  moveAnimationFrame,
  removeAnimationFrame,
  toggleAnimationPreviewPlayback,
  setAnimationPreviewFps,
  setAnimationPreviewLoop,
  slices,
  selectedSliceIds,
  activeSlice,
  selectSliceFromList,
  updateActiveSliceName,
  updateActiveSliceBounds,
  selectedColor,
  setSelectedColor,
  applySelectedColorChange,
  palette,
  displayPalette,
  paletteUsageByColor,
  setHoveredPaletteColor,
  addPaletteColor,
  removeSelectedColorFromPalette,
  jumpToPaletteUsage,
  paletteOrderMode,
  setPaletteOrderMode,
  paletteAutoSortKey,
  setPaletteAutoSortKey,
  canManualPaletteReorder,
  canApplyDisplayPaletteOrder,
  reorderPaletteEntries,
  applyDisplayPaletteOrder,
  paletteMergeSelection,
  paletteMergeDestinationId,
  togglePaletteMergeColor,
  clearPaletteMergeSelection,
  paletteColorModalRequest
}: EditorSidebarProps) {
  if (tool === 'slice') {
    return (
      <aside className="col-12 col-lg-4 col-xl-3 editor-sidebar d-flex flex-column h-100">
        <div className="card shadow-sm editor-sidebar-card editor-sidebar-palette-card w-100 d-flex flex-column h-100">
          <div className="card-body editor-sidebar-body d-flex flex-column overflow-auto">
            <SidebarSliceSection
              canvasSize={canvasSize}
              slices={slices}
              selectedSliceIds={selectedSliceIds}
              activeSlice={activeSlice}
              selectSliceFromList={selectSliceFromList}
              updateActiveSliceName={updateActiveSliceName}
              updateActiveSliceBounds={updateActiveSliceBounds}
            />
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="col-12 col-lg-4 col-xl-3 editor-sidebar d-flex flex-column h-100">
      <div className="card shadow-sm editor-sidebar-card editor-sidebar-preview-card w-100">
        <div className="card-body editor-sidebar-body">
          <SidebarPreviewSection
            canvasSize={canvasSize}
            transparentBackgroundMode={transparentBackgroundMode}
            previewDataUrl={previewDataUrl}
            tilePreviewDataUrl={tilePreviewDataUrl}
            tilePreviewSelection={tilePreviewSelection}
            selection={selection}
            tilePreviewLayerCount={tilePreviewLayerCount}
            tilePreviewLayers={tilePreviewLayers}
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
            setAnimationPreviewFps={setAnimationPreviewFps}
            setAnimationPreviewLoop={setAnimationPreviewLoop}
          />
        </div>
      </div>
      <div className="card shadow-sm editor-sidebar-card editor-sidebar-palette-card w-100 d-flex flex-column">
        <div className="card-body editor-sidebar-body d-flex flex-column overflow-hidden">
          <SidebarPaletteSection
            transparentBackgroundMode={transparentBackgroundMode}
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            applySelectedColorChange={applySelectedColorChange}
            palette={palette}
            displayPalette={displayPalette}
            paletteUsageByColor={paletteUsageByColor}
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
        </div>
      </div>
    </aside>
  );
});
