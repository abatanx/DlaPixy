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

  const openPaletteColorModal = useCallback((mode: 'edit' | 'create', entry: { color: string; caption: string; locked: boolean }) => {
    setPaletteColorModalMode(mode);
    setPaletteColorModalInitial(entry);
    setIsPaletteColorModalOpen(true);
  }, []);

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
      const nextColor = event.currentTarget.dataset.color ?? selectedColor;
      const shouldJumpToUsage = isUsageModifierPressed || event.metaKey || event.ctrlKey;

      setSelectedColor(nextColor);
      if (shouldJumpToUsage) {
        jumpToPaletteUsage(nextColor);
      }
    },
    [isUsageModifierPressed, jumpToPaletteUsage, selectedColor, setSelectedColor]
  );

  const handlePaletteDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
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
            className="btn btn-sm sidebar-palette-action-btn sidebar-palette-action-btn-remove"
            onClick={removeSelectedColorFromPalette}
            title="パレットから削除"
            aria-label="パレットから削除"
          >
            <i className="fa-solid fa-trash-can" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className="palette-grid-wrap flex-grow-1">
        <div className="palette-grid" role="list" aria-label="palette colors">
          {palette.map((entry, index) => (
            (() => {
              const usageCount = paletteUsageByColor[entry.color]?.count ?? 0;
              const usageLabel = formatPaletteUsageLabel(usageCount);
              const titleParts = [entry.color.toUpperCase()];
              if (entry.caption) {
                titleParts.push(`caption: ${entry.caption}`);
              }
              if (entry.locked) {
                titleParts.push('ロック');
              }

              return (
                <button
                  key={`${entry.color}-${index}`}
                  type="button"
                  className={`palette-item ${selectedColor === entry.color ? 'active' : ''}`}
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
