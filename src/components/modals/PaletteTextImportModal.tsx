/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { TransparentBackgroundMode } from '../../../shared/transparent-background';
import { PALETTE_CAPTION_MAX_LENGTH } from '../../editor/constants';
import { type PaletteTextImportPreview } from '../../editor/palette-text-import';
import { getTransparentBackgroundSurfaceClassName } from '../../editor/transparent-background';
import { normalizePaletteCaption } from '../../editor/utils';
import { useBootstrapModal } from './useBootstrapModal';

type PaletteTextImportModalProps = {
  isOpen: boolean;
  transparentBackgroundMode: TransparentBackgroundMode;
  initialText: string;
  initialCaption: string;
  initialLocked: boolean;
  resolvePreview: (text: string) => PaletteTextImportPreview;
  onApply: (args: { text: string; caption: string; locked: boolean }) => boolean;
  onClose: () => void;
};

export function PaletteTextImportModal({
  isOpen,
  transparentBackgroundMode,
  initialText,
  initialCaption,
  initialLocked,
  resolvePreview,
  onApply,
  onClose
}: PaletteTextImportModalProps) {
  const [pendingText, setPendingText] = useState<string>(initialText);
  const [pendingCaption, setPendingCaption] = useState<string>(normalizePaletteCaption(initialCaption));
  const [pendingLocked, setPendingLocked] = useState<boolean>(initialLocked);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const transparentBackgroundClassName = getTransparentBackgroundSurfaceClassName(transparentBackgroundMode);
  const preview = useMemo(() => resolvePreview(pendingText), [pendingText, resolvePreview]);
  const existingColors = useMemo(() => new Set(preview.existingColors), [preview.existingColors]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setPendingText(initialText);
    setPendingCaption(normalizePaletteCaption(initialCaption));
    setPendingLocked(initialLocked);
  }, [initialCaption, initialLocked, initialText, isOpen]);

  const handleShown = useCallback(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  const modalRef = useBootstrapModal({
    isOpen,
    keyboard: true,
    onShown: handleShown,
    onHidden: onClose
  });

  const handleTextChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setPendingText(event.target.value);
  }, []);

  const handleCaptionChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setPendingCaption(normalizePaletteCaption(event.target.value));
  }, []);

  const handleApply = useCallback(() => {
    if (onApply({
      text: pendingText,
      caption: pendingCaption,
      locked: pendingLocked
    })) {
      onClose();
    }
  }, [onApply, onClose, pendingCaption, pendingLocked, pendingText]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (preview.addableColors.length === 0) {
        return;
      }
      handleApply();
    },
    [handleApply, preview.addableColors.length]
  );

  return (
    <div
      ref={modalRef}
      className="modal fade"
      tabIndex={-1}
      aria-labelledby="palette-text-import-modal-title"
      aria-hidden="true"
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <form className="modal-content shadow" onSubmit={handleSubmit}>
          <div className="modal-header">
            <h2 id="palette-text-import-modal-title" className="modal-title fs-5">テキストからパレットの追加</h2>
            <button type="button" className="btn-close" aria-label="閉じる" onClick={onClose} />
          </div>
          <div className="modal-body py-3 d-flex flex-column gap-3">
            <textarea
              ref={textareaRef}
              id="palette-text-import-input"
              className="form-control font-monospace"
              rows={8}
              spellCheck={false}
              placeholder={`例:\n#FF0000 #00FF00\n336699CC, 0F0`}
              value={pendingText}
              onChange={handleTextChange}
            />
            {preview.extractedColors.length > 0 ? (
              <div className="palette-text-import-preview">
                {preview.extractedColors.map((color) => {
                  const isExisting = existingColors.has(color);
                  return (
                    <div
                      key={color}
                      className={`palette-text-import-preview-item ${isExisting ? 'is-existing' : ''}`}
                      title={isExisting ? `${color.toUpperCase()} / 既存` : color.toUpperCase()}
                    >
                      <span
                        className={`palette-text-import-preview-swatch ${transparentBackgroundClassName}`}
                        aria-hidden="true"
                      >
                        <span
                          className="palette-text-import-preview-swatch-fill"
                          style={{ backgroundColor: color }}
                        />
                        {isExisting ? (
                          <span className="palette-text-import-preview-badge">
                            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                            <span>既存</span>
                          </span>
                        ) : null}
                      </span>
                      <span className="palette-text-import-preview-label font-monospace">
                        {color.toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <div className="input-group input-group-sm">
              <span id="palette-text-import-caption-prefix" className="input-group-text" title="名前">
                <i className="fa-solid fa-tag" aria-hidden="true" />
                <span className="visually-hidden">名前</span>
              </span>
              <input
                type="text"
                className="form-control"
                value={pendingCaption}
                maxLength={PALETTE_CAPTION_MAX_LENGTH}
                onChange={handleCaptionChange}
                aria-describedby="palette-text-import-caption-prefix"
              />
            </div>
            <div className="form-check palette-color-modal-lock-switch">
              <input
                id="palette-text-import-lock"
                className="form-check-input"
                type="checkbox"
                checked={pendingLocked}
                onChange={(event) => setPendingLocked(event.target.checked)}
              />
              <label htmlFor="palette-text-import-lock" className="form-check-label">
                ロック状態で追加
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              キャンセル
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={preview.addableColors.length === 0}
            >
              追加
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
