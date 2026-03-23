import { memo } from 'react';
import { SidebarPaletteSection } from './sidebar/SidebarPaletteSection';
import { SidebarPreviewSection } from './sidebar/SidebarPreviewSection';
import type { EditorSidebarProps } from './sidebar/types';

// プレビューと編集設定をまとめた左サイドパネル。
export const EditorSidebar = memo(function EditorSidebar({
  canvasSize,
  previewDataUrl,
  selectionTilePreviewDataUrl,
  tilePreviewSelection,
  selection,
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
  setHoveredPaletteColor,
  addPaletteColor,
  removeSelectedColorFromPalette,
  paletteColorModalRequest
}: EditorSidebarProps) {
  return (
    <aside className="col-12 col-lg-4 col-xl-3 editor-sidebar d-flex h-100">
      <div className="card shadow-sm editor-sidebar-card w-100 h-100 d-flex flex-column">
        <div className="card-body editor-sidebar-body d-flex flex-column overflow-hidden">
          <SidebarPreviewSection
            canvasSize={canvasSize}
            previewDataUrl={previewDataUrl}
            selectionTilePreviewDataUrl={selectionTilePreviewDataUrl}
            tilePreviewSelection={tilePreviewSelection}
            selection={selection}
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
          <SidebarPaletteSection
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            applySelectedColorChange={applySelectedColorChange}
            palette={palette}
            setHoveredPaletteColor={setHoveredPaletteColor}
            addPaletteColor={addPaletteColor}
            removeSelectedColorFromPalette={removeSelectedColorFromPalette}
            paletteColorModalRequest={paletteColorModalRequest}
          />
        </div>
      </div>
    </aside>
  );
});
