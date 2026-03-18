import { memo } from 'react';
import type { SidebarPreviewSectionProps } from './types';

export const SidebarPreviewSection = memo(function SidebarPreviewSection({
  canvasSize,
  previewDataUrl,
  selectionTilePreviewDataUrl,
  tilePreviewSelection,
  selection
}: SidebarPreviewSectionProps) {
  return (
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
  );
});
