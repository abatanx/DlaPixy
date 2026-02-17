import { MAX_ZOOM, MIN_ZOOM } from '../editor/constants';
import type { Tool } from '../editor/types';

type EditorToolbarProps = {
  tool: Tool;
  setTool: (tool: Tool) => void;
  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
  doUndo: () => void;
  copySelection: () => Promise<void>;
  pasteSelection: () => void;
  deleteSelection: () => void;
  clearCanvas: () => void;
};

// ツール選択・ズーム・編集操作を集約した右側ツールバー。
export function EditorToolbar({
  tool,
  setTool,
  zoom,
  zoomIn,
  zoomOut,
  doUndo,
  copySelection,
  pasteSelection,
  deleteSelection,
  clearCanvas
}: EditorToolbarProps) {
  return (
    <div className="editor-toolbar" role="toolbar" aria-label="editor controls">
      <button
        type="button"
        className={`btn btn-sm editor-tool-btn ${tool === 'pencil' ? 'active' : ''}`}
        onClick={() => setTool('pencil')}
        title="描画ツール"
      >
        <span className="editor-btn-inner">
          <i className="fa-solid fa-pencil" aria-hidden="true" />
          <span className="editor-shortcut">B</span>
        </span>
      </button>
      <button
        type="button"
        className={`btn btn-sm editor-tool-btn ${tool === 'eraser' ? 'active' : ''}`}
        onClick={() => setTool('eraser')}
        title="消しゴム"
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
        title="塗りつぶし"
      >
        <span className="editor-btn-inner">
          <i className="fa-solid fa-fill-drip" aria-hidden="true" />
          <span className="editor-shortcut">G</span>
        </span>
      </button>
      <button
        type="button"
        className={`btn btn-sm editor-tool-btn ${tool === 'select' ? 'active' : ''}`}
        onClick={() => setTool('select')}
        title="矩形選択"
      >
        <span className="editor-btn-inner">
          <i className="fa-regular fa-square" aria-hidden="true" />
          <span className="editor-shortcut">V</span>
        </span>
      </button>

      <div className="editor-toolbar-separator" />

      <button
        type="button"
        className="btn btn-sm editor-tool-btn"
        onClick={zoomIn}
        disabled={zoom >= MAX_ZOOM}
        title="拡大 (+)"
      >
        <span className="editor-btn-inner">
          <i className="fa-solid fa-magnifying-glass-plus" aria-hidden="true" />
          <span className="editor-shortcut">+</span>
        </span>
      </button>
      <button
        type="button"
        className="btn btn-sm editor-tool-btn"
        onClick={zoomOut}
        disabled={zoom <= MIN_ZOOM}
        title="縮小 (-)"
      >
        <span className="editor-btn-inner">
          <i className="fa-solid fa-magnifying-glass-minus" aria-hidden="true" />
          <span className="editor-shortcut">-</span>
        </span>
      </button>
      <div className="editor-zoom-label">{zoom}x</div>

      <div className="editor-toolbar-separator" />

      <button type="button" className="btn btn-sm editor-tool-btn" onClick={doUndo} title="Undo (Cmd/Ctrl+Z)">
        <span className="editor-btn-inner">
          <i className="fa-solid fa-rotate-left" aria-hidden="true" />
          <span className="editor-shortcut">Z</span>
        </span>
      </button>
      <button type="button" className="btn btn-sm editor-tool-btn" onClick={() => void copySelection()} title="選択範囲をコピー">
        <i className="fa-regular fa-copy" aria-hidden="true" />
      </button>
      <button type="button" className="btn btn-sm editor-tool-btn" onClick={pasteSelection} title="貼り付け (Cmd/Ctrl+V)">
        <i className="fa-regular fa-paste" aria-hidden="true" />
      </button>
      <button type="button" className="btn btn-sm editor-tool-btn" onClick={deleteSelection} title="選択範囲を削除">
        <i className="fa-regular fa-trash-can" aria-hidden="true" />
      </button>
      <button type="button" className="btn btn-sm editor-tool-btn" onClick={clearCanvas} title="クリア">
        <i className="fa-solid fa-broom" aria-hidden="true" />
      </button>
    </div>
  );
}
