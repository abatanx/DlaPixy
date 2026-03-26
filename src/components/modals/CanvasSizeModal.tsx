/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_CANVAS_SIZE, MIN_CANVAS_SIZE } from '../../editor/constants';
import { clampCanvasSize } from '../../editor/utils';
import { useBootstrapModal } from './useBootstrapModal';

type CanvasSizeModalProps = {
  isOpen: boolean;
  canvasSize: number;
  onApply: (value: number) => void;
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
  const [pendingCanvasSize, setPendingCanvasSize] = useState<string>(String(canvasSize));
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setPendingCanvasSize(String(canvasSize));
  }, [canvasSize, isOpen]);

  const handleShown = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleHidden = useCallback(() => {
    setPendingCanvasSize(String(canvasSize));
    onClose();
  }, [canvasSize, onClose]);

  const modalRef = useBootstrapModal({
    isOpen,
    keyboard: true,
    onShown: handleShown,
    onHidden: handleHidden
  });

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const parsed = Number.parseInt(pendingCanvasSize, 10);
      if (!Number.isFinite(parsed)) {
        onValidationError('キャンバスサイズは数値で指定してください');
        return;
      }

      onApply(clampCanvasSize(parsed, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE));
      onClose();
    },
    [onApply, onClose, onValidationError, pendingCanvasSize]
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
                  <i className="fa-regular fa-square" aria-hidden="true" />
                  <span>キャンバスサイズ変更</span>
                </h2>
              </div>
              <button type="button" className="btn-close" aria-label="閉じる" onClick={onClose} />
            </div>
            <div className="modal-body py-4">
              <label htmlFor="canvas-size-input" className="form-label">正方形キャンバスサイズ (px)</label>
              <input
                ref={inputRef}
                id="canvas-size-input"
                type="number"
                min={MIN_CANVAS_SIZE}
                max={MAX_CANVAS_SIZE}
                className="form-control"
                value={pendingCanvasSize}
                onChange={(event) => setPendingCanvasSize(event.target.value)}
              />
              <div className="form-text">
                現在値: {canvasSize}x{canvasSize} / 範囲: {MIN_CANVAS_SIZE} - {MAX_CANVAS_SIZE} / Enter で適用 / Esc でキャンセル
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
