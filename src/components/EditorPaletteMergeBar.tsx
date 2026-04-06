/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { memo, useMemo } from 'react';
import type { PaletteUsageEntry } from '../editor/palette-sync';
import type { PaletteEntry } from '../editor/types';

type EditorPaletteMergeBarProps = {
  palette: PaletteEntry[];
  paletteUsageByColor: Record<string, PaletteUsageEntry>;
  paletteMergeSelection: string[];
  paletteMergeDestinationColor: string | null;
  selectPaletteMergeDestination: (color: string) => void;
  removePaletteMergeColor: (color: string) => void;
  clearPaletteMergeSelection: () => void;
  removePaletteColors: (selectedColors: string[]) => boolean;
  mergePaletteColors: (selectedColors: string[], destinationColor: string) => boolean;
};

export const EditorPaletteMergeBar = memo(function EditorPaletteMergeBar({
  palette,
  paletteUsageByColor,
  paletteMergeSelection,
  paletteMergeDestinationColor,
  selectPaletteMergeDestination,
  removePaletteMergeColor,
  clearPaletteMergeSelection,
  removePaletteColors,
  mergePaletteColors
}: EditorPaletteMergeBarProps) {
  const selectedPaletteMergeEntries = useMemo(
    () => palette.filter((entry) => paletteMergeSelection.includes(entry.color)),
    [palette, paletteMergeSelection]
  );
  const showPaletteMergeUi = paletteMergeSelection.length >= 2;
  const canApplyPaletteMerge =
    paletteMergeSelection.length >= 2 &&
    paletteMergeDestinationColor !== null &&
    paletteMergeSelection.includes(paletteMergeDestinationColor);
  const paletteMergeReplaceCount = useMemo(() => {
    if (!paletteMergeDestinationColor) {
      return 0;
    }

    return paletteMergeSelection.reduce((total, color) => {
      if (color === paletteMergeDestinationColor) {
        return total;
      }
      return total + (paletteUsageByColor[color]?.count ?? 0);
    }, 0);
  }, [paletteMergeDestinationColor, paletteMergeSelection, paletteUsageByColor]);
  const paletteMergeRemovalCount = useMemo(
    () =>
      selectedPaletteMergeEntries.reduce((total, entry) => {
        if (entry.color === paletteMergeDestinationColor || entry.locked) {
          return total;
        }
        return total + 1;
      }, 0),
    [paletteMergeDestinationColor, selectedPaletteMergeEntries]
  );
  const paletteMergePreservedLockedCount = useMemo(
    () =>
      selectedPaletteMergeEntries.reduce((total, entry) => {
        if (entry.color === paletteMergeDestinationColor || !entry.locked) {
          return total;
        }
        return total + 1;
      }, 0),
    [paletteMergeDestinationColor, selectedPaletteMergeEntries]
  );

  if (!showPaletteMergeUi) {
    return null;
  }

  const handleApply = () => {
    if (!canApplyPaletteMerge || !paletteMergeDestinationColor) {
      return;
    }

    if (mergePaletteColors(paletteMergeSelection, paletteMergeDestinationColor)) {
      clearPaletteMergeSelection();
    }
  };

  const handleDelete = () => {
    void removePaletteColors(paletteMergeSelection);
  };

  return (
    <section className="card shadow-sm editor-palette-merge-card">
      <div className="card-body editor-palette-merge-body">
        <div className="editor-palette-merge-header">
          <div className="editor-palette-merge-copy">
            <div className="editor-palette-merge-kicker">Palette Merge</div>
            <div className="sidebar-palette-merge-title">{paletteMergeSelection.length}色 → 1色</div>
            <div className="sidebar-palette-merge-summary">
              削除 {paletteMergeRemovalCount}
              {paletteMergePreservedLockedCount > 0 ? ` / 保持 ${paletteMergePreservedLockedCount}` : ''}
              {` / 置換 ${paletteMergeReplaceCount.toLocaleString()}px`}
            </div>
          </div>
          <div className="sidebar-palette-merge-actions">
            <button
              type="button"
              className="btn btn-sm btn-danger editor-palette-merge-action-btn editor-palette-merge-action-btn-labeled"
              onClick={handleApply}
              disabled={!canApplyPaletteMerge}
              title="選択色を統合"
              aria-label="選択色を統合"
            >
              <i className="fa-solid fa-arrows-to-dot" aria-hidden="true" />
              <span>統合</span>
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger editor-palette-merge-action-btn editor-palette-merge-action-btn-labeled"
              onClick={handleDelete}
              title="選択色を削除"
              aria-label="選択色を削除"
            >
              <i className="fa-solid fa-trash-can" aria-hidden="true" />
              <span>削除</span>
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary editor-palette-merge-action-btn"
              onClick={clearPaletteMergeSelection}
              title="統合バーを閉じる"
              aria-label="統合バーを閉じる"
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="sidebar-palette-merge-destination-list" role="list" aria-label="merge destination colors">
          {selectedPaletteMergeEntries.map((entry) => (
            <div
              key={`merge-destination-${entry.color}`}
              className={`sidebar-palette-merge-destination ${
                paletteMergeDestinationColor === entry.color ? 'active' : ''
              }`}
            >
              <button
                type="button"
                className="sidebar-palette-merge-destination-select"
                onClick={() => selectPaletteMergeDestination(entry.color)}
                aria-pressed={paletteMergeDestinationColor === entry.color}
                title={`統合先にする: ${entry.color.toUpperCase()}`}
              >
                <span className="sidebar-palette-merge-destination-swatch" aria-hidden="true">
                  <span
                    className="sidebar-palette-merge-destination-swatch-fill"
                    style={{ backgroundColor: entry.color }}
                  />
                </span>
                <span className="sidebar-palette-merge-destination-label">{entry.color.toUpperCase()}</span>
                {paletteMergeDestinationColor === entry.color ? (
                  <span className="sidebar-palette-merge-destination-badge">残</span>
                ) : null}
              </button>
              <button
                type="button"
                className="sidebar-palette-merge-destination-remove"
                onClick={() => removePaletteMergeColor(entry.color)}
                title={`選択から外す: ${entry.color.toUpperCase()}`}
                aria-label={`選択から外す: ${entry.color.toUpperCase()}`}
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});
