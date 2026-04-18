/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { createImagePreviewDataUrl } from '../../editor/preview';
import { getTransparentBackgroundSurfaceClassName } from '../../editor/transparent-background';
import {
  flipSelectionPixelBlock,
  rotateSelectionPixelBlock,
  rotateSelectionPixelBlockQuarterTurn,
  type SelectionFlipAxis,
  type SelectionPixelBlock,
  type SelectionQuarterTurnDirection,
  type SelectionRotateDirection
} from '../../editor/selection-rotate';
import { useBootstrapModal } from './useBootstrapModal';
import type { TransparentBackgroundMode } from '../../../shared/transparent-background';

const MIN_PREVIEW_ZOOM = 1;
const MAX_PREVIEW_ZOOM = 48;

function getDefaultPreviewZoom(source: SelectionPixelBlock | null): number {
  if (!source) {
    return 1;
  }
  const longestSide = Math.max(source.width, source.height, 1);
  return Math.max(MIN_PREVIEW_ZOOM, Math.min(MAX_PREVIEW_ZOOM, Math.floor(256 / longestSide) || 1));
}

function clampPreviewZoom(value: number): number {
  return Math.max(MIN_PREVIEW_ZOOM, Math.min(MAX_PREVIEW_ZOOM, Math.trunc(value)));
}

type SelectionRotateModalProps = {
  isOpen: boolean;
  transparentBackgroundMode: TransparentBackgroundMode;
  selection: { x: number; y: number; w: number; h: number } | null;
  source: SelectionPixelBlock | null;
  onApply: (result: SelectionPixelBlock) => void;
  onClose: () => void;
  onValidationError: (message: string) => void;
};

export function SelectionRotateModal({
  isOpen,
  transparentBackgroundMode,
  selection,
  source,
  onApply,
  onClose,
  onValidationError
}: SelectionRotateModalProps) {
  const [previewPixels, setPreviewPixels] = useState<Uint8ClampedArray>(() => new Uint8ClampedArray());
  const [previewZoom, setPreviewZoom] = useState<number>(getDefaultPreviewZoom(source));

  useEffect(() => {
    if (!isOpen || !source) {
      return;
    }
    setPreviewPixels(new Uint8ClampedArray(source.pixels));
    setPreviewZoom(getDefaultPreviewZoom(source));
  }, [isOpen, source]);

  const handleHidden = useCallback(() => {
    setPreviewPixels(source ? new Uint8ClampedArray(source.pixels) : new Uint8ClampedArray());
    onClose();
  }, [onClose, source]);

  const modalRef = useBootstrapModal({
    isOpen,
    keyboard: true,
    onHidden: handleHidden
  });

  const rotatePreview = useCallback(
    (direction: SelectionRotateDirection) => {
      if (!source) {
        return;
      }

      setPreviewPixels((current) => rotateSelectionPixelBlock(current, source.width, source.height, direction));
    },
    [source]
  );

  const rotateQuarterTurnPreview = useCallback(
    (direction: SelectionQuarterTurnDirection) => {
      if (!source || source.width !== source.height) {
        return;
      }

      setPreviewPixels((current) =>
        rotateSelectionPixelBlockQuarterTurn(current, source.width, source.height, direction)
      );
    },
    [source]
  );

  const flipPreview = useCallback(
    (axis: SelectionFlipAxis) => {
      if (!source) {
        return;
      }

      setPreviewPixels((current) => flipSelectionPixelBlock(current, source.width, source.height, axis));
    },
    [source]
  );

  useEffect(() => {
    if (!isOpen || !source) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'ArrowLeft':
          event.preventDefault();
          rotatePreview('left');
          break;
        case 'ArrowRight':
          event.preventDefault();
          rotatePreview('right');
          break;
        case 'ArrowUp':
          event.preventDefault();
          rotatePreview('up');
          break;
        case 'ArrowDown':
          event.preventDefault();
          rotatePreview('down');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, rotatePreview, source]);

  const previewDataUrl = useMemo(() => {
    if (!source) {
      return '';
    }
    const previewSource = previewPixels.length === source.pixels.length ? previewPixels : source.pixels;
    return createImagePreviewDataUrl(previewSource, source.width, source.height);
  }, [previewPixels, source]);

  const hasPendingChanges = useMemo(() => {
    if (!source || previewPixels.length !== source.pixels.length) {
      return false;
    }

    for (let index = 0; index < previewPixels.length; index += 1) {
      if (previewPixels[index] !== source.pixels[index]) {
        return true;
      }
    }
    return false;
  }, [previewPixels, source]);

  const selectionLabel = selection ? `${selection.w}x${selection.h} @ ${selection.x},${selection.y}` : '-';
  const isSquareSelection = source ? source.width === source.height : false;
  const zoomedWidth = source ? source.width * previewZoom : 0;
  const zoomedHeight = source ? source.height * previewZoom : 0;
  const transparentBackgroundClassName = getTransparentBackgroundSurfaceClassName(transparentBackgroundMode);

  const applyPreview = useCallback(() => {
      if (!source) {
        onValidationError('ローテーションできる選択範囲がありません');
        return false;
      }
      if (!hasPendingChanges) {
        onValidationError('ローテーションの変更がありません');
        return false;
      }

      onApply({
        pixels: new Uint8ClampedArray(previewPixels),
        width: source.width,
        height: source.height
      });
      onClose();
      return true;
    },
    [hasPendingChanges, onApply, onClose, onValidationError, previewPixels, source]
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      applyPreview();
    },
    [applyPreview]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) {
        return;
      }
      if (event.code !== 'Enter' && event.code !== 'NumpadEnter') {
        return;
      }

      event.preventDefault();
      applyPreview();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [applyPreview, isOpen]);

  return (
    <div
      ref={modalRef}
      className="modal fade"
      tabIndex={-1}
      aria-labelledby="selection-rotate-modal-title"
      aria-hidden="true"
    >
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content shadow">
          <form onSubmit={handleSubmit}>
            <div className="modal-header">
              <div>
                <h2 id="selection-rotate-modal-title" className="modal-title fs-5 d-inline-flex align-items-center gap-2">
                  <i className="fa-solid fa-arrows-rotate" aria-hidden="true" />
                  <span>選択範囲をローテーション</span>
                </h2>
              </div>
              <button type="button" className="btn-close" aria-label="閉じる" onClick={onClose} />
            </div>
            <div className="modal-body">
              <div className="row g-4 align-items-start">
                <div className="col-12 col-lg-4">
                  <div className="small text-body-secondary">
                    選択範囲: {selectionLabel}
                    <br />
                    矢印キー: 1px 循環移動
                    <br />
                    Enter で適用 / Esc でキャンセル
                  </div>
                  <div className="selection-rotate-action-grid mt-3">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => rotateQuarterTurnPreview('counterclockwise')}
                      disabled={!isSquareSelection}
                      title={isSquareSelection ? '90度左回転' : '正方形選択のときだけ回転できます'}
                    >
                      <span className="d-inline-flex align-items-center gap-2">
                        <i className="fa-solid fa-rotate-left" aria-hidden="true" />
                        <span>90° 左</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => rotateQuarterTurnPreview('clockwise')}
                      disabled={!isSquareSelection}
                      title={isSquareSelection ? '90度右回転' : '正方形選択のときだけ回転できます'}
                    >
                      <span className="d-inline-flex align-items-center gap-2">
                        <i className="fa-solid fa-rotate-right" aria-hidden="true" />
                        <span>90° 右</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => flipPreview('horizontal')}
                      title="水平フリップ"
                    >
                      <span className="d-inline-flex align-items-center gap-2">
                        <i className="fa-solid fa-left-right" aria-hidden="true" />
                        <span>水平反転</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => flipPreview('vertical')}
                      title="垂直フリップ"
                    >
                      <span className="d-inline-flex align-items-center gap-2">
                        <i className="fa-solid fa-up-down" aria-hidden="true" />
                        <span>垂直反転</span>
                      </span>
                    </button>
                  </div>
                  {!isSquareSelection && source ? (
                    <div className="form-text mt-2">
                      90度回転は正方形の選択範囲でのみ有効です。
                    </div>
                  ) : null}
                  <div className="btn-group btn-group-sm mt-3" role="group" aria-label="preview zoom controls">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setPreviewZoom((current) => clampPreviewZoom(current - 1))}
                      disabled={previewZoom <= MIN_PREVIEW_ZOOM}
                    >
                      <i className="fa-solid fa-magnifying-glass-minus" aria-hidden="true" />
                    </button>
                    <button type="button" className="btn btn-outline-secondary px-3" onClick={() => setPreviewZoom(getDefaultPreviewZoom(source))}>
                      {previewZoom}x
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setPreviewZoom((current) => clampPreviewZoom(current + 1))}
                      disabled={previewZoom >= MAX_PREVIEW_ZOOM}
                    >
                      <i className="fa-solid fa-magnifying-glass-plus" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="col-12 col-lg-8">
                  <div className="kmeans-quantize-preview-card selection-rotate-preview-card">
                    <div className={`kmeans-quantize-preview-surface selection-rotate-preview-surface ${transparentBackgroundClassName}`}>
                      {previewDataUrl ? (
                        <img
                          src={previewDataUrl}
                          alt="selection rotate preview"
                          className="kmeans-quantize-preview-image selection-rotate-preview-image"
                          style={{ width: zoomedWidth, height: zoomedHeight }}
                        />
                      ) : (
                        <div className="preview-placeholder">プレビューはありません</div>
                      )}
                    </div>
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
              <button type="submit" className="btn btn-primary" disabled={!hasPendingChanges}>
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
