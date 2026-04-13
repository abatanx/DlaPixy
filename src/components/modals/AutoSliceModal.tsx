/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useBootstrapModal } from './useBootstrapModal';

type AutoSliceModalProps = {
  isOpen: boolean;
  canvasSize: number;
  initialBaseName: string;
  initialWidth: number;
  initialHeight: number;
  onApply: (args: { baseName: string; width: number; height: number }) => boolean;
  onClose: () => void;
  onValidationError: (message: string) => void;
};

export function AutoSliceModal({
  isOpen,
  canvasSize,
  initialBaseName,
  initialWidth,
  initialHeight,
  onApply,
  onClose,
  onValidationError
}: AutoSliceModalProps) {
  const [baseName, setBaseName] = useState<string>(initialBaseName);
  const [width, setWidth] = useState<string>(String(initialWidth));
  const [height, setHeight] = useState<string>(String(initialHeight));
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setBaseName(initialBaseName);
    setWidth(String(initialWidth));
    setHeight(String(initialHeight));
  }, [initialBaseName, initialHeight, initialWidth, isOpen]);

  const handleShown = useCallback(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, []);

  const handleHidden = useCallback(() => {
    setBaseName(initialBaseName);
    setWidth(String(initialWidth));
    setHeight(String(initialHeight));
    onClose();
  }, [initialBaseName, initialHeight, initialWidth, onClose]);

  const modalRef = useBootstrapModal({
    isOpen,
    keyboard: true,
    onShown: handleShown,
    onHidden: handleHidden
  });

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const parsedWidth = Number.parseInt(width, 10);
      const parsedHeight = Number.parseInt(height, 10);
      if (!Number.isFinite(parsedWidth) || !Number.isFinite(parsedHeight)) {
        onValidationError('スライスの幅 / 高さは数値で指定してください');
        return;
      }
      if (parsedWidth < 1 || parsedHeight < 1) {
        onValidationError('スライスの幅 / 高さは 1 以上にしてください');
        return;
      }
      if (parsedWidth > canvasSize || parsedHeight > canvasSize) {
        onValidationError(`スライスの幅 / 高さはキャンバスサイズ (${canvasSize}) 以下にしてください`);
        return;
      }

      const accepted = onApply({
        baseName,
        width: parsedWidth,
        height: parsedHeight
      });
      if (accepted) {
        onClose();
      }
    },
    [baseName, canvasSize, height, onApply, onClose, onValidationError, width]
  );

  return (
    <div ref={modalRef} className="modal fade" tabIndex={-1} aria-labelledby="auto-slice-modal-title" aria-hidden="true">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow">
          <form onSubmit={handleSubmit}>
            <div className="modal-header">
              <div>
                <h2 id="auto-slice-modal-title" className="modal-title fs-5 d-inline-flex align-items-center gap-2">
                  <i className="fa-solid fa-table-cells-large" aria-hidden="true" />
                  <span>自動スライス</span>
                </h2>
              </div>
              <button type="button" className="btn-close" aria-label="閉じる" onClick={onClose} />
            </div>
            <div className="modal-body py-4 d-flex flex-column gap-3">
              <div>
                <label htmlFor="auto-slice-name-input" className="form-label">
                  スライス名
                </label>
                <input
                  ref={nameInputRef}
                  id="auto-slice-name-input"
                  type="text"
                  className="form-control"
                  value={baseName}
                  onChange={(event) => setBaseName(event.target.value)}
                />
                <div className="form-text">生成名は `{`{sliceName}-{index}`}` です。空の場合は `slice` を使用します。</div>
              </div>

              <div className="row g-3">
                <div className="col-6">
                  <label htmlFor="auto-slice-width-input" className="form-label">
                    W
                  </label>
                  <input
                    id="auto-slice-width-input"
                    type="number"
                    min={1}
                    max={canvasSize}
                    className="form-control"
                    value={width}
                    onChange={(event) => setWidth(event.target.value)}
                  />
                </div>
                <div className="col-6">
                  <label htmlFor="auto-slice-height-input" className="form-label">
                    H
                  </label>
                  <input
                    id="auto-slice-height-input"
                    type="number"
                    min={1}
                    max={canvasSize}
                    className="form-control"
                    value={height}
                    onChange={(event) => setHeight(event.target.value)}
                  />
                </div>
              </div>

              <div className="form-text">右端 / 下端の端数は無視されます。既存のスライスはすべて置き換えられます。</div>
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
                  <span>生成</span>
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
