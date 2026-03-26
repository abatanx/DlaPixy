/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useBootstrapModal } from './useBootstrapModal';

type GridSpacingModalProps = {
  isOpen: boolean;
  gridSpacing: number;
  canvasSize: number;
  onApply: (value: number) => void;
  onClose: () => void;
  onValidationError: (message: string) => void;
};

export function GridSpacingModal({
  isOpen,
  gridSpacing,
  canvasSize,
  onApply,
  onClose,
  onValidationError
}: GridSpacingModalProps) {
  const [pendingGridSpacing, setPendingGridSpacing] = useState<string>(String(gridSpacing));
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setPendingGridSpacing(String(gridSpacing));
  }, [gridSpacing, isOpen]);

  const handleShown = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleHidden = useCallback(() => {
    setPendingGridSpacing(String(gridSpacing));
    onClose();
  }, [gridSpacing, onClose]);

  const modalRef = useBootstrapModal({
    isOpen,
    keyboard: true,
    onShown: handleShown,
    onHidden: handleHidden
  });

  const applyAndClose = useCallback(
    (value: number) => {
      onApply(value);
      onClose();
    },
    [onApply, onClose]
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const parsed = Number.parseInt(pendingGridSpacing, 10);
      if (!Number.isFinite(parsed)) {
        onValidationError('グリッド線間隔は数値で指定してください');
        return;
      }
      if (parsed < 0 || parsed > canvasSize) {
        onValidationError(`グリッド線間隔は 0 から ${canvasSize} の範囲で指定してください（0 はなし）`);
        return;
      }

      applyAndClose(parsed);
    },
    [applyAndClose, canvasSize, onValidationError, pendingGridSpacing]
  );

  return (
    <div
      ref={modalRef}
      className="modal fade"
      tabIndex={-1}
      aria-labelledby="grid-spacing-modal-title"
      aria-hidden="true"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow">
          <form onSubmit={handleSubmit}>
            <div className="modal-header">
              <div>
                <h2 id="grid-spacing-modal-title" className="modal-title fs-5 d-inline-flex align-items-center gap-2">
                  <i className="fa-solid fa-border-all" aria-hidden="true" />
                  <span>グリッド線間隔変更</span>
                </h2>
              </div>
              <button type="button" className="btn-close" aria-label="閉じる" onClick={onClose} />
            </div>
            <div className="modal-body py-4">
              <label htmlFor="grid-spacing-input" className="form-label">グリッド線間隔 (px)</label>
              <input
                ref={inputRef}
                id="grid-spacing-input"
                type="number"
                min={0}
                max={canvasSize}
                className="form-control"
                value={pendingGridSpacing}
                onChange={(event) => setPendingGridSpacing(event.target.value)}
              />
              <div className="form-text">
                現在値: {gridSpacing === 0 ? 'なし' : `${gridSpacing}px`} / 範囲: 0 - {canvasSize} / 0 はなし / Enter で適用 / Esc でキャンセル
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
