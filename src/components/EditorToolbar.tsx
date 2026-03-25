import { MAX_ZOOM, MIN_ZOOM } from '../editor/constants';
import type { Tool } from '../editor/types';

type EditorToolbarProps = {
  tool: Tool;
  setTool: (tool: Tool) => void;
  canAddAnimationFrame: boolean;
  canDeleteSelection: boolean;
  addAnimationFrame: () => void;
  canRotateSelection: boolean;
  openSelectionRotateModal: () => void;
  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
  doUndo: () => void;
  copySelection: () => Promise<void>;
  pasteSelection: () => void;
  deleteSelection: () => void;
};

// ツール選択・ズーム・編集操作を集約した右側ツールバー。
export function EditorToolbar({
  tool,
  setTool,
  canAddAnimationFrame,
  canDeleteSelection,
  addAnimationFrame,
  canRotateSelection,
  openSelectionRotateModal,
  zoom,
  zoomIn,
  zoomOut,
  doUndo,
  copySelection,
  pasteSelection,
  deleteSelection
}: EditorToolbarProps) {
  return (
    <div className="editor-toolbar" role="toolbar" aria-label="editor controls">
      <button
        type="button"
        className={`btn btn-sm editor-tool-btn ${tool === 'select' ? 'active' : ''}`}
        onClick={() => setTool('select')}
        title="矩形選択 (Q)"
      >
        <span className="editor-btn-inner">
          <i className="fa-regular fa-square" aria-hidden="true" />
          <span className="editor-shortcut">Q</span>
        </span>
      </button>

      <div className="editor-toolbar-separator" />

      <button
        type="button"
        className={`btn btn-sm editor-tool-btn ${tool === 'pencil' ? 'active' : ''}`}
        onClick={() => setTool('pencil')}
        title="描画ツール (W)"
      >
        <span className="editor-btn-inner">
          <i className="fa-solid fa-pencil" aria-hidden="true" />
          <span className="editor-shortcut">W</span>
        </span>
      </button>
      <button
        type="button"
        className={`btn btn-sm editor-tool-btn ${tool === 'eraser' ? 'active' : ''}`}
        onClick={() => setTool('eraser')}
        title="消しゴム (E)"
      >
        <span className="editor-btn-inner">
          <i className="fa-solid fa-eraser" aria-hidden="true" />
          <span className="editor-shortcut">E</span>
        </span>
      </button>
      <button
        type="button"
        className={`btn btn-sm editor-tool-btn ${tool === 'fill' ? 'active' : ''}`}
        onClick={() => setTool('fill')}
        title="塗りつぶし (P)"
      >
        <span className="editor-btn-inner">
          <i className="fa-solid fa-fill-drip" aria-hidden="true" />
          <span className="editor-shortcut">P</span>
        </span>
      </button>

      <div className="editor-toolbar-separator" />

      <button
        type="button"
        className="btn btn-sm editor-tool-btn"
        onClick={addAnimationFrame}
        disabled={!canAddAnimationFrame}
        title="選択範囲をアニメーションフレームに追加 (T)"
      >
        <span className="editor-btn-inner">
          <i className="fa-solid fa-film" aria-hidden="true" />
          <span className="editor-shortcut">T</span>
        </span>
      </button>
      <button
        type="button"
        className="btn btn-sm editor-tool-btn"
        onClick={openSelectionRotateModal}
        disabled={!canRotateSelection}
        title="選択範囲をローテーション (Y)"
      >
        <span className="editor-btn-inner">
          <i className="fa-solid fa-arrows-rotate" aria-hidden="true" />
          <span className="editor-shortcut">Y</span>
        </span>
      </button>

      <div className="editor-toolbar-separator" />

      <button type="button" className="btn btn-sm editor-tool-btn" onClick={doUndo} title="Undo (⌘Z)">
        <span className="editor-btn-inner">
          <i className="fa-solid fa-rotate-left" aria-hidden="true" />
          <span className="editor-shortcut">⌘Z</span>
        </span>
      </button>
      <button
        type="button"
        className="btn btn-sm editor-tool-btn"
        onClick={() => void copySelection()}
        title="選択範囲をコピー (⌘C)"
      >
        <span className="editor-btn-inner">
          <i className="fa-regular fa-copy" aria-hidden="true" />
          <span className="editor-shortcut">⌘C</span>
        </span>
      </button>
      <button type="button" className="btn btn-sm editor-tool-btn" onClick={pasteSelection} title="貼り付け (⌘V)">
        <span className="editor-btn-inner">
          <i className="fa-regular fa-paste" aria-hidden="true" />
          <span className="editor-shortcut">⌘V</span>
        </span>
      </button>
      <button
        type="button"
        className="btn btn-sm editor-tool-btn"
        onClick={deleteSelection}
        disabled={!canDeleteSelection}
        title="選択範囲を削除 (DEL)"
      >
        <span className="editor-btn-inner">
          <i className="fa-regular fa-trash-can" aria-hidden="true" />
          <span className="editor-shortcut">DEL</span>
        </span>
      </button>

      <div className="editor-toolbar-separator" />

      <button
        type="button"
        className="btn btn-sm editor-tool-btn"
        onClick={zoomIn}
        disabled={zoom >= MAX_ZOOM}
        title="拡大 (+D)"
      >
        <span className="editor-btn-inner">
          <i className="fa-solid fa-magnifying-glass-plus" aria-hidden="true" />
          <span className="editor-shortcut">+D</span>
        </span>
      </button>
      <button
        type="button"
        className="btn btn-sm editor-tool-btn"
        onClick={zoomOut}
        disabled={zoom <= MIN_ZOOM}
        title="縮小 (-A)"
      >
        <span className="editor-btn-inner">
          <i className="fa-solid fa-magnifying-glass-minus" aria-hidden="true" />
          <span className="editor-shortcut">-A</span>
        </span>
      </button>
      <div className="editor-zoom-label">{zoom}x</div>
    </div>
  );
}
