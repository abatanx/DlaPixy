/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { UnusedPaletteCleanupOptions } from '../../editor/palette-sync';
import { useBootstrapModal } from './useBootstrapModal';

type PaletteCleanupPreview = {
  totalUnusedCount: number;
  removableCount: number;
};

type PaletteCleanupModalProps = {
  isOpen: boolean;
  initialOptions: UnusedPaletteCleanupOptions;
  resolvePreview: (options: UnusedPaletteCleanupOptions) => PaletteCleanupPreview;
  onApply: (options: UnusedPaletteCleanupOptions) => boolean;
  onClose: () => void;
};

export function PaletteCleanupModal({
  isOpen,
  initialOptions,
  resolvePreview,
  onApply,
  onClose
}: PaletteCleanupModalProps) {
  const modalRef = useBootstrapModal({
    isOpen,
    keyboard: true,
    onHidden: onClose
  });
  const [removeLocked, setRemoveLocked] = useState<boolean>(initialOptions.removeLocked === true);
  const [removeCaptioned, setRemoveCaptioned] = useState<boolean>(initialOptions.removeCaptioned === true);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setRemoveLocked(initialOptions.removeLocked === true);
    setRemoveCaptioned(initialOptions.removeCaptioned === true);
  }, [initialOptions.removeCaptioned, initialOptions.removeLocked, isOpen]);

  const options = useMemo<UnusedPaletteCleanupOptions>(
    () => ({
      removeLocked,
      removeCaptioned
    }),
    [removeCaptioned, removeLocked]
  );
  const preview = useMemo(() => resolvePreview(options), [options, resolvePreview]);

  const handleApply = useCallback(() => {
    if (onApply(options)) {
      onClose();
    }
  }, [onApply, onClose, options]);

  return (
    <div
      ref={modalRef}
      className="modal fade"
      tabIndex={-1}
      aria-labelledby="palette-cleanup-modal-title"
      aria-hidden="true"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow">
          <div className="modal-header">
            <h2 id="palette-cleanup-modal-title" className="modal-title fs-5">不要パレットを削除</h2>
            <button type="button" className="btn-close" aria-label="閉じる" onClick={onClose} />
          </div>
          <div className="modal-body py-4 d-flex flex-column gap-3">
            <div className="form-check">
              <input
                id="palette-cleanup-remove-locked"
                className="form-check-input"
                type="checkbox"
                checked={removeLocked}
                onChange={(event) => setRemoveLocked(event.target.checked)}
              />
              <label htmlFor="palette-cleanup-remove-locked" className="form-check-label">
                ロックされた不要なパレットも削除
              </label>
            </div>
            <div className="form-check">
              <input
                id="palette-cleanup-remove-captioned"
                className="form-check-input"
                type="checkbox"
                checked={removeCaptioned}
                onChange={(event) => setRemoveCaptioned(event.target.checked)}
              />
              <label htmlFor="palette-cleanup-remove-captioned" className="form-check-label">
                キャプションの入った不要なパレットも削除
              </label>
            </div>
            <div className="rounded border bg-body-tertiary px-3 py-2 small">
              <div className="fw-semibold">未使用パレット: {preview.totalUnusedCount}色</div>
              <div className="text-body-secondary">
                現在の条件で削除されるパレット: {preview.removableCount}色
              </div>
            </div>
            {preview.totalUnusedCount === 0 ? (
              <p className="mb-0 small text-body-secondary">
                現在、未使用のパレットはありません。
              </p>
            ) : null}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              キャンセル
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleApply}
              disabled={preview.removableCount === 0}
            >
              削除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
