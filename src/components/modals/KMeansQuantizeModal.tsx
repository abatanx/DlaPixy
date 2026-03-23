import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createImagePreviewDataUrl } from '../../editor/preview';
import {
  quantizeSelectionWithKMeans,
  type QuantizeSelectionResult,
  type QuantizeSelectionSource
} from '../../editor/kmeans-quantize';
import { useBootstrapModal } from './useBootstrapModal';

type KMeansQuantizeModalProps = {
  isOpen: boolean;
  selection: { x: number; y: number; w: number; h: number } | null;
  source: QuantizeSelectionSource | null;
  initialColorCount: number;
  onApply: (result: QuantizeSelectionResult) => void;
  onClose: () => void;
  onValidationError: (message: string) => void;
};

export function KMeansQuantizeModal({
  isOpen,
  selection,
  source,
  initialColorCount,
  onApply,
  onClose,
  onValidationError
}: KMeansQuantizeModalProps) {
  const [pendingColorCount, setPendingColorCount] = useState<string>(String(initialColorCount));
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setPendingColorCount(String(initialColorCount));
  }, [initialColorCount, isOpen]);

  const handleShown = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleHidden = useCallback(() => {
    setPendingColorCount(String(initialColorCount));
    onClose();
  }, [initialColorCount, onClose]);

  const modalRef = useBootstrapModal({
    isOpen,
    keyboard: true,
    onShown: handleShown,
    onHidden: handleHidden
  });

  const parsedColorCount = Number.parseInt(pendingColorCount, 10);
  const normalizedColorCount =
    source && Number.isFinite(parsedColorCount)
      ? Math.max(1, Math.min(source.uniqueVisibleColorCount, Math.trunc(parsedColorCount)))
      : null;

  const previewResult = useMemo(() => {
    if (!source || normalizedColorCount === null) {
      return null;
    }
    return quantizeSelectionWithKMeans(source, normalizedColorCount);
  }, [normalizedColorCount, source]);

  const sourcePreviewDataUrl = useMemo(() => {
    if (!source) {
      return '';
    }
    return createImagePreviewDataUrl(source.pixels, source.width, source.height);
  }, [source]);

  const resultPreviewDataUrl = useMemo(() => {
    if (!source || !previewResult) {
      return '';
    }
    return createImagePreviewDataUrl(previewResult.pixels, source.width, source.height);
  }, [previewResult, source]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!source) {
        onValidationError('減色できる選択範囲がありません');
        return;
      }

      if (!Number.isFinite(parsedColorCount)) {
        onValidationError('目標色数は数値で指定してください');
        return;
      }
      if (parsedColorCount < 1 || parsedColorCount > source.uniqueVisibleColorCount) {
        onValidationError(`目標色数は 1 から ${source.uniqueVisibleColorCount} の範囲で指定してください`);
        return;
      }
      if (!previewResult) {
        onValidationError('減色プレビューの生成に失敗しました');
        return;
      }

      onApply(previewResult);
      onClose();
    },
    [onApply, onClose, onValidationError, parsedColorCount, previewResult, source]
  );

  const selectionLabel = selection ? `${selection.w}x${selection.h} @ ${selection.x},${selection.y}` : '-';

  return (
    <div
      ref={modalRef}
      className="modal fade"
      tabIndex={-1}
      aria-labelledby="kmeans-quantize-modal-title"
      aria-hidden="true"
    >
      <div className="modal-dialog modal-xl modal-dialog-centered">
        <div className="modal-content shadow">
          <form onSubmit={handleSubmit}>
            <div className="modal-header">
              <div>
                <h2 id="kmeans-quantize-modal-title" className="modal-title fs-5 d-inline-flex align-items-center gap-2">
                  <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
                  <span>K-Meansで減色する</span>
                </h2>
              </div>
              <button type="button" className="btn-close" aria-label="閉じる" onClick={onClose} />
            </div>
            <div className="modal-body">
              <div className="row g-4">
                <div className="col-12 col-lg-4">
                  <label htmlFor="kmeans-quantize-color-count" className="form-label">目標色数</label>
                  <input
                    ref={inputRef}
                    id="kmeans-quantize-color-count"
                    type="number"
                    min={1}
                    max={source?.uniqueVisibleColorCount ?? 1}
                    className="form-control"
                    value={pendingColorCount}
                    onChange={(event) => setPendingColorCount(event.target.value)}
                  />
                  <div className="form-text">
                    選択範囲: {selectionLabel}
                    <br />
                    元の可視色数: {source?.uniqueVisibleColorCount ?? 0}
                    <br />
                    可視ピクセル数: {source?.visiblePixelCount ?? 0}
                    <br />
                    Enter で適用 / Esc でキャンセル
                  </div>
                </div>
                <div className="col-12 col-lg-8">
                  <div className="kmeans-quantize-preview-grid">
                    <section className="kmeans-quantize-preview-card">
                      <h3 className="fs-6 mb-2">元画像</h3>
                      <div className="kmeans-quantize-preview-surface">
                        {sourcePreviewDataUrl ? (
                          <img
                            src={sourcePreviewDataUrl}
                            alt="K-Means減色前プレビュー"
                            className="kmeans-quantize-preview-image"
                            width={source?.width}
                            height={source?.height}
                          />
                        ) : (
                          <div className="preview-placeholder">プレビューなし</div>
                        )}
                      </div>
                    </section>
                    <section className="kmeans-quantize-preview-card">
                      <h3 className="fs-6 mb-2">減色後</h3>
                      <div className="kmeans-quantize-preview-surface">
                        {resultPreviewDataUrl ? (
                          <img
                            src={resultPreviewDataUrl}
                            alt="K-Means減色後プレビュー"
                            className="kmeans-quantize-preview-image"
                            width={source?.width}
                            height={source?.height}
                          />
                        ) : (
                          <div className="preview-placeholder">プレビューなし</div>
                        )}
                      </div>
                    </section>
                  </div>
                  <div className="form-text mt-3">
                    {previewResult
                      ? `目標: ${previewResult.appliedColorCount} 色 / 結果: ${previewResult.resultColorCount} 色`
                      : '条件を入力するとプレビューを生成します'}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                <span className="d-inline-flex align-items-center gap-2">
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                  <span>キャンセル</span>
                </span>
              </button>
              <button type="submit" className="btn btn-primary" disabled={!previewResult}>
                <span className="d-inline-flex align-items-center gap-2">
                  <i className="fa-solid fa-check" aria-hidden="true" />
                  <span>適用</span>
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
