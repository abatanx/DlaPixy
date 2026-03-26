/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { PALETTE_CAPTION_MAX_LENGTH } from '../../editor/constants';
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { getTransparentBackgroundSurfaceClassName } from '../../editor/transparent-background';
import type { PaletteEntry } from '../../editor/types';
import { hexToRgba, hsvaToRgba, normalizeColorHex, normalizePaletteCaption, rgbaToHex8, rgbaToHsva } from '../../editor/utils';
import { useBootstrapModal } from './useBootstrapModal';
import type { TransparentBackgroundMode } from '../../../shared/transparent-background';

type PaletteColorModalProps = {
  isOpen: boolean;
  transparentBackgroundMode: TransparentBackgroundMode;
  selectedPalette: PaletteEntry;
  palette: PaletteEntry[];
  paletteEditTarget?: string | null;
  onApply: (value: PaletteEntry) => void;
  onClose: () => void;
};

type RgbaChannels = {
  r: number;
  g: number;
  b: number;
  a: number;
};

type HsvaChannels = {
  h: number;
  s: number;
  v: number;
  a: number;
};

function splitColorHexInput(color: string): { rgb: string; alpha: string } {
  const normalized = normalizeColorHex(color) ?? '#000000FF';
  return {
    rgb: normalized.slice(0, 7).toUpperCase(),
    alpha: normalized.slice(7, 9).toUpperCase()
  };
}

function normalizeRgbHexInput(value: string): string | null {
  const trimmed = value.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
    return null;
  }
  return `#${trimmed.replace(/^#/, '').toUpperCase()}`;
}

function normalizeAlphaHexInput(value: string): string | null {
  const trimmed = value.trim();
  if (!/^[0-9a-fA-F]{2}$/.test(trimmed)) {
    return null;
  }
  return trimmed.toUpperCase();
}

function buildLinearGradient(stops: string[]): string {
  return `linear-gradient(90deg, ${stops.map((color, index) => `${color} ${(index / Math.max(stops.length - 1, 1)) * 100}%`).join(', ')})`;
}

function roundHsvaForInput(hsva: { h: number; s: number; v: number }, alphaByte: number): HsvaChannels {
  return {
    h: Math.round(hsva.h),
    s: Math.round(hsva.s),
    v: Math.round(hsva.v),
    a: Math.round((alphaByte / 255) * 100)
  };
}

function getCircularHueDelta(nextHue: number, previousHue: number): number {
  return ((nextHue - previousHue + 540) % 360) - 180;
}

function formatSignedDelta(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}

function buildRgbaSliderPreview(channel: keyof RgbaChannels, rgba: RgbaChannels): string {
  switch (channel) {
    case 'r':
      return buildLinearGradient([rgbaToHex8(0, rgba.g, rgba.b, rgba.a), rgbaToHex8(255, rgba.g, rgba.b, rgba.a)]);
    case 'g':
      return buildLinearGradient([rgbaToHex8(rgba.r, 0, rgba.b, rgba.a), rgbaToHex8(rgba.r, 255, rgba.b, rgba.a)]);
    case 'b':
      return buildLinearGradient([rgbaToHex8(rgba.r, rgba.g, 0, rgba.a), rgbaToHex8(rgba.r, rgba.g, 255, rgba.a)]);
    case 'a':
      return buildLinearGradient([rgbaToHex8(rgba.r, rgba.g, rgba.b, 0), rgbaToHex8(rgba.r, rgba.g, rgba.b, 255)]);
    default:
      return buildLinearGradient([rgbaToHex8(rgba.r, rgba.g, rgba.b, rgba.a), rgbaToHex8(rgba.r, rgba.g, rgba.b, rgba.a)]);
  }
}

function buildHsvaSliderPreview(channel: 'h' | 's' | 'v', hsva: HsvaChannels, alphaByte: number): string {
  switch (channel) {
    case 'h':
      return buildLinearGradient(
        [0, 60, 120, 180, 240, 300, 360].map((hue) => {
          const rgba = hsvaToRgba(hue, hsva.s, hsva.v, alphaByte / 255);
          return rgbaToHex8(rgba.r, rgba.g, rgba.b, rgba.a);
        })
      );
    case 's': {
      const low = hsvaToRgba(hsva.h, 0, hsva.v, alphaByte / 255);
      const high = hsvaToRgba(hsva.h, 100, hsva.v, alphaByte / 255);
      return buildLinearGradient([rgbaToHex8(low.r, low.g, low.b, low.a), rgbaToHex8(high.r, high.g, high.b, high.a)]);
    }
    case 'v': {
      const low = hsvaToRgba(hsva.h, hsva.s, 0, alphaByte / 255);
      const high = hsvaToRgba(hsva.h, hsva.s, 100, alphaByte / 255);
      return buildLinearGradient([rgbaToHex8(low.r, low.g, low.b, low.a), rgbaToHex8(high.r, high.g, high.b, high.a)]);
    }
    default:
      return buildLinearGradient(['#00000000', '#000000ff']);
  }
}

export function PaletteColorModal({
  isOpen,
  transparentBackgroundMode,
  selectedPalette,
  palette,
  paletteEditTarget = selectedPalette.color,
  onApply,
  onClose
}: PaletteColorModalProps) {
  const initialHexParts = splitColorHexInput(selectedPalette.color);
  const [pendingHexRgbInput, setPendingHexRgbInput] = useState<string>(initialHexParts.rgb);
  const [pendingAlphaHexInput, setPendingAlphaHexInput] = useState<string>(initialHexParts.alpha);
  const [pendingCaptionInput, setPendingCaptionInput] = useState<string>(normalizePaletteCaption(selectedPalette.caption));
  const [pendingLocked, setPendingLocked] = useState<boolean>(selectedPalette.locked);
  const [pendingRgba, setPendingRgba] = useState<RgbaChannels>(() => hexToRgba(selectedPalette.color));
  const [pendingHsva, setPendingHsva] = useState<HsvaChannels>(() => {
    const rgba = hexToRgba(selectedPalette.color);
    return roundHsvaForInput(rgbaToHsva(rgba.r, rgba.g, rgba.b, rgba.a), rgba.a);
  });
  const [validationMessage, setValidationMessage] = useState<string>('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const originalRgba = hexToRgba(selectedPalette.color);
  const originalHsva = roundHsvaForInput(rgbaToHsva(originalRgba.r, originalRgba.g, originalRgba.b, originalRgba.a), originalRgba.a);
  const hsvDelta = {
    h: getCircularHueDelta(pendingHsva.h, originalHsva.h),
    s: pendingHsva.s - originalHsva.s,
    v: pendingHsva.v - originalHsva.v
  };
  const originalColorHex = (normalizeColorHex(selectedPalette.color) ?? '#000000ff').toUpperCase();
  const currentColorHex = rgbaToHex8(pendingRgba.r, pendingRgba.g, pendingRgba.b, pendingRgba.a).toUpperCase();
  const transparentBackgroundClassName = getTransparentBackgroundSurfaceClassName(transparentBackgroundMode);

  const syncFromRgba = useCallback((nextRgba: RgbaChannels) => {
    setPendingRgba(nextRgba);
    setPendingHsva(roundHsvaForInput(rgbaToHsva(nextRgba.r, nextRgba.g, nextRgba.b, nextRgba.a), nextRgba.a));
    const nextHex = rgbaToHex8(nextRgba.r, nextRgba.g, nextRgba.b, nextRgba.a).toUpperCase();
    setPendingHexRgbInput(nextHex.slice(0, 7));
    setPendingAlphaHexInput(nextHex.slice(7, 9));
    setValidationMessage('');
  }, []);

  const syncFromHsva = useCallback((nextHsva: HsvaChannels) => {
    const nextRgba = hsvaToRgba(nextHsva.h, nextHsva.s, nextHsva.v, nextHsva.a / 100);
    setPendingHsva(nextHsva);
    setPendingRgba({
      r: nextRgba.r,
      g: nextRgba.g,
      b: nextRgba.b,
      a: nextRgba.a
    });
    const nextHex = rgbaToHex8(nextRgba.r, nextRgba.g, nextRgba.b, nextRgba.a).toUpperCase();
    setPendingHexRgbInput(nextHex.slice(0, 7));
    setPendingAlphaHexInput(nextHex.slice(7, 9));
    setValidationMessage('');
  }, []);

  const syncPendingState = useCallback(() => {
    syncFromRgba(hexToRgba(selectedPalette.color));
    setPendingCaptionInput(normalizePaletteCaption(selectedPalette.caption));
    setPendingLocked(selectedPalette.locked);
  }, [selectedPalette.caption, selectedPalette.color, selectedPalette.locked, syncFromRgba]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    syncPendingState();
  }, [isOpen, syncPendingState]);

  const handleShown = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleHidden = useCallback(() => {
    syncPendingState();
    onClose();
  }, [onClose, syncPendingState]);

  const modalRef = useBootstrapModal({
    isOpen,
    keyboard: true,
    onShown: handleShown,
    onHidden: handleHidden
  });

  const handleHexRgbInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value.toUpperCase();
      setPendingHexRgbInput(nextValue);
      setValidationMessage('');

      const normalizedRgb = normalizeRgbHexInput(nextValue);
      const normalizedAlpha = normalizeAlphaHexInput(pendingAlphaHexInput);
      if (!normalizedRgb || !normalizedAlpha) {
        return;
      }

      syncFromRgba(hexToRgba(`${normalizedRgb}${normalizedAlpha}`));
    },
    [pendingAlphaHexInput, syncFromRgba]
  );

  const handleAlphaHexInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value.toUpperCase();
      setPendingAlphaHexInput(nextValue);
      setValidationMessage('');

      const normalizedRgb = normalizeRgbHexInput(pendingHexRgbInput);
      const normalizedAlpha = normalizeAlphaHexInput(nextValue);
      if (!normalizedRgb || !normalizedAlpha) {
        return;
      }

      syncFromRgba(hexToRgba(`${normalizedRgb}${normalizedAlpha}`));
    },
    [pendingHexRgbInput, syncFromRgba]
  );

  const handleCaptionInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setPendingCaptionInput(normalizePaletteCaption(event.target.value));
  }, []);

  const handleRgbaChannelChange = useCallback(
    (channel: keyof RgbaChannels, value: string) => {
      const parsed = Number.parseInt(value, 10);
      const safeValue = Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 255)) : 0;
      syncFromRgba({
        ...pendingRgba,
        [channel]: safeValue
      });
    },
    [pendingRgba, syncFromRgba]
  );

  const handleHsvaChannelChange = useCallback(
    (channel: 'h' | 's' | 'v', value: string) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) {
        return;
      }

      const nextHsva: HsvaChannels = {
        ...pendingHsva,
        [channel]:
          channel === 'h'
            ? Math.max(0, Math.min(parsed, 360))
            : Math.max(0, Math.min(parsed, 100))
      };

      syncFromHsva(nextHsva);
    },
    [pendingHsva, syncFromHsva]
  );

  const handleAlphaPercentChange = useCallback(
    (value: string) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) {
        return;
      }
      const safePercent = Math.max(0, Math.min(parsed, 100));
      syncFromHsva({
        ...pendingHsva,
        a: safePercent
      });
    },
    [pendingHsva, syncFromHsva]
  );

  const normalizedPendingRgb = normalizeRgbHexInput(pendingHexRgbInput);
  const normalizedPendingAlpha = normalizeAlphaHexInput(pendingAlphaHexInput);
  const normalizedPendingColor =
    normalizedPendingRgb !== null && normalizedPendingAlpha !== null
      ? normalizeColorHex(`${normalizedPendingRgb}${normalizedPendingAlpha}`)
      : null;
  const hasDuplicatePaletteColor =
    normalizedPendingColor !== null &&
    normalizedPendingColor !== paletteEditTarget &&
    palette.some((entry) => entry.color === normalizedPendingColor);
  const effectiveValidationMessage =
    validationMessage || (hasDuplicatePaletteColor ? 'パレットに同じ色がすでにあります' : '');
  const hasValidationError = effectiveValidationMessage.length > 0;
  const feedbackMessage = hasValidationError ? effectiveValidationMessage : 'OK';
  const feedbackClassName = hasValidationError ? 'palette-color-modal-feedback text-danger' : 'palette-color-modal-feedback text-success';

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!normalizedPendingRgb) {
        setValidationMessage('HEX は #RRGGBB 形式で入力してください');
        return;
      }
      if (!normalizedPendingAlpha) {
        setValidationMessage('A は 00〜FF の 2 桁で入力してください');
        return;
      }
      if (hasDuplicatePaletteColor) {
        setValidationMessage('パレットに同じ色がすでにあります');
        return;
      }

      const nextColor = normalizedPendingColor;
      if (!nextColor) {
        setValidationMessage('HEX は #RRGGBB 形式で入力してください');
        return;
      }
      onApply({
        color: nextColor,
        caption: normalizePaletteCaption(pendingCaptionInput),
        locked: pendingLocked
      });
      onClose();
    },
    [hasDuplicatePaletteColor, normalizedPendingAlpha, normalizedPendingColor, normalizedPendingRgb, onApply, onClose, pendingCaptionInput, pendingLocked]
  );

  return (
    <div
      ref={modalRef}
      className="modal fade"
      tabIndex={-1}
      aria-labelledby="palette-color-modal-title"
      aria-hidden="true"
    >
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content shadow">
          <form onSubmit={handleSubmit}>
            <div className="modal-header">
              <div>
                <h2 id="palette-color-modal-title" className="modal-title fs-5 d-inline-flex align-items-center gap-2">
                  <i className="fa-solid fa-palette" aria-hidden="true" />
                  <span>色を選択</span>
                </h2>
              </div>
              <button type="button" className="btn-close" aria-label="閉じる" onClick={onClose} />
            </div>
            <div className="modal-body py-4">
              <div className="row g-3 mb-4">
                <div className="col-12">
                  <label htmlFor="palette-color-caption-input" className="form-label">Caption</label>
                  <input
                    id="palette-color-caption-input"
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    className="form-control font-monospace"
                    value={pendingCaptionInput}
                    onChange={handleCaptionInputChange}
                    placeholder={`${PALETTE_CAPTION_MAX_LENGTH}文字まで`}
                    maxLength={PALETTE_CAPTION_MAX_LENGTH}
                  />
                </div>
                <div className="col-12">
                  <div className="form-check form-switch palette-color-modal-lock-switch">
                    <input
                      id="palette-color-lock-input"
                      type="checkbox"
                      className="form-check-input"
                      checked={pendingLocked}
                      onChange={(event) => setPendingLocked(event.target.checked)}
                    />
                    <label htmlFor="palette-color-lock-input" className="form-check-label d-inline-flex align-items-center gap-2">
                      <i className={`fa-solid ${pendingLocked ? 'fa-lock' : 'fa-lock-open'}`} aria-hidden="true" />
                      <span>{pendingLocked ? 'ロック中' : 'ロック解除中'}</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="palette-color-modal-preview mb-4">
                <div className="palette-color-modal-preview-item">
                  <div className={`palette-color-modal-preview-swatch ${transparentBackgroundClassName}`} aria-hidden="true">
                    <div className="palette-color-modal-preview-swatch-fill" style={{ backgroundColor: originalColorHex }} />
                  </div>
                  <div className="palette-color-modal-preview-meta">
                    <div className="small text-uppercase text-secondary fw-semibold">Before</div>
                    <div className="font-monospace fs-5">{originalColorHex}</div>
                  </div>
                </div>
                <div className="palette-color-modal-preview-delta">
                  <div className="small text-uppercase text-secondary fw-semibold">Delta HSV</div>
                  <div className="palette-color-modal-preview-delta-values font-monospace">
                    <span>H {formatSignedDelta(hsvDelta.h)}</span>
                    <span>S {formatSignedDelta(hsvDelta.s)}</span>
                    <span>V {formatSignedDelta(hsvDelta.v)}</span>
                  </div>
                </div>
                <div className="palette-color-modal-preview-arrow text-secondary" aria-hidden="true">
                  <i className="fa-solid fa-arrow-right" />
                </div>
                <div className="palette-color-modal-preview-item">
                  <div className={`palette-color-modal-preview-swatch ${transparentBackgroundClassName}`} aria-hidden="true">
                    <div className="palette-color-modal-preview-swatch-fill" style={{ backgroundColor: currentColorHex }} />
                  </div>
                  <div className="palette-color-modal-preview-meta">
                    <div className="small text-uppercase text-secondary fw-semibold">Current Color</div>
                    <div className="font-monospace fs-5">{currentColorHex}</div>
                  </div>
                </div>
              </div>
              <div className="row g-3 mb-4">
                <div className="col-sm-8">
                  <label htmlFor="palette-color-hex-input" className="form-label">HEX</label>
                  <input
                    ref={inputRef}
                    id="palette-color-hex-input"
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    className={`form-control font-monospace ${hasValidationError ? 'is-invalid' : ''}`}
                    value={pendingHexRgbInput}
                    onChange={handleHexRgbInputChange}
                    placeholder="#RRGGBB"
                  />
                </div>
                <div className="col-sm-4">
                  <label htmlFor="palette-color-alpha-hex-input" className="form-label">A</label>
                  <input
                    id="palette-color-alpha-hex-input"
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    className={`form-control font-monospace ${hasValidationError ? 'is-invalid' : ''}`}
                    value={pendingAlphaHexInput}
                    onChange={handleAlphaHexInputChange}
                    placeholder="FF"
                    maxLength={2}
                  />
                </div>
                <div className="col-12">
                  <div className={feedbackClassName}>{feedbackMessage}</div>
                </div>
              </div>
              <div className="small text-uppercase text-secondary fw-semibold mb-2">RGBA</div>
              {(['r', 'g', 'b', 'a'] as const).map((channel) => (
                <div key={channel} className="palette-color-modal-slider-row">
                  <label htmlFor={`palette-color-${channel}`} className="palette-color-modal-slider-label">
                    {channel.toUpperCase()}
                  </label>
                  <div className="palette-color-modal-slider-control">
                    <div className={`palette-color-modal-slider-preview ${transparentBackgroundClassName}`} aria-hidden="true">
                      <div
                        className="palette-color-modal-slider-preview-fill"
                        style={{ backgroundImage: buildRgbaSliderPreview(channel, pendingRgba) }}
                      />
                    </div>
                    <input
                      id={`palette-color-${channel}`}
                      type="range"
                      min={0}
                      max={255}
                      className="form-range mb-0"
                      value={pendingRgba[channel]}
                      onChange={(event) => handleRgbaChannelChange(channel, event.target.value)}
                    />
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={255}
                    step={1}
                    className="form-control form-control-sm palette-color-modal-channel-value font-monospace"
                    value={pendingRgba[channel]}
                    onChange={(event) => handleRgbaChannelChange(channel, event.target.value)}
                  />
                </div>
              ))}
              <div className="small text-uppercase text-secondary fw-semibold mt-4 mb-2">HSV</div>
              {([
                ['h', 360],
                ['s', 100],
                ['v', 100]
              ] as const).map(([channel, max]) => (
                <div key={channel} className="palette-color-modal-slider-row">
                  <label htmlFor={`palette-color-${channel}`} className="palette-color-modal-slider-label">
                    {channel.toUpperCase()}
                  </label>
                  <div className="palette-color-modal-slider-control">
                    <div className={`palette-color-modal-slider-preview ${transparentBackgroundClassName}`} aria-hidden="true">
                      <div
                        className="palette-color-modal-slider-preview-fill"
                        style={{ backgroundImage: buildHsvaSliderPreview(channel, pendingHsva, pendingRgba.a) }}
                      />
                    </div>
                    <input
                      id={`palette-color-${channel}`}
                      type="range"
                      min={0}
                      max={max}
                      step={1}
                      className="form-range mb-0"
                      value={pendingHsva[channel]}
                      onChange={(event) => handleHsvaChannelChange(channel, event.target.value)}
                    />
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={max}
                    step={1}
                    className="form-control form-control-sm palette-color-modal-channel-value font-monospace"
                    value={pendingHsva[channel]}
                    onChange={(event) => handleHsvaChannelChange(channel, event.target.value)}
                  />
                </div>
              ))}
              <div className="palette-color-modal-slider-row mt-3">
                <label htmlFor="palette-color-alpha-percent" className="palette-color-modal-slider-label">A%</label>
                <div className="palette-color-modal-slider-control">
                  <div className={`palette-color-modal-slider-preview ${transparentBackgroundClassName}`} aria-hidden="true">
                    <div
                      className="palette-color-modal-slider-preview-fill"
                      style={{ backgroundImage: buildRgbaSliderPreview('a', pendingRgba) }}
                    />
                  </div>
                  <input
                    id="palette-color-alpha-percent"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    className="form-range mb-0"
                    value={pendingHsva.a}
                    onChange={(event) => handleAlphaPercentChange(event.target.value)}
                  />
                </div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className="form-control form-control-sm palette-color-modal-channel-value font-monospace"
                  value={pendingHsva.a}
                  onChange={(event) => handleAlphaPercentChange(event.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                <span className="d-inline-flex align-items-center gap-2">
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                  <span>キャンセル</span>
                </span>
              </button>
              <button type="submit" className="btn btn-primary" disabled={hasDuplicatePaletteColor}>
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
