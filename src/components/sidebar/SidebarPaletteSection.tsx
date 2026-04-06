/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { formatPaletteUsageLabel } from '../../editor/palette-sync';
import { PaletteColorModal } from '../modals/PaletteColorModal';
import type { SidebarPaletteSectionProps } from './types';

export const SidebarPaletteSection = memo(function SidebarPaletteSection({
  transparentBackgroundMode,
  selectedColor,
  setSelectedColor,
  applySelectedColorChange,
  palette,
  paletteUsageByColor,
  setHoveredPaletteColor,
  addPaletteColor,
  removeSelectedColorFromPalette,
  mergePaletteColors,
  jumpToPaletteUsage,
  paletteColorModalRequest
}: SidebarPaletteSectionProps) {
  const selectedPaletteEntry = useMemo(
    () => palette.find((entry) => entry.color === selectedColor) ?? null,
    [palette, selectedColor]
  );
  const isSelectedColorInPalette = selectedPaletteEntry !== null;
  const [isPaletteColorModalOpen, setIsPaletteColorModalOpen] = useState<boolean>(false);
  const [paletteColorModalMode, setPaletteColorModalMode] = useState<'edit' | 'create'>('edit');
  const [paletteColorModalInitial, setPaletteColorModalInitial] = useState({
    color: selectedColor,
    caption: '',
    locked: false
  });
  const [isUsageModifierPressed, setIsUsageModifierPressed] = useState<boolean>(false);
  const [paletteMergeSelection, setPaletteMergeSelection] = useState<string[]>([]);
  const [paletteMergeDestinationColor, setPaletteMergeDestinationColor] = useState<string | null>(null);

  const clearPaletteMergeSelection = useCallback(() => {
    setPaletteMergeSelection([]);
    setPaletteMergeDestinationColor(null);
  }, []);

  const resolvePaletteMergeDestination = useCallback(
    (nextColors: string[], preferredColor?: string | null) => {
      if (nextColors.length === 0) {
        return null;
      }

      const normalizedPreferredColor = preferredColor?.toLowerCase() ?? null;
      if (normalizedPreferredColor && nextColors.includes(normalizedPreferredColor)) {
        return normalizedPreferredColor;
      }

      if (paletteMergeDestinationColor && nextColors.includes(paletteMergeDestinationColor)) {
        return paletteMergeDestinationColor;
      }

      const normalizedSelectedColor = selectedColor.toLowerCase();
      if (nextColors.includes(normalizedSelectedColor)) {
        return normalizedSelectedColor;
      }

      return nextColors[nextColors.length - 1] ?? nextColors[0] ?? null;
    },
    [paletteMergeDestinationColor, selectedColor]
  );

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

  const openPaletteColorModal = useCallback((mode: 'edit' | 'create', entry: { color: string; caption: string; locked: boolean }) => {
    clearPaletteMergeSelection();
    setPaletteColorModalMode(mode);
    setPaletteColorModalInitial(entry);
    setIsPaletteColorModalOpen(true);
  }, [clearPaletteMergeSelection]);

  const openEditPaletteColorModal = useCallback((entry: { color: string; caption: string; locked: boolean }) => {
    openPaletteColorModal('edit', entry);
  }, [openPaletteColorModal]);

  const openSelectedColorEditPaletteColorModal = useCallback(() => {
    openEditPaletteColorModal({
      color: selectedColor,
      caption: selectedPaletteEntry?.caption ?? '',
      locked: selectedPaletteEntry?.locked ?? false
    });
  }, [openEditPaletteColorModal, selectedColor, selectedPaletteEntry]);

  const openCreatePaletteColorModal = useCallback(() => {
    openPaletteColorModal('create', {
      color: selectedColor,
      caption: '',
      locked: false
    });
  }, [openPaletteColorModal, selectedColor]);

  const handlePaletteColorModalApply = useCallback(
    (nextEntry: { color: string; caption: string; locked: boolean }) => {
      if (paletteColorModalMode === 'create') {
        addPaletteColor(nextEntry);
        return;
      }
      applySelectedColorChange(nextEntry);
    },
    [addPaletteColor, applySelectedColorChange, paletteColorModalMode]
  );

  const handlePaletteClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      const nextColor = (event.currentTarget.dataset.color ?? selectedColor).toLowerCase();
      if (event.metaKey || event.ctrlKey) {
        const normalizedSelectedColor = selectedColor.toLowerCase();
        const mergeSelectionBase =
          paletteMergeSelection.length > 0
            ? paletteMergeSelection
            : isSelectedColorInPalette && normalizedSelectedColor !== nextColor
              ? [normalizedSelectedColor]
              : [];
        const isSelectedForMerge = mergeSelectionBase.includes(nextColor);
        const nextMergeSelection = isSelectedForMerge
          ? mergeSelectionBase.filter((color) => color !== nextColor)
          : [...mergeSelectionBase, nextColor];
        setPaletteMergeSelection(nextMergeSelection);
        setPaletteMergeDestinationColor(resolvePaletteMergeDestination(nextMergeSelection));
        setSelectedColor(nextColor);
        return;
      }

      clearPaletteMergeSelection();
      setSelectedColor(nextColor);
    },
    [
      clearPaletteMergeSelection,
      isSelectedColorInPalette,
      paletteMergeSelection,
      resolvePaletteMergeDestination,
      selectedColor,
      setSelectedColor
    ]
  );

  const handlePaletteDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (event.metaKey || event.ctrlKey) {
        return;
      }
      const { color, index } = event.currentTarget.dataset;
      if (!color || index === undefined) {
        return;
      }

      const paletteIndex = Number.parseInt(index, 10);
      const entry = palette[paletteIndex];
      if (!entry) {
        return;
      }

      setSelectedColor(entry.color);
      openEditPaletteColorModal(entry);
    },
    [openEditPaletteColorModal, palette, setSelectedColor]
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

  const handlePaletteMergeDestinationSelect = useCallback((color: string) => {
    setPaletteMergeDestinationColor(color.toLowerCase());
    setSelectedColor(color.toLowerCase());
  }, [setSelectedColor]);

  const handlePaletteMergeApply = useCallback(() => {
    if (!canApplyPaletteMerge || !paletteMergeDestinationColor) {
      return;
    }

    if (mergePaletteColors(paletteMergeSelection, paletteMergeDestinationColor)) {
      clearPaletteMergeSelection();
    }
  }, [canApplyPaletteMerge, clearPaletteMergeSelection, mergePaletteColors, paletteMergeDestinationColor, paletteMergeSelection]);

  const handleSelectedColorUsageJump = useCallback(() => {
    jumpToPaletteUsage(selectedColor);
  }, [jumpToPaletteUsage, selectedColor]);

  useEffect(() => {
    if (!paletteColorModalRequest) {
      return;
    }
    setSelectedColor(paletteColorModalRequest.entry.color);
    openPaletteColorModal(paletteColorModalRequest.mode, paletteColorModalRequest.entry);
  }, [openPaletteColorModal, paletteColorModalRequest, setSelectedColor]);

  useEffect(() => {
    const nextMergeSelection = paletteMergeSelection.filter((color) => palette.some((entry) => entry.color === color));
    if (nextMergeSelection.length !== paletteMergeSelection.length) {
      setPaletteMergeSelection(nextMergeSelection);
    }

    const nextDestinationColor = resolvePaletteMergeDestination(nextMergeSelection);
    if (nextDestinationColor !== paletteMergeDestinationColor) {
      setPaletteMergeDestinationColor(nextDestinationColor);
    }
  }, [palette, paletteMergeDestinationColor, paletteMergeSelection, resolvePaletteMergeDestination]);

  useEffect(() => {
    const updateModifierState = (event: KeyboardEvent) => {
      setIsUsageModifierPressed(event.metaKey || event.ctrlKey);
    };

    const resetModifierState = () => {
      setIsUsageModifierPressed(false);
    };

    window.addEventListener('keydown', updateModifierState);
    window.addEventListener('keyup', updateModifierState);
    window.addEventListener('blur', resetModifierState);

    return () => {
      window.removeEventListener('keydown', updateModifierState);
      window.removeEventListener('keyup', updateModifierState);
      window.removeEventListener('blur', resetModifierState);
    };
  }, []);

  return (
    <div className="sidebar-palette-section d-flex flex-column flex-grow-1">
      <div className="sidebar-palette-header">
        <label className="form-label font-monospace small mb-0">Palette</label>
        <span className="sidebar-palette-count">{palette.length} colors</span>
      </div>
      <div className="sidebar-palette-controls">
        <button
          type="button"
          className="sidebar-color-trigger"
          onClick={openSelectedColorEditPaletteColorModal}
          aria-label="色選択ダイアログを開く"
          title="色選択ダイアログを開く"
        >
          <span className="sidebar-color-trigger-fill" style={{ backgroundColor: selectedColor }} aria-hidden="true" />
        </button>
        <div className="sidebar-palette-selected font-monospace">{selectedColor.toUpperCase()}</div>
        {isSelectedColorInPalette ? (
          <button
            type="button"
            className="btn btn-sm sidebar-palette-action-btn sidebar-palette-action-btn-jump"
            onClick={handleSelectedColorUsageJump}
            title="使用位置へ移動"
            aria-label="使用位置へ移動"
          >
            <i className="fa-solid fa-bullseye" aria-hidden="true" />
          </button>
        ) : null}
        {isSelectedColorInPalette ? (
          <button
            type="button"
            className="btn btn-sm sidebar-palette-action-btn sidebar-palette-action-btn-remove"
            onClick={removeSelectedColorFromPalette}
            title="パレットから削除"
            aria-label="パレットから削除"
            disabled={showPaletteMergeUi}
          >
            <i className="fa-solid fa-trash-can" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {showPaletteMergeUi ? (
        <div className="sidebar-palette-merge-panel">
          <div className="sidebar-palette-merge-header">
            <span className="sidebar-palette-merge-title">{paletteMergeSelection.length}色 → 1色</span>
            <span className="sidebar-palette-merge-summary">
              削除 {paletteMergeRemovalCount}
              {paletteMergePreservedLockedCount > 0 ? ` / 保持 ${paletteMergePreservedLockedCount}` : ''}
              {` / 置換 ${paletteMergeReplaceCount.toLocaleString()}px`}
            </span>
          </div>
          <div className="sidebar-palette-merge-destination-list" role="list" aria-label="merge destination colors">
            {selectedPaletteMergeEntries.map((entry) => (
              <button
                key={`merge-destination-${entry.color}`}
                type="button"
                className={`sidebar-palette-merge-destination ${
                  paletteMergeDestinationColor === entry.color ? 'active' : ''
                }`}
                onClick={() => handlePaletteMergeDestinationSelect(entry.color)}
                aria-pressed={paletteMergeDestinationColor === entry.color}
                title={`統合先にする: ${entry.color.toUpperCase()}`}
              >
                <span className="sidebar-palette-merge-destination-swatch" aria-hidden="true">
                  <span
                    className="sidebar-palette-merge-destination-swatch-fill"
                    style={{ backgroundColor: entry.color }}
                  />
                </span>
                <span className="sidebar-palette-merge-destination-label">
                  {entry.color.toUpperCase()}
                </span>
              </button>
            ))}
          </div>
          <div className="sidebar-palette-merge-actions">
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={handlePaletteMergeApply}
              disabled={!canApplyPaletteMerge}
            >
              統合
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clearPaletteMergeSelection}>
              キャンセル
            </button>
          </div>
        </div>
      ) : null}
      <div className="palette-grid-wrap flex-grow-1">
        <div className="palette-grid" role="list" aria-label="palette colors">
          {palette.map((entry, index) => (
            (() => {
              const isMergeSelected = paletteMergeSelection.includes(entry.color);
              const isMergeDestination = paletteMergeDestinationColor === entry.color;
              const usageCount = paletteUsageByColor[entry.color]?.count ?? 0;
              const usageLabel = formatPaletteUsageLabel(usageCount);
              const titleParts = [entry.color.toUpperCase()];
              if (entry.caption) {
                titleParts.push(`caption: ${entry.caption}`);
              }
              if (entry.locked) {
                titleParts.push('ロック');
              }
              if (isMergeDestination) {
                titleParts.push('統合先');
              } else if (isMergeSelected) {
                titleParts.push('統合対象');
              }

              return (
                <button
                  key={`${entry.color}-${index}`}
                  type="button"
                  className={`palette-item ${selectedColor === entry.color ? 'active' : ''} ${isMergeSelected ? 'is-multi-selected' : ''} ${
                    isMergeDestination ? 'is-merge-destination' : ''
                  }`}
                  data-color={entry.color}
                  data-index={index}
                  onClick={handlePaletteClick}
                  onDoubleClick={handlePaletteDoubleClick}
                  onMouseEnter={handlePaletteMouseEnter}
                  onMouseLeave={handlePaletteMouseLeave}
                  title={titleParts.join(' / ')}
                  aria-label={`palette color ${entry.color}`}
                >
                  <span className="palette-item-swatch" aria-hidden="true">
                    <span className="palette-item-swatch-fill" style={{ backgroundColor: entry.color }} />
                    {isMergeDestination ? <span className="palette-item-merge-badge">残</span> : null}
                    {entry.locked ? (
                      <span className="palette-item-lock">
                        <i className="fa-solid fa-lock" aria-hidden="true" />
                      </span>
                    ) : null}
                    {isUsageModifierPressed ? (
                      <span className="palette-item-usage">{usageLabel}</span>
                    ) : null}
                  </span>
                  <span className="palette-item-caption">{entry.caption || '\u00A0'}</span>
                </button>
              );
            })()
          ))}
          <button
            type="button"
            className="palette-item palette-item-add"
            onClick={openCreatePaletteColorModal}
            title="新しいパレット色を追加"
            aria-label="新しいパレット色を追加"
          >
            <span className="palette-item-swatch" aria-hidden="true">
              <i className="fa-solid fa-plus" aria-hidden="true" />
            </span>
            <span className="palette-item-caption">{'\u00A0'}</span>
          </button>
        </div>
      </div>
      <PaletteColorModal
        isOpen={isPaletteColorModalOpen}
        transparentBackgroundMode={transparentBackgroundMode}
        selectedPalette={paletteColorModalInitial}
        palette={palette}
        paletteEditTarget={paletteColorModalMode === 'edit' ? paletteColorModalInitial.color : null}
        onApply={handlePaletteColorModalApply}
        onClose={() => setIsPaletteColorModalOpen(false)}
      />
    </div>
  );
});
