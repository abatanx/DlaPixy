import { memo } from 'react';
import { SidebarPaletteSection } from './sidebar/SidebarPaletteSection';
import { SidebarPreviewSection } from './sidebar/SidebarPreviewSection';
import type { EditorSidebarProps } from './sidebar/types';

// プレビューと編集設定をまとめた左サイドパネル。
export const EditorSidebar = memo(function EditorSidebar({
  canvasSize,
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
  selectedColor,
  setSelectedColor,
  applySelectedColorChange,
  palette,
  paletteUsageByColor,
  setHoveredPaletteColor,
  addPaletteColor,
  removeSelectedColorFromPalette,
  jumpToPaletteUsage,
  paletteColorModalRequest
}: EditorSidebarProps) {
  return (
    <aside className="col-12 col-lg-4 col-xl-3 editor-sidebar d-flex flex-column h-100">
      <div className="card shadow-sm editor-sidebar-card editor-sidebar-preview-card w-100">
        <div className="card-body editor-sidebar-body">
          <SidebarPreviewSection
            canvasSize={canvasSize}
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
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            applySelectedColorChange={applySelectedColorChange}
            palette={palette}
            paletteUsageByColor={paletteUsageByColor}
            setHoveredPaletteColor={setHoveredPaletteColor}
            addPaletteColor={addPaletteColor}
            removeSelectedColorFromPalette={removeSelectedColorFromPalette}
            jumpToPaletteUsage={jumpToPaletteUsage}
            paletteColorModalRequest={paletteColorModalRequest}
          />
        </div>
      </div>
    </aside>
  );
});
