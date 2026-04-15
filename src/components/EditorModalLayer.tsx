/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { AutoSliceModal } from './modals/AutoSliceModal';
import { CanvasSizeModal } from './modals/CanvasSizeModal';
import { ConfirmModal } from './modals/ConfirmModal';
import { GridSpacingModal } from './modals/GridSpacingModal';
import { KMeansQuantizeModal } from './modals/KMeansQuantizeModal';
import { OssLicensesModal } from './modals/OssLicensesModal';
import { PaletteCleanupModal } from './modals/PaletteCleanupModal';
import { SelectionRotateModal } from './modals/SelectionRotateModal';
import { ZoomModal } from './modals/ZoomModal';
import type { TransparentBackgroundMode } from '../../shared/transparent-background';
import type { QuantizeSelectionResult, QuantizeSelectionSource } from '../editor/kmeans-quantize';
import type { UnusedPaletteCleanupOptions } from '../editor/palette-sync';
import type { SelectionPixelBlock } from '../editor/selection-rotate';
import type { Selection } from '../editor/types';
import type { StatusToastType } from '../hooks/useEditorShellUi';
import type { PaletteRemovalRequest, UnusedPaletteCleanupRequest } from '../hooks/usePaletteManagement';

type ToastState = {
  text: string;
  type: StatusToastType;
  isVisible: boolean;
};

type CanvasSizeModalState = {
  isOpen: boolean;
  canvasSize: number;
  onApply: (normalized: number) => void;
  onClose: () => void;
};

type GridSpacingModalState = {
  isOpen: boolean;
  gridSpacing: number;
  canvasSize: number;
  onApply: (value: number) => void;
  onClose: () => void;
};

type AutoSliceModalState = {
  request: {
    baseName: string;
    width: number;
    height: number;
  } | null;
  canvasSize: number;
  onApply: (args: { baseName: string; width: number; height: number }) => boolean;
  onClose: () => void;
};

type ZoomModalState = {
  isOpen: boolean;
  zoom: number;
  onApply: (value: number) => void;
  onClose: () => void;
};

type KMeansQuantizeModalState = {
  request: {
    selection: Selection;
    source: QuantizeSelectionSource | null;
    initialColorCount: number;
  } | null;
  onApply: (result: QuantizeSelectionResult) => void;
  onClose: () => void;
};

type SelectionRotateModalState = {
  request: {
    selection: Selection;
    source: SelectionPixelBlock | null;
  } | null;
  onApply: (result: SelectionPixelBlock) => void;
  onClose: () => void;
};

type PaletteRemovalModalState = {
  request: PaletteRemovalRequest | null;
  onConfirm: () => void;
  onClose: () => void;
};

type UnusedPaletteCleanupModalState = {
  request: UnusedPaletteCleanupRequest | null;
  resolvePreview: (options: UnusedPaletteCleanupOptions) => { totalUnusedCount: number; removableCount: number };
  onApply: (options: UnusedPaletteCleanupOptions) => boolean;
  onClose: () => void;
};

type OssLicensesModalState = {
  isOpen: boolean;
  onClose: () => void;
};

type EditorModalLayerProps = {
  toast: ToastState;
  canvasSizeModal: CanvasSizeModalState;
  gridSpacingModal: GridSpacingModalState;
  autoSliceModal: AutoSliceModalState;
  zoomModal: ZoomModalState;
  transparentBackgroundMode: TransparentBackgroundMode;
  kMeansQuantizeModal: KMeansQuantizeModalState;
  selectionRotateModal: SelectionRotateModalState;
  paletteRemovalModal: PaletteRemovalModalState;
  unusedPaletteCleanupModal: UnusedPaletteCleanupModalState;
  ossLicensesModal: OssLicensesModalState;
  onValidationError: (message: string) => void;
};

export function EditorModalLayer({
  toast,
  canvasSizeModal,
  gridSpacingModal,
  autoSliceModal,
  zoomModal,
  transparentBackgroundMode,
  kMeansQuantizeModal,
  selectionRotateModal,
  paletteRemovalModal,
  unusedPaletteCleanupModal,
  ossLicensesModal,
  onValidationError
}: EditorModalLayerProps) {
  const removalColors = paletteRemovalModal.request?.colors ?? [];
  const isBulkPaletteRemoval = removalColors.length > 1;

  return (
    <>
      <div className={`status-toast ${toast.isVisible ? 'show' : ''} ${toast.type}`} role="status" aria-live="polite">
        {toast.text}
      </div>
      <CanvasSizeModal
        isOpen={canvasSizeModal.isOpen}
        canvasSize={canvasSizeModal.canvasSize}
        onApply={canvasSizeModal.onApply}
        onClose={canvasSizeModal.onClose}
        onValidationError={onValidationError}
      />
      <GridSpacingModal
        isOpen={gridSpacingModal.isOpen}
        gridSpacing={gridSpacingModal.gridSpacing}
        canvasSize={gridSpacingModal.canvasSize}
        onApply={gridSpacingModal.onApply}
        onClose={gridSpacingModal.onClose}
        onValidationError={onValidationError}
      />
      <AutoSliceModal
        isOpen={autoSliceModal.request !== null}
        canvasSize={autoSliceModal.canvasSize}
        initialBaseName={autoSliceModal.request?.baseName ?? 'slice'}
        initialWidth={autoSliceModal.request?.width ?? 1}
        initialHeight={autoSliceModal.request?.height ?? 1}
        onApply={autoSliceModal.onApply}
        onClose={autoSliceModal.onClose}
        onValidationError={onValidationError}
      />
      <ZoomModal
        isOpen={zoomModal.isOpen}
        zoom={zoomModal.zoom}
        onApply={zoomModal.onApply}
        onClose={zoomModal.onClose}
        onValidationError={onValidationError}
      />
      <KMeansQuantizeModal
        isOpen={kMeansQuantizeModal.request !== null}
        transparentBackgroundMode={transparentBackgroundMode}
        selection={kMeansQuantizeModal.request?.selection ?? null}
        source={kMeansQuantizeModal.request?.source ?? null}
        initialColorCount={kMeansQuantizeModal.request?.initialColorCount ?? 1}
        onApply={kMeansQuantizeModal.onApply}
        onClose={kMeansQuantizeModal.onClose}
        onValidationError={onValidationError}
      />
      <SelectionRotateModal
        isOpen={selectionRotateModal.request !== null}
        transparentBackgroundMode={transparentBackgroundMode}
        selection={selectionRotateModal.request?.selection ?? null}
        source={selectionRotateModal.request?.source ?? null}
        onApply={selectionRotateModal.onApply}
        onClose={selectionRotateModal.onClose}
        onValidationError={onValidationError}
      />
      <ConfirmModal
        isOpen={paletteRemovalModal.request !== null}
        title="使用中の色を削除しますか？"
        confirmLabel="クリアして削除"
        onConfirm={paletteRemovalModal.onConfirm}
        onClose={paletteRemovalModal.onClose}
      >
        {isBulkPaletteRemoval ? (
          <>
            <p className="mb-2">
              選択中の <strong>{removalColors.length}色</strong> はキャンバス上で{' '}
              <strong>{paletteRemovalModal.request?.usedPixelCount.toLocaleString() ?? '0'} px</strong>
              {' '}使用されています。
            </p>
            <p className="mb-2 font-monospace small text-break">
              {removalColors.map((color) => color.toUpperCase()).join(', ')}
            </p>
          </>
        ) : (
          <p className="mb-2">
            <span className="font-monospace">{removalColors[0]?.toUpperCase() ?? '-'}</span>
            {' '}はキャンバス上で{' '}
            <strong>{paletteRemovalModal.request?.usedPixelCount.toLocaleString() ?? '0'} px</strong>
            {' '}使用されています。
          </p>
        )}
        <p className="mb-0 text-body-secondary">
          {isBulkPaletteRemoval
            ? 'これらの色を削除すると、該当するピクセルはすべて透明になります。続けてよければ削除してください。'
            : 'この色を削除すると、該当するピクセルはすべて透明になります。続けてよければ削除してください。'}
        </p>
      </ConfirmModal>
      <PaletteCleanupModal
        isOpen={unusedPaletteCleanupModal.request !== null}
        initialOptions={unusedPaletteCleanupModal.request?.initialOptions ?? {}}
        resolvePreview={unusedPaletteCleanupModal.resolvePreview}
        onApply={unusedPaletteCleanupModal.onApply}
        onClose={unusedPaletteCleanupModal.onClose}
      />
      <OssLicensesModal
        isOpen={ossLicensesModal.isOpen}
        onClose={ossLicensesModal.onClose}
      />
    </>
  );
}
