import { memo, useCallback } from 'react';
import type { ChangeEvent, FormEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { SidebarPaletteSectionProps } from './types';

export const SidebarPaletteSection = memo(function SidebarPaletteSection({
  selectedColor,
  setSelectedColor,
  palette,
  setHoveredPaletteColor,
  addSelectedColorToPalette,
  removeSelectedColorFromPalette
}: SidebarPaletteSectionProps) {
  const isSelectedColorInPalette = palette.includes(selectedColor);

  const handleColorInput = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      setSelectedColor(event.currentTarget.value);
    },
    [setSelectedColor]
  );

  const handleColorCommit = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setSelectedColor(event.target.value);
    },
    [setSelectedColor]
  );

  const handlePaletteClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      setSelectedColor(event.currentTarget.dataset.color ?? selectedColor);
    },
    [selectedColor, setSelectedColor]
  );

  const handlePaletteMouseEnter = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      const { color, index } = event.currentTarget.dataset;
      if (!color || index === undefined) {
        return;
      }
      setHoveredPaletteColor({ hex: color, index: Number.parseInt(index, 10) });
    },
    [setHoveredPaletteColor]
  );

  const handlePaletteMouseLeave = useCallback(() => {
    setHoveredPaletteColor(null);
  }, [setHoveredPaletteColor]);

  return (
    <div className="sidebar-palette-section mb-3">
      <div className="sidebar-palette-header">
        <label className="form-label font-monospace small mb-0">Palette</label>
        <span className="sidebar-palette-count">{palette.length} colors</span>
      </div>
      <div className="sidebar-palette-controls">
        <input
          type="color"
          className="form-control form-control-color"
          value={selectedColor}
          onInput={handleColorInput}
          onChange={handleColorCommit}
        />
        <div className="sidebar-palette-selected font-monospace">{selectedColor.toUpperCase()}</div>
        <button
          type="button"
          className="btn btn-sm sidebar-palette-action-btn sidebar-palette-action-btn-add"
          onClick={addSelectedColorToPalette}
          disabled={isSelectedColorInPalette}
          title="パレットに追加"
          aria-label="パレットに追加"
        >
          <i className="fa-solid fa-plus" aria-hidden="true" />
        </button>
        {isSelectedColorInPalette ? (
          <button
            type="button"
            className="btn btn-sm sidebar-palette-action-btn sidebar-palette-action-btn-remove"
            onClick={removeSelectedColorFromPalette}
            title="パレットから削除"
            aria-label="パレットから削除"
          >
            <i className="fa-solid fa-trash-can" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className="palette-grid-wrap">
        <div className="palette-grid" role="list" aria-label="palette colors">
          {palette.map((color, index) => (
            <button
              key={`${color}-${index}`}
              type="button"
              className={`palette-item ${selectedColor === color ? 'active' : ''}`}
              style={{ backgroundColor: color }}
              data-color={color}
              data-index={index}
              onClick={handlePaletteClick}
              onMouseEnter={handlePaletteMouseEnter}
              onMouseLeave={handlePaletteMouseLeave}
              title={color}
              aria-label={`palette color ${color}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
});
