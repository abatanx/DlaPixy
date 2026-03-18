import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { DEFAULT_GRID_SPACING, GRID_SPACING_OPTIONS } from '../../editor/constants';
import { useBootstrapModal } from './useBootstrapModal';

type GridSpacingModalProps = {
  isOpen: boolean;
  gridSpacing: number;
  canvasSize: number;
  onApply: (value: number) => void;
  onClose: () => void;
  onValidationError: (message: string) => void;
};

function isPresetGridSpacing(value: number): value is (typeof GRID_SPACING_OPTIONS)[number] {
  return GRID_SPACING_OPTIONS.includes(value as (typeof GRID_SPACING_OPTIONS)[number]);
}

export function GridSpacingModal({
  isOpen,
  gridSpacing,
  canvasSize,
  onApply,
  onClose,
  onValidationError
}: GridSpacingModalProps) {
  const [pendingGridSpacingOption, setPendingGridSpacingOption] = useState<string>(String(DEFAULT_GRID_SPACING));
  const [pendingCustomGridSpacing, setPendingCustomGridSpacing] = useState<string>('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const syncPendingState = useCallback(() => {
    if (isPresetGridSpacing(gridSpacing)) {
      setPendingGridSpacingOption(String(gridSpacing));
      setPendingCustomGridSpacing('');
      return;
    }

    setPendingGridSpacingOption('custom');
    setPendingCustomGridSpacing(String(gridSpacing));
  }, [gridSpacing]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    syncPendingState();
  }, [isOpen, syncPendingState]);

  const handleShown = useCallback(() => {
    if (pendingGridSpacingOption !== 'custom') {
      return;
    }
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [pendingGridSpacingOption]);

  const handleHidden = useCallback(() => {
    syncPendingState();
    onClose();
  }, [onClose, syncPendingState]);

  const modalRef = useBootstrapModal({
    isOpen,
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

      if (pendingGridSpacingOption !== 'custom') {
        applyAndClose(Number.parseInt(pendingGridSpacingOption, 10));
        return;
      }

      const parsed = Number.parseInt(pendingCustomGridSpacing, 10);
      if (!Number.isFinite(parsed)) {
        onValidationError('カスタムグリッド線間隔は数値で指定してください');
        return;
      }
      if (parsed < 1 || parsed > canvasSize) {
        onValidationError(`グリッド線間隔は 1 から ${canvasSize} の範囲で指定してください`);
        return;
      }

      applyAndClose(parsed);
    },
    [applyAndClose, canvasSize, onValidationError, pendingCustomGridSpacing, pendingGridSpacingOption]
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
              <label className="form-label">グリッド線間隔</label>
              <div className="btn-group w-100 mb-3" role="group" aria-label="grid spacing preset options">
                {GRID_SPACING_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`btn ${pendingGridSpacingOption === String(option) ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => {
                      setPendingGridSpacingOption(String(option));
                      applyAndClose(option);
                    }}
                  >
                    {option === 0 ? 'なし' : `${option}px`}
                  </button>
                ))}
                <button
                  type="button"
                  className={`btn ${pendingGridSpacingOption === 'custom' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => {
                    setPendingGridSpacingOption('custom');
                    window.setTimeout(() => {
                      inputRef.current?.focus();
                      inputRef.current?.select();
                    }, 0);
                  }}
                >
                  カスタム
                </button>
              </div>
              {pendingGridSpacingOption === 'custom' ? (
                <div className="mt-3">
                  <label htmlFor="grid-spacing-custom-input" className="form-label">カスタム値 (px)</label>
                  <input
                    ref={inputRef}
                    id="grid-spacing-custom-input"
                    type="number"
                    min={1}
                    max={canvasSize}
                    className="form-control"
                    value={pendingCustomGridSpacing}
                    onChange={(event) => {
                      setPendingGridSpacingOption('custom');
                      setPendingCustomGridSpacing(event.target.value);
                    }}
                  />
                  <div className="form-text">
                    現在値: {gridSpacing === 0 ? 'なし' : `${gridSpacing}px`} / 範囲: 1 - {canvasSize}
                  </div>
                </div>
              ) : null}
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
