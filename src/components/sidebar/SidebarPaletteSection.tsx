import { memo, useCallback } from 'react';
import type { ChangeEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { SidebarPaletteSectionProps } from './types';

export const SidebarPaletteSection = memo(function SidebarPaletteSection({
  selectedColor,
  setSelectedColor,
  addColorToPalette,
  palette,
  setHoveredPaletteColor
}: SidebarPaletteSectionProps) {
  const handleColorChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setSelectedColor(event.target.value);
      addColorToPalette(event.target.value);
    },
    [addColorToPalette, setSelectedColor]
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
    <div className="mb-3">
      <label className="form-label">色</label>
      <input
        type="color"
        className="form-control form-control-color mb-2"
        value={selectedColor}
        onChange={handleColorChange}
      />
      <div className="palette-grid">
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
          />
        ))}
      </div>
    </div>
  );
});
