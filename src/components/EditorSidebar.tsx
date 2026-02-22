import { GRID_SPACING_OPTIONS, MAX_CANVAS_SIZE, MIN_CANVAS_SIZE } from '../editor/constants';
import type { Selection } from '../editor/types';

type EditorSidebarProps = {
  canvasSize: number;
  previewDataUrl: string;
  selectionTilePreviewDataUrl: string;
  tilePreviewSelection: Selection;
  selection: Selection;
  pendingCanvasSize: string;
  setPendingCanvasSize: (value: string) => void;
  applyCanvasSize: () => void;
  gridSpacing: number;
  updateGridSpacing: (value: number) => void;
  selectedColor: string;
  setSelectedColor: (value: string) => void;
  addColorToPalette: (hex: string) => void;
  palette: string[];
  setHoveredPaletteColor: (value: { hex: string; index: number } | null) => void;
  savePng: () => Promise<void>;
  saveAsPng: () => Promise<void>;
  loadPng: () => Promise<void>;
  zoom: number;
  currentFilePath?: string;
  hasUnsavedChanges: boolean;
};

// プレビュー・設定・保存読込をまとめた左サイドパネル。
export function EditorSidebar({
  canvasSize,
  previewDataUrl,
  selectionTilePreviewDataUrl,
  tilePreviewSelection,
  selection,
  pendingCanvasSize,
  setPendingCanvasSize,
  applyCanvasSize,
  gridSpacing,
  updateGridSpacing,
  selectedColor,
  setSelectedColor,
  addColorToPalette,
  palette,
  setHoveredPaletteColor,
  savePng,
  saveAsPng,
  loadPng,
  zoom,
  currentFilePath,
  hasUnsavedChanges
}: EditorSidebarProps) {
  return (
    <aside className="col-12 col-lg-4 col-xl-3 editor-sidebar">
      <div className="card shadow-sm editor-sidebar-card">
        <div className="card-body editor-sidebar-body">
          <h1 className="h4 mb-3">DlaPixy</h1>

          <div className="mb-3">
            <label className="form-label">1x PNGプレビュー</label>
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
            <div className="form-text">{canvasSize}x{canvasSize} (1x)</div>
            <label className="form-label mt-2 mb-1">矩形選択 3x3タイルプレビュー</label>
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
            <label className="form-label">キャンバスサイズ (px)</label>
            <div className="input-group">
              <input
                type="number"
                min={MIN_CANVAS_SIZE}
                max={MAX_CANVAS_SIZE}
                className="form-control"
                value={pendingCanvasSize}
                onChange={(e) => setPendingCanvasSize(e.target.value)}
              />
              <button type="button" className="btn btn-outline-primary" onClick={applyCanvasSize}>
                適用
              </button>
            </div>
            <div className="form-text">初期値は 256x256。範囲は {MIN_CANVAS_SIZE} - {MAX_CANVAS_SIZE}</div>
          </div>

          <div className="mb-3">
            <label className="form-label">グリッド線の間隔</label>
            <div className="btn-group w-100" role="group">
              {GRID_SPACING_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`btn ${gridSpacing === option ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => updateGridSpacing(option)}
                >
                  {option}px
                </button>
              ))}
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

          <div className="d-grid gap-2">
            <button type="button" className="btn btn-success" onClick={() => void savePng()}>
              Save (PNG)
            </button>
            <button type="button" className="btn btn-outline-success" onClick={() => void saveAsPng()}>
              Save As (PNG)
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void loadPng()}>
              読み込み (PNG)
            </button>
          </div>

          <div className="small text-muted mt-3">
            <div>キャンバス: {canvasSize}x{canvasSize}</div>
            <div>グリッド線: {gridSpacing}px 間隔</div>
            <div>表示倍率: {zoom}x</div>
            <div>
              現在ファイル: {currentFilePath ?? '未保存'}
              {hasUnsavedChanges ? ' *' : ''}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
