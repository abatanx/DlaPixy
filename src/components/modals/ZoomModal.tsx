/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_ZOOM, MIN_ZOOM } from '../../editor/constants';
import { useBootstrapModal } from './useBootstrapModal';

type ZoomModalProps = {
  isOpen: boolean;
  zoom: number;
  onApply: (value: number) => void;
  onClose: () => void;
  onValidationError: (message: string) => void;
};

export function ZoomModal({ isOpen, zoom, onApply, onClose, onValidationError }: ZoomModalProps) {
  const [pendingZoom, setPendingZoom] = useState<string>(String(zoom));
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setPendingZoom(String(zoom));
  }, [isOpen, zoom]);

  const handleShown = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleHidden = useCallback(() => {
    setPendingZoom(String(zoom));
    onClose();
  }, [onClose, zoom]);

  const modalRef = useBootstrapModal({
    isOpen,
    keyboard: true,
    onShown: handleShown,
    onHidden: handleHidden
  });

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const parsed = Number.parseInt(pendingZoom, 10);
      if (!Number.isFinite(parsed)) {
        onValidationError('表示倍率は数値で指定してください');
        return;
      }
      if (parsed < MIN_ZOOM || parsed > MAX_ZOOM) {
        onValidationError(`表示倍率は ${MIN_ZOOM} から ${MAX_ZOOM} の範囲で指定してください`);
        return;
      }

      onApply(parsed);
      onClose();
    },
    [onApply, onClose, onValidationError, pendingZoom]
  );

  return (
    <div ref={modalRef} className="modal fade" tabIndex={-1} aria-labelledby="zoom-modal-title" aria-hidden="true">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow">
          <form onSubmit={handleSubmit}>
            <div className="modal-header">
              <div>
                <h2 id="zoom-modal-title" className="modal-title fs-5 d-inline-flex align-items-center gap-2">
                  <i className="fa-solid fa-magnifying-glass-plus" aria-hidden="true" />
                  <span>表示倍率変更</span>
                </h2>
              </div>
              <button type="button" className="btn-close" aria-label="閉じる" onClick={onClose} />
            </div>
            <div className="modal-body py-4">
              <label htmlFor="zoom-input" className="form-label">表示倍率 (x)</label>
              <input
                ref={inputRef}
                id="zoom-input"
                type="number"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                className="form-control"
                value={pendingZoom}
                onChange={(event) => setPendingZoom(event.target.value)}
              />
              <div className="form-text">
                現在値: {zoom}x / 範囲: {MIN_ZOOM} - {MAX_ZOOM} / Enter で適用 / Esc でキャンセル
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
