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
  paletteMergeDestinationId: string | null;
  selectPaletteMergeDestination: (paletteId: string) => void;
  removePaletteMergeColor: (paletteId: string) => void;
  clearPaletteMergeSelection: () => void;
  removePaletteColors: (selectedColors: string[]) => boolean;
  mergePaletteColors: (selectedColors: string[], destinationColor: string) => boolean;
};

export const EditorPaletteMergeBar = memo(function EditorPaletteMergeBar({
  palette,
  paletteUsageByColor,
  paletteMergeSelection,
  paletteMergeDestinationId,
  selectPaletteMergeDestination,
  removePaletteMergeColor,
  clearPaletteMergeSelection,
  removePaletteColors,
  mergePaletteColors
}: EditorPaletteMergeBarProps) {
  const selectedPaletteMergeEntries = useMemo(
    () => palette.filter((entry) => paletteMergeSelection.includes(entry.id)),
    [palette, paletteMergeSelection]
  );
  const showPaletteMergeUi = paletteMergeSelection.length >= 2;
  const canApplyPaletteMerge =
    paletteMergeSelection.length >= 2 &&
    paletteMergeDestinationId !== null &&
    paletteMergeSelection.includes(paletteMergeDestinationId);
  const paletteMergeReplaceCount = useMemo(() => {
    if (!paletteMergeDestinationId) {
      return 0;
    }

    return selectedPaletteMergeEntries.reduce((total, entry) => {
      if (entry.id === paletteMergeDestinationId) {
        return total;
      }
      return total + (paletteUsageByColor[entry.color]?.count ?? 0);
    }, 0);
  }, [paletteMergeDestinationId, paletteUsageByColor, selectedPaletteMergeEntries]);
  const paletteMergeRemovalCount = useMemo(
    () =>
      selectedPaletteMergeEntries.reduce((total, entry) => {
        if (entry.id === paletteMergeDestinationId || entry.locked) {
          return total;
        }
        return total + 1;
      }, 0),
    [paletteMergeDestinationId, selectedPaletteMergeEntries]
  );
  const paletteMergePreservedLockedCount = useMemo(
    () =>
      selectedPaletteMergeEntries.reduce((total, entry) => {
        if (entry.id === paletteMergeDestinationId || !entry.locked) {
          return total;
        }
        return total + 1;
      }, 0),
    [paletteMergeDestinationId, selectedPaletteMergeEntries]
  );

  if (!showPaletteMergeUi) {
    return null;
  }

  const handleApply = () => {
    if (!canApplyPaletteMerge || !paletteMergeDestinationId) {
      return;
    }

    const destinationEntry = selectedPaletteMergeEntries.find((entry) => entry.id === paletteMergeDestinationId);
    if (!destinationEntry) {
      return;
    }

    const selectedColors = selectedPaletteMergeEntries.map((entry) => entry.color);
    if (mergePaletteColors(selectedColors, destinationEntry.color)) {
      clearPaletteMergeSelection();
    }
  };

  const handleDelete = () => {
    void removePaletteColors(selectedPaletteMergeEntries.map((entry) => entry.color));
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
              key={`merge-destination-${entry.id}`}
              className={`sidebar-palette-merge-destination ${
                paletteMergeDestinationId === entry.id ? 'active' : ''
              }`}
            >
              <button
                type="button"
                className="sidebar-palette-merge-destination-select"
                onClick={() => selectPaletteMergeDestination(entry.id)}
                aria-pressed={paletteMergeDestinationId === entry.id}
                title={`統合先にする: ${entry.color.toUpperCase()}`}
              >
                <span className="sidebar-palette-merge-destination-swatch" aria-hidden="true">
                  <span
                    className="sidebar-palette-merge-destination-swatch-fill"
                    style={{ backgroundColor: entry.color }}
                  />
                </span>
                <span className="sidebar-palette-merge-destination-label">{entry.color.toUpperCase()}</span>
                {paletteMergeDestinationId === entry.id ? (
                  <span className="sidebar-palette-merge-destination-badge">残</span>
                ) : null}
              </button>
              <button
                type="button"
                className="sidebar-palette-merge-destination-remove"
                onClick={() => removePaletteMergeColor(entry.id)}
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
