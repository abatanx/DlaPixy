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
  addColorToPalette,
  palette,
  setHoveredPaletteColor
}: EditorSidebarProps) {
  return (
    <aside className="col-12 col-lg-4 col-xl-3 editor-sidebar">
      <div className="card shadow-sm editor-sidebar-card">
        <div className="card-body editor-sidebar-body">
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
            addColorToPalette={addColorToPalette}
            palette={palette}
            setHoveredPaletteColor={setHoveredPaletteColor}
          />
        </div>
      </div>
    </aside>
  );
});
