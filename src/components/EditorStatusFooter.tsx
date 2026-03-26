type EditorStatusFooterProps = {
  canvasSize: number;
  gridSpacing: number;
  zoom: number;
  currentFilePath?: string;
  hasUnsavedChanges: boolean;
  onOpenCanvasSizeModal: () => void;
  onOpenGridSpacingModal: () => void;
  onOpenZoomModal: () => void;
};

export function EditorStatusFooter({
  canvasSize,
  gridSpacing,
  zoom,
  currentFilePath,
  hasUnsavedChanges,
  onOpenCanvasSizeModal,
  onOpenGridSpacingModal,
  onOpenZoomModal
}: EditorStatusFooterProps) {
  return (
    <footer className="container-fluid app-footer font-monospace small border-top">
      <div className="app-footer-status">
        <button
          type="button"
          className="app-footer-action"
          onClick={onOpenCanvasSizeModal}
          aria-label="キャンバスサイズ変更を開く (⌘I)"
          title="キャンバスサイズ変更を開く (⌘I)"
        >
          キャンバス(⌘I):{canvasSize}x{canvasSize}
        </button>
        <button
          type="button"
          className="app-footer-action"
          onClick={onOpenGridSpacingModal}
          aria-label="グリッド線間隔変更を開く (⌘G)"
          title="グリッド線間隔変更を開く (⌘G)"
        >
          グリッド線(⌘G):{gridSpacing === 0 ? 'なし' : `${gridSpacing}px 間隔`}
        </button>
        <button
          type="button"
          className="app-footer-action"
          onClick={onOpenZoomModal}
          aria-label="表示倍率変更を開く (⌘R)"
          title="表示倍率変更を開く (⌘R)"
        >
          倍率(⌘R):{zoom}x
        </button>
        <span>
          ファイル:{currentFilePath ?? '未保存'}
          {hasUnsavedChanges ? ' *' : ''}
        </span>
      </div>
    </footer>
  );
}
