import type { Selection } from '../editor/types';

type EditorSidebarProps = {
  canvasSize: number;
  previewDataUrl: string;
  selectionTilePreviewDataUrl: string;
  tilePreviewSelection: Selection;
  selection: Selection;
  selectedColor: string;
  setSelectedColor: (value: string) => void;
  addColorToPalette: (hex: string) => void;
  palette: string[];
  setHoveredPaletteColor: (value: { hex: string; index: number } | null) => void;
};

// プレビューと編集設定をまとめた左サイドパネル。
export function EditorSidebar({
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
          <div className="mb-3">
            <h6 className="form-label small mb-1 font-monospace">Preview (1x)</h6>
            <div className="preview-wrap">
              {previewDataUrl ? (
                <img
                  src={previewDataUrl}
                  alt="PNG Preview"
                  className="preview-image"
                  width={canvasSize}
                  height={canvasSize}
                />
              ) : null}
            </div>
            <h6 className="form-label small my-1 font-monospace">Tiling</h6>
            <div className="preview-wrap tile-preview-wrap">
              {selectionTilePreviewDataUrl ? (
                <img
                  src={selectionTilePreviewDataUrl}
                  alt="Selection 3x3 Tile Preview"
                  className="preview-image tile-preview-image"
                />
              ) : (
                <div className="preview-placeholder">矩形選択するとここに3x3タイル表示</div>
              )}
            </div>
            <div className="form-text">
              {tilePreviewSelection
                ? `${tilePreviewSelection.w}x${tilePreviewSelection.h} を3x3で表示${selection ? ' (現在選択中)' : ' (最終選択範囲)'}`
                : '選択範囲なし'}
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label">色</label>
            <input
              type="color"
              className="form-control form-control-color mb-2"
              value={selectedColor}
              onChange={(e) => {
                setSelectedColor(e.target.value);
                addColorToPalette(e.target.value);
              }}
            />
            <div className="palette-grid">
              {palette.map((color, index) => (
                <button
                  key={`${color}-${index}`}
                  type="button"
                  className={`palette-item ${selectedColor === color ? 'active' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                  onMouseEnter={() => setHoveredPaletteColor({ hex: color, index })}
                  onMouseLeave={() => setHoveredPaletteColor(null)}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
