/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { type ReactNode, useCallback } from 'react';
import { useBootstrapModal } from './useBootstrapModal';

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmButtonClassName?: string;
  children: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmModal({
  isOpen,
  title,
  confirmLabel,
  cancelLabel = 'キャンセル',
  confirmButtonClassName = 'btn btn-danger',
  children,
  onConfirm,
  onClose
}: ConfirmModalProps) {
  const modalRef = useBootstrapModal({
    isOpen,
    keyboard: true,
    onHidden: onClose
  });

  const handleConfirm = useCallback(() => {
    onConfirm();
    onClose();
  }, [onClose, onConfirm]);

  return (
    <div
      ref={modalRef}
      className="modal fade"
      tabIndex={-1}
      aria-labelledby="confirm-modal-title"
      aria-hidden="true"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow">
          <div className="modal-header">
            <h2 id="confirm-modal-title" className="modal-title fs-5">{title}</h2>
            <button type="button" className="btn-close" aria-label="閉じる" onClick={onClose} />
          </div>
          <div className="modal-body py-4">{children}</div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              {cancelLabel}
            </button>
            <button type="button" className={confirmButtonClassName} onClick={handleConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
