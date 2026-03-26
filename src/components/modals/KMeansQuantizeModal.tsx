/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createImagePreviewDataUrl } from '../../editor/preview';
import { getTransparentBackgroundSurfaceClassName } from '../../editor/transparent-background';
import {
  quantizeSelectionWithKMeans,
  type QuantizeSelectionResult,
  type QuantizeSelectionSource
} from '../../editor/kmeans-quantize';
import { useBootstrapModal } from './useBootstrapModal';
import type { TransparentBackgroundMode } from '../../../shared/transparent-background';

const MIN_PREVIEW_ZOOM = 1;
const MAX_PREVIEW_ZOOM = 48;

function getDefaultPreviewZoom(source: QuantizeSelectionSource | null): number {
  if (!source) {
    return 1;
  }
  const longestSide = Math.max(source.width, source.height, 1);
  return Math.max(MIN_PREVIEW_ZOOM, Math.min(MAX_PREVIEW_ZOOM, Math.floor(256 / longestSide) || 1));
}

function clampPreviewZoom(value: number): number {
  return Math.max(MIN_PREVIEW_ZOOM, Math.min(MAX_PREVIEW_ZOOM, Math.trunc(value)));
}

type KMeansQuantizeModalProps = {
  isOpen: boolean;
  transparentBackgroundMode: TransparentBackgroundMode;
  selection: { x: number; y: number; w: number; h: number } | null;
  source: QuantizeSelectionSource | null;
  initialColorCount: number;
  onApply: (result: QuantizeSelectionResult) => void;
  onClose: () => void;
  onValidationError: (message: string) => void;
};

export function KMeansQuantizeModal({
  isOpen,
  transparentBackgroundMode,
  selection,
  source,
  initialColorCount,
  onApply,
  onClose,
  onValidationError
}: KMeansQuantizeModalProps) {
  const [pendingColorCount, setPendingColorCount] = useState<string>(String(initialColorCount));
  const [previewZoom, setPreviewZoom] = useState<number>(getDefaultPreviewZoom(source));
  const inputRef = useRef<HTMLInputElement | null>(null);
  const sourceSurfaceRef = useRef<HTMLDivElement | null>(null);
  const resultSurfaceRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScrollRef = useRef<boolean>(false);
  const pendingScrollRatioRef = useRef<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setPendingColorCount(String(initialColorCount));
    setPreviewZoom(getDefaultPreviewZoom(source));
  }, [initialColorCount, isOpen, source]);

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

  const zoomedWidth = source ? source.width * previewZoom : 0;
  const zoomedHeight = source ? source.height * previewZoom : 0;
  const transparentBackgroundClassName = getTransparentBackgroundSurfaceClassName(transparentBackgroundMode);

  const getScrollRatio = useCallback((element: HTMLDivElement | null) => {
    if (!element) {
      return { left: 0, top: 0 };
    }

    const maxLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    const maxTop = Math.max(0, element.scrollHeight - element.clientHeight);
    return {
      left: maxLeft > 0 ? element.scrollLeft / maxLeft : 0,
      top: maxTop > 0 ? element.scrollTop / maxTop : 0
    };
  }, []);

  const applyScrollRatio = useCallback((ratio: { left: number; top: number }) => {
    isSyncingScrollRef.current = true;
    [sourceSurfaceRef.current, resultSurfaceRef.current].forEach((element) => {
      if (!element) {
        return;
      }

      const maxLeft = Math.max(0, element.scrollWidth - element.clientWidth);
      const maxTop = Math.max(0, element.scrollHeight - element.clientHeight);
      element.scrollLeft = ratio.left * maxLeft;
      element.scrollTop = ratio.top * maxTop;
    });
    window.requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  }, []);

  const updatePreviewZoom = useCallback(
    (nextZoom: number) => {
      pendingScrollRatioRef.current = getScrollRatio(sourceSurfaceRef.current);
      setPreviewZoom(clampPreviewZoom(nextZoom));
    },
    [getScrollRatio]
  );

  const resetPreviewZoom = useCallback(() => {
    updatePreviewZoom(getDefaultPreviewZoom(source));
  }, [source, updatePreviewZoom]);

  useEffect(() => {
    if (!isOpen || !pendingScrollRatioRef.current) {
      return;
    }
    applyScrollRatio(pendingScrollRatioRef.current);
    pendingScrollRatioRef.current = null;
  }, [applyScrollRatio, isOpen, previewZoom]);

  const syncPreviewScroll = useCallback(
    (origin: 'source' | 'result') => {
      if (isSyncingScrollRef.current) {
        return;
      }

      const activeElement = origin === 'source' ? sourceSurfaceRef.current : resultSurfaceRef.current;
      const targetElement = origin === 'source' ? resultSurfaceRef.current : sourceSurfaceRef.current;
      if (!activeElement || !targetElement) {
        return;
      }

      isSyncingScrollRef.current = true;
      targetElement.scrollLeft = activeElement.scrollLeft;
      targetElement.scrollTop = activeElement.scrollTop;
      window.requestAnimationFrame(() => {
        isSyncingScrollRef.current = false;
      });
    },
    []
  );

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
                  <div className="kmeans-quantize-preview-toolbar mb-3">
                    <div className="btn-group btn-group-sm" role="group" aria-label="preview zoom controls">
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => updatePreviewZoom(previewZoom - 1)}
                        disabled={previewZoom <= MIN_PREVIEW_ZOOM}
                        title="縮小"
                        aria-label="縮小"
                      >
                        <i className="fa-solid fa-magnifying-glass-minus" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={resetPreviewZoom}
                        title="見やすい倍率に戻す"
                      >
                        {previewZoom}x
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => updatePreviewZoom(previewZoom + 1)}
                        disabled={previewZoom >= MAX_PREVIEW_ZOOM}
                        title="拡大"
                        aria-label="拡大"
                      >
                        <i className="fa-solid fa-magnifying-glass-plus" aria-hidden="true" />
                      </button>
                    </div>
                    <span className="form-text m-0">スクロールは左右同期</span>
                  </div>
                  <div className="kmeans-quantize-preview-grid">
                    <section className="kmeans-quantize-preview-card">
                      <h3 className="fs-6 mb-2">元画像</h3>
                      <div
                        ref={sourceSurfaceRef}
                        className={`kmeans-quantize-preview-surface ${transparentBackgroundClassName}`}
                        onScroll={() => syncPreviewScroll('source')}
                      >
                        {sourcePreviewDataUrl ? (
                          <img
                            src={sourcePreviewDataUrl}
                            alt="K-Means減色前プレビュー"
                            className="kmeans-quantize-preview-image"
                            width={zoomedWidth}
                            height={zoomedHeight}
                          />
                        ) : (
                          <div className="preview-placeholder">プレビューなし</div>
                        )}
                      </div>
                    </section>
                    <section className="kmeans-quantize-preview-card">
                      <h3 className="fs-6 mb-2">減色後</h3>
                      <div
                        ref={resultSurfaceRef}
                        className={`kmeans-quantize-preview-surface ${transparentBackgroundClassName}`}
                        onScroll={() => syncPreviewScroll('result')}
                      >
                        {resultPreviewDataUrl ? (
                          <img
                            src={resultPreviewDataUrl}
                            alt="K-Means減色後プレビュー"
                            className="kmeans-quantize-preview-image"
                            width={zoomedWidth}
                            height={zoomedHeight}
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
