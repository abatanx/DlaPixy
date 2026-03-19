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
