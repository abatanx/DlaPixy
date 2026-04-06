/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { PaletteEntry } from '../../editor/types';
import { formatPaletteUsageLabel } from '../../editor/palette-sync';
import { generatePaletteEntryId } from '../../editor/utils';
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
  jumpToPaletteUsage,
  paletteMergeSelection,
  paletteMergeDestinationId,
  togglePaletteMergeColor,
  clearPaletteMergeSelection,
  paletteColorModalRequest
}: SidebarPaletteSectionProps) {
  const selectedPaletteEntry = useMemo(
    () => palette.find((entry) => entry.color === selectedColor) ?? null,
    [palette, selectedColor]
  );
  const isSelectedColorInPalette = selectedPaletteEntry !== null;
  const [isPaletteColorModalOpen, setIsPaletteColorModalOpen] = useState<boolean>(false);
  const [paletteColorModalMode, setPaletteColorModalMode] = useState<'edit' | 'create'>('edit');
  const [paletteColorModalInitial, setPaletteColorModalInitial] = useState<PaletteEntry>(() => ({
    id: generatePaletteEntryId(),
    color: selectedColor,
    caption: '',
    locked: false
  }));
  const [isUsageModifierPressed, setIsUsageModifierPressed] = useState<boolean>(false);
  const showPaletteMergeUi = paletteMergeSelection.length >= 2;

  const openPaletteColorModal = useCallback(
    (mode: 'edit' | 'create', entry: PaletteEntry) => {
      clearPaletteMergeSelection();
      setPaletteColorModalMode(mode);
      setPaletteColorModalInitial(entry);
      setIsPaletteColorModalOpen(true);
    },
    [clearPaletteMergeSelection]
  );

  const openEditPaletteColorModal = useCallback((entry: PaletteEntry) => {
    openPaletteColorModal('edit', entry);
  }, [openPaletteColorModal]);

  const openSelectedColorEditPaletteColorModal = useCallback(() => {
    openEditPaletteColorModal({
      id: selectedPaletteEntry?.id ?? generatePaletteEntryId(),
      color: selectedColor,
      caption: selectedPaletteEntry?.caption ?? '',
      locked: selectedPaletteEntry?.locked ?? false
    });
  }, [openEditPaletteColorModal, selectedColor, selectedPaletteEntry]);

  const openCreatePaletteColorModal = useCallback(() => {
    openPaletteColorModal('create', {
      id: generatePaletteEntryId(),
      color: selectedColor,
      caption: '',
      locked: false
    });
  }, [openPaletteColorModal, selectedColor]);

  const handlePaletteColorModalApply = useCallback(
    (nextEntry: PaletteEntry) => {
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
      const nextPaletteEntry = palette.find((entry) => entry.color === nextColor) ?? null;
      if (event.metaKey || event.ctrlKey) {
        if (nextPaletteEntry) {
          togglePaletteMergeColor(nextPaletteEntry);
        }
        return;
      }

      clearPaletteMergeSelection();
      setSelectedColor(nextColor);
    },
    [clearPaletteMergeSelection, palette, selectedColor, setSelectedColor, togglePaletteMergeColor]
  );

  const handlePaletteDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (event.metaKey || event.ctrlKey) {
        return;
      }
      const { id } = event.currentTarget.dataset;
      if (!id) {
        return;
      }

      const entry = palette.find((candidate) => candidate.id === id);
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
      const { id } = event.currentTarget.dataset;
      if (!id) {
        return;
      }
      setHoveredPaletteColor({ id });
    },
    [setHoveredPaletteColor]
  );

  const handlePaletteMouseLeave = useCallback(() => {
    setHoveredPaletteColor(null);
  }, [setHoveredPaletteColor]);

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
      <div className="palette-grid-wrap flex-grow-1">
        <div className="palette-grid" role="list" aria-label="palette colors">
          {palette.map((entry) => (
            (() => {
              const isMergeSelected = paletteMergeSelection.includes(entry.id);
              const isMergeDestination = paletteMergeDestinationId === entry.id;
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
                  key={entry.id}
                  type="button"
                  className={`palette-item ${selectedColor === entry.color ? 'active' : ''} ${isMergeSelected ? 'is-multi-selected' : ''} ${
                    isMergeDestination ? 'is-merge-destination' : ''
                  }`}
                  data-id={entry.id}
                  data-color={entry.color}
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
        paletteEditTargetId={paletteColorModalMode === 'edit' ? paletteColorModalInitial.id : null}
        onApply={handlePaletteColorModalApply}
        onClose={() => setIsPaletteColorModalOpen(false)}
      />
    </div>
  );
});
