import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { hexToRgba, hsvaToRgba, normalizeColorHex, rgbaToHex8, rgbaToHsva } from '../../editor/utils';
import { useBootstrapModal } from './useBootstrapModal';

type PaletteColorModalProps = {
  isOpen: boolean;
  selectedColor: string;
  onApply: (value: string) => void;
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

export function PaletteColorModal({ isOpen, selectedColor, onApply, onClose }: PaletteColorModalProps) {
  const [pendingHexInput, setPendingHexInput] = useState<string>(selectedColor);
  const [pendingRgba, setPendingRgba] = useState<RgbaChannels>(() => hexToRgba(selectedColor));
  const [pendingHsva, setPendingHsva] = useState<HsvaChannels>(() => {
    const rgba = hexToRgba(selectedColor);
    return roundHsvaForInput(rgbaToHsva(rgba.r, rgba.g, rgba.b, rgba.a), rgba.a);
  });
  const [validationMessage, setValidationMessage] = useState<string>('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const syncFromRgba = useCallback((nextRgba: RgbaChannels) => {
    setPendingRgba(nextRgba);
    setPendingHsva(roundHsvaForInput(rgbaToHsva(nextRgba.r, nextRgba.g, nextRgba.b, nextRgba.a), nextRgba.a));
    setPendingHexInput(rgbaToHex8(nextRgba.r, nextRgba.g, nextRgba.b, nextRgba.a));
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
    setPendingHexInput(rgbaToHex8(nextRgba.r, nextRgba.g, nextRgba.b, nextRgba.a));
    setValidationMessage('');
  }, []);

  const syncPendingState = useCallback(() => {
    syncFromRgba(hexToRgba(selectedColor));
  }, [selectedColor, syncFromRgba]);

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
    onShown: handleShown,
    onHidden: handleHidden
  });

  const handleHexInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setPendingHexInput(nextValue);

    const normalized = normalizeColorHex(nextValue);
    if (!normalized) {
      return;
    }

    syncFromRgba(hexToRgba(normalized));
  }, [syncFromRgba]);

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

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const normalized = normalizeColorHex(pendingHexInput);
      if (!normalized) {
        setValidationMessage('カラーコードは #RRGGBB または #RRGGBBAA 形式で入力してください');
        return;
      }

      onApply(normalized);
      onClose();
    },
    [onApply, onClose, pendingHexInput]
  );

  return (
    <div
      ref={modalRef}
      className="modal fade"
      tabIndex={-1}
      aria-labelledby="palette-color-modal-title"
      aria-hidden="true"
    >
      <div className="modal-dialog modal-dialog-centered">
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
              <div className="palette-color-modal-preview mb-4">
                <div className="palette-color-modal-preview-swatch" aria-hidden="true">
                  <div
                    className="palette-color-modal-preview-swatch-fill"
                    style={{ backgroundColor: rgbaToHex8(pendingRgba.r, pendingRgba.g, pendingRgba.b, pendingRgba.a) }}
                  />
                </div>
                <div className="palette-color-modal-preview-meta">
                  <div className="small text-uppercase text-secondary fw-semibold">Current Color</div>
                  <div className="font-monospace fs-5">
                    {rgbaToHex8(pendingRgba.r, pendingRgba.g, pendingRgba.b, pendingRgba.a).toUpperCase()}
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <label htmlFor="palette-color-hex-input" className="form-label">HEX</label>
                <input
                  ref={inputRef}
                  id="palette-color-hex-input"
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className={`form-control font-monospace ${validationMessage ? 'is-invalid' : ''}`}
                  value={pendingHexInput}
                  onChange={handleHexInputChange}
                  placeholder="#RRGGBBAA"
                />
                {validationMessage ? <div className="invalid-feedback">{validationMessage}</div> : null}
              </div>
              <div className="small text-uppercase text-secondary fw-semibold mb-2">RGBA</div>
              {(['r', 'g', 'b', 'a'] as const).map((channel) => (
                <div key={channel} className="palette-color-modal-slider-row">
                  <label htmlFor={`palette-color-${channel}`} className="palette-color-modal-slider-label">
                    {channel.toUpperCase()}
                  </label>
                  <div className="palette-color-modal-slider-control">
                    <div className="palette-color-modal-slider-preview" aria-hidden="true">
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
                    <div className="palette-color-modal-slider-preview" aria-hidden="true">
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
                  <div className="palette-color-modal-slider-preview" aria-hidden="true">
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
