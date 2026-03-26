import { CanvasSizeModal } from './modals/CanvasSizeModal';
import { ConfirmModal } from './modals/ConfirmModal';
import { GridSpacingModal } from './modals/GridSpacingModal';
import { KMeansQuantizeModal } from './modals/KMeansQuantizeModal';
import { SelectionRotateModal } from './modals/SelectionRotateModal';
import { ZoomModal } from './modals/ZoomModal';
import type { TransparentBackgroundMode } from '../../shared/transparent-background';
import type { QuantizeSelectionResult, QuantizeSelectionSource } from '../editor/kmeans-quantize';
import type { SelectionPixelBlock } from '../editor/selection-rotate';
import type { Selection } from '../editor/types';
import type { PaletteRemovalRequest } from '../hooks/usePaletteManagement';

type ToastType = 'success' | 'warning' | 'error' | 'info';

type EditorModalLayerProps = {
  statusText: string;
  toastType: ToastType;
  isToastVisible: boolean;
  isCanvasSizeModalOpen: boolean;
  canvasSize: number;
  onApplyCanvasSize: (normalized: number) => void;
  onCloseCanvasSize: () => void;
  isGridSpacingModalOpen: boolean;
  gridSpacing: number;
  onApplyGridSpacing: (value: number) => void;
  onCloseGridSpacing: () => void;
  isZoomModalOpen: boolean;
  zoom: number;
  onApplyZoom: (value: number) => void;
  onCloseZoom: () => void;
  transparentBackgroundMode: TransparentBackgroundMode;
  kMeansQuantizeSelection: Selection;
  kMeansQuantizeSource: QuantizeSelectionSource | null;
  kMeansInitialColorCount: number;
  onApplyKMeansQuantize: (result: QuantizeSelectionResult) => void;
  onCloseKMeansQuantize: () => void;
  selectionRotateSelection: Selection;
  selectionRotateSource: SelectionPixelBlock | null;
  onApplySelectionRotate: (result: SelectionPixelBlock) => void;
  onCloseSelectionRotate: () => void;
  paletteRemovalRequest: PaletteRemovalRequest | null;
  onConfirmPaletteRemoval: () => void;
  onClosePaletteRemoval: () => void;
  showValidationWarning: (message: string) => void;
};

export function EditorModalLayer({
  statusText,
  toastType,
  isToastVisible,
  isCanvasSizeModalOpen,
  canvasSize,
  onApplyCanvasSize,
  onCloseCanvasSize,
  isGridSpacingModalOpen,
  gridSpacing,
  onApplyGridSpacing,
  onCloseGridSpacing,
  isZoomModalOpen,
  zoom,
  onApplyZoom,
  onCloseZoom,
  transparentBackgroundMode,
  kMeansQuantizeSelection,
  kMeansQuantizeSource,
  kMeansInitialColorCount,
  onApplyKMeansQuantize,
  onCloseKMeansQuantize,
  selectionRotateSelection,
  selectionRotateSource,
  onApplySelectionRotate,
  onCloseSelectionRotate,
  paletteRemovalRequest,
  onConfirmPaletteRemoval,
  onClosePaletteRemoval,
  showValidationWarning
}: EditorModalLayerProps) {
  return (
    <>
      <div className={`status-toast ${isToastVisible ? 'show' : ''} ${toastType}`} role="status" aria-live="polite">
        {statusText}
      </div>
      <CanvasSizeModal
        isOpen={isCanvasSizeModalOpen}
        canvasSize={canvasSize}
        onApply={onApplyCanvasSize}
        onClose={onCloseCanvasSize}
        onValidationError={showValidationWarning}
      />
      <GridSpacingModal
        isOpen={isGridSpacingModalOpen}
        gridSpacing={gridSpacing}
        canvasSize={canvasSize}
        onApply={onApplyGridSpacing}
        onClose={onCloseGridSpacing}
        onValidationError={showValidationWarning}
      />
      <ZoomModal
        isOpen={isZoomModalOpen}
        zoom={zoom}
        onApply={onApplyZoom}
        onClose={onCloseZoom}
        onValidationError={showValidationWarning}
      />
      <KMeansQuantizeModal
        isOpen={kMeansQuantizeSelection !== null}
        transparentBackgroundMode={transparentBackgroundMode}
        selection={kMeansQuantizeSelection}
        source={kMeansQuantizeSource}
        initialColorCount={kMeansInitialColorCount}
        onApply={onApplyKMeansQuantize}
        onClose={onCloseKMeansQuantize}
        onValidationError={showValidationWarning}
      />
      <SelectionRotateModal
        isOpen={selectionRotateSelection !== null}
        transparentBackgroundMode={transparentBackgroundMode}
        selection={selectionRotateSelection}
        source={selectionRotateSource}
        onApply={onApplySelectionRotate}
        onClose={onCloseSelectionRotate}
        onValidationError={showValidationWarning}
      />
      <ConfirmModal
        isOpen={paletteRemovalRequest !== null}
        title="使用中の色を削除しますか？"
        confirmLabel="クリアして削除"
        onConfirm={onConfirmPaletteRemoval}
        onClose={onClosePaletteRemoval}
      >
        <p className="mb-2">
          <span className="font-monospace">{paletteRemovalRequest?.color.toUpperCase() ?? '-'}</span>
          {' '}はキャンバス上で{' '}
          <strong>{paletteRemovalRequest?.usedPixelCount.toLocaleString() ?? '0'} px</strong>
          {' '}使用されています。
        </p>
        <p className="mb-0 text-body-secondary">
          この色を削除すると、該当するピクセルはすべて透明になります。続けてよければ削除してください。
        </p>
      </ConfirmModal>
    </>
  );
}
