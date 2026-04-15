/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_CANVAS_SIZE, MIN_CANVAS_SIZE } from '../../editor/constants';
import { clampCanvasSize } from '../../editor/utils';
import type { CanvasSize } from '../../editor/types';
import { useBootstrapModal } from './useBootstrapModal';

type CanvasSizeModalProps = {
  isOpen: boolean;
  canvasSize: CanvasSize;
  onApply: (value: CanvasSize) => void;
  onClose: () => void;
  onValidationError: (message: string) => void;
};

export function CanvasSizeModal({
  isOpen,
  canvasSize,
  onApply,
  onClose,
  onValidationError
}: CanvasSizeModalProps) {
  const [pendingWidth, setPendingWidth] = useState<string>(String(canvasSize.width));
  const [pendingHeight, setPendingHeight] = useState<string>(String(canvasSize.height));
  const widthInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setPendingWidth(String(canvasSize.width));
    setPendingHeight(String(canvasSize.height));
  }, [canvasSize.height, canvasSize.width, isOpen]);

  const handleShown = useCallback(() => {
    widthInputRef.current?.focus();
    widthInputRef.current?.select();
  }, []);

  const handleHidden = useCallback(() => {
    setPendingWidth(String(canvasSize.width));
    setPendingHeight(String(canvasSize.height));
    onClose();
  }, [canvasSize.height, canvasSize.width, onClose]);

  const modalRef = useBootstrapModal({
    isOpen,
    keyboard: true,
    onShown: handleShown,
    onHidden: handleHidden
  });

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const parsedWidth = Number.parseInt(pendingWidth, 10);
      const parsedHeight = Number.parseInt(pendingHeight, 10);
      if (!Number.isFinite(parsedWidth) || !Number.isFinite(parsedHeight)) {
        onValidationError('キャンバスサイズは数値で指定してください');
        return;
      }

      onApply({
        width: clampCanvasSize(parsedWidth, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE),
        height: clampCanvasSize(parsedHeight, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE)
      });
      onClose();
    },
    [onApply, onClose, onValidationError, pendingHeight, pendingWidth]
  );

  return (
    <div
      ref={modalRef}
      className="modal fade"
      tabIndex={-1}
      aria-labelledby="canvas-size-modal-title"
      aria-hidden="true"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow">
          <form onSubmit={handleSubmit}>
            <div className="modal-header">
              <div>
                <h2 id="canvas-size-modal-title" className="modal-title fs-5 d-inline-flex align-items-center gap-2">
                  <i className="fa-solid fa-expand" aria-hidden="true" />
                  <span>キャンバスサイズ変更</span>
                </h2>
              </div>
              <button type="button" className="btn-close" aria-label="閉じる" onClick={onClose} />
            </div>
            <div className="modal-body py-4 d-flex flex-column gap-3">
              <div className="row g-3">
                <div className="col-6">
                  <label htmlFor="canvas-width-input" className="form-label">W</label>
                  <input
                    ref={widthInputRef}
                    id="canvas-width-input"
                    type="number"
                    min={MIN_CANVAS_SIZE}
                    max={MAX_CANVAS_SIZE}
                    className="form-control"
                    value={pendingWidth}
                    onChange={(event) => setPendingWidth(event.target.value)}
                  />
                </div>
                <div className="col-6">
                  <label htmlFor="canvas-height-input" className="form-label">H</label>
                  <input
                    id="canvas-height-input"
                    type="number"
                    min={MIN_CANVAS_SIZE}
                    max={MAX_CANVAS_SIZE}
                    className="form-control"
                    value={pendingHeight}
                    onChange={(event) => setPendingHeight(event.target.value)}
                  />
                </div>
              </div>
              <div className="form-text">
                現在値: {canvasSize.width}x{canvasSize.height} / 範囲: {MIN_CANVAS_SIZE} - {MAX_CANVAS_SIZE} / Enter で適用 / Esc でキャンセル
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                <span className="d-inline-flex align-items-center gap-2">
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                  <span>キャンセル</span>
                </span>
              </button>
              <button type="submit" className="btn btn-primary">
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
