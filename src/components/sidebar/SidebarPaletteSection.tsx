/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react';
import Dropdown from 'bootstrap/js/dist/dropdown';
import { PALETTE_AUTO_SORT_KEY_LABELS } from '../../editor/palette-order';
import type { PaletteEntry } from '../../editor/types';
import { formatPaletteUsageLabel } from '../../editor/palette-sync';
import { generatePaletteEntryId, hexToRgba } from '../../editor/utils';
import { PaletteColorModal } from '../modals/PaletteColorModal';
import type { SidebarPaletteSectionProps } from './types';

export const SidebarPaletteSection = memo(function SidebarPaletteSection({
  transparentBackgroundMode,
  selectedColor,
  setSelectedColor,
  applySelectedColorChange,
  palette,
  displayPalette,
  paletteUsageByColor,
  setHoveredPaletteColor,
  addPaletteColor,
  removeSelectedColorFromPalette,
  jumpToPaletteUsage,
  paletteOrderMode,
  setPaletteOrderMode,
  paletteAutoSortKey,
  setPaletteAutoSortKey,
  canManualPaletteReorder,
  canApplyDisplayPaletteOrder,
  reorderPaletteEntries,
  applyDisplayPaletteOrder,
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
  const [draggingPaletteEntryId, setDraggingPaletteEntryId] = useState<string | null>(null);
  const showPaletteMergeUi = paletteMergeSelection.length >= 2;
  const paletteOrderToggleRef = useRef<HTMLButtonElement | null>(null);
  const paletteOrderDropdownRef = useRef<Dropdown | null>(null);

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

  const handlePaletteDragStart = useCallback(
    (event: ReactDragEvent<HTMLButtonElement>) => {
      const sourceId = event.currentTarget.dataset.id;
      if (!canManualPaletteReorder || !sourceId) {
        event.preventDefault();
        return;
      }

      setDraggingPaletteEntryId(sourceId);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', sourceId);
    },
    [canManualPaletteReorder]
  );

  const handlePaletteDragEnd = useCallback(() => {
    setDraggingPaletteEntryId(null);
  }, []);

  const handlePaletteDragOver = useCallback(
    (event: ReactDragEvent<HTMLButtonElement>) => {
      if (!canManualPaletteReorder) {
        return;
      }

      const targetId = event.currentTarget.dataset.id;
      const sourceId = draggingPaletteEntryId ?? event.dataTransfer.getData('text/plain');
      if (!targetId || !sourceId || sourceId === targetId) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    [canManualPaletteReorder, draggingPaletteEntryId]
  );

  const handlePaletteDrop = useCallback(
    (event: ReactDragEvent<HTMLButtonElement>) => {
      if (!canManualPaletteReorder) {
        return;
      }

      event.preventDefault();
      const targetId = event.currentTarget.dataset.id;
      const sourceId = draggingPaletteEntryId ?? event.dataTransfer.getData('text/plain');
      setDraggingPaletteEntryId(null);
      if (!targetId || !sourceId || sourceId === targetId) {
        return;
      }

      const targetBounds = event.currentTarget.getBoundingClientRect();
      const insertAfter = event.clientX >= targetBounds.left + targetBounds.width / 2;
      reorderPaletteEntries(sourceId, targetId, insertAfter);
    },
    [canManualPaletteReorder, draggingPaletteEntryId, reorderPaletteEntries]
  );

  const activePaletteTab = paletteOrderMode === 'manual' ? 'palette' : paletteAutoSortKey;

  const selectPaletteTab = useCallback(
    (tab: 'palette' | keyof typeof PALETTE_AUTO_SORT_KEY_LABELS) => {
      if (tab === 'palette') {
        setPaletteOrderMode('manual');
      } else {
        setPaletteAutoSortKey(tab);
        setPaletteOrderMode('auto');
      }
      paletteOrderDropdownRef.current?.hide();
    },
    [setPaletteAutoSortKey, setPaletteOrderMode]
  );

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

  useEffect(() => {
    if (canManualPaletteReorder) {
      return;
    }
    setDraggingPaletteEntryId(null);
  }, [canManualPaletteReorder]);

  useEffect(() => {
    const toggleElement = paletteOrderToggleRef.current;
    if (!toggleElement) {
      return;
    }

    const instance = new Dropdown(toggleElement, {
      autoClose: true
    });
    paletteOrderDropdownRef.current = instance;

    return () => {
      instance.dispose();
      paletteOrderDropdownRef.current = null;
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
      <div className="sidebar-palette-order-toolbar">
        <button
          type="button"
          className="btn btn-sm sidebar-palette-order-home-btn"
          onClick={() => selectPaletteTab('palette')}
          title="Palette に戻る"
          aria-label="Palette に戻る"
          disabled={activePaletteTab === 'palette'}
        >
          <i className="fa-solid fa-house" aria-hidden="true" />
        </button>
        <div className="dropdown w-100">
          <button
            ref={paletteOrderToggleRef}
            type="button"
            className="btn btn-sm btn-outline-secondary dropdown-toggle sidebar-palette-order-toggle w-100"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            aria-label="パレット並び順を選択"
            title="パレット並び順を選択"
          >
            <span className="sidebar-palette-order-toggle-label small">
              {activePaletteTab === 'palette' ? 'Palette' : PALETTE_AUTO_SORT_KEY_LABELS[activePaletteTab]}
            </span>
          </button>
          <ul className="dropdown-menu w-100 small">
            <li>
              <button
                type="button"
                className={`dropdown-item small ${activePaletteTab === 'palette' ? 'active' : ''}`}
                onClick={() => selectPaletteTab('palette')}
              >
                Palette
              </button>
            </li>
            {Object.entries(PALETTE_AUTO_SORT_KEY_LABELS).map(([key, label]) => (
              <li key={key}>
                <button
                  type="button"
                  className={`dropdown-item small ${activePaletteTab === key ? 'active' : ''}`}
                  onClick={() => selectPaletteTab(key as keyof typeof PALETTE_AUTO_SORT_KEY_LABELS)}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {paletteOrderMode === 'auto' ? (
          <button
            type="button"
            className="btn btn-sm btn-primary sidebar-palette-order-apply-btn"
            onClick={applyDisplayPaletteOrder}
            title="現在のプレビュー順をパレットへ反映"
            aria-label="現在のプレビュー順をパレットへ反映"
            disabled={!canApplyDisplayPaletteOrder}
          >
            適用
          </button>
        ) : null}
      </div>
      <div className="sidebar-palette-pane flex-grow-1">
        <div className="palette-grid-wrap flex-grow-1">
          <div className="palette-grid" role="list" aria-label="palette colors">
            {displayPalette.map((entry) => (
              (() => {
                const isMergeSelected = paletteMergeSelection.includes(entry.id);
                const isMergeDestination = paletteMergeDestinationId === entry.id;
                const isDragging = draggingPaletteEntryId === entry.id;
                const isTranslucent = hexToRgba(entry.color).a < 255;
                const usageCount = paletteUsageByColor[entry.color]?.count ?? 0;
                const usageLabel = formatPaletteUsageLabel(usageCount);
                const titleParts = [entry.color.toUpperCase()];
                if (entry.caption) {
                  titleParts.push(`caption: ${entry.caption}`);
                }
                if (entry.locked) {
                  titleParts.push('ロック');
                }
                if (isTranslucent) {
                  titleParts.push('透過あり');
                }
                if (isMergeDestination) {
                  titleParts.push('統合先');
                } else if (isMergeSelected) {
                  titleParts.push('統合対象');
                }
                if (canManualPaletteReorder) {
                  titleParts.push('ドラッグで並び替え');
                }

                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={`palette-item ${selectedColor === entry.color ? 'active' : ''} ${
                      isMergeSelected ? 'is-multi-selected' : ''
                    } ${isMergeDestination ? 'is-merge-destination' : ''} ${
                      canManualPaletteReorder ? 'is-draggable' : ''
                    } ${isDragging ? 'is-dragging' : ''}`}
                    data-id={entry.id}
                    data-color={entry.color}
                    draggable={canManualPaletteReorder}
                    onClick={handlePaletteClick}
                    onDoubleClick={handlePaletteDoubleClick}
                    onMouseEnter={handlePaletteMouseEnter}
                    onMouseLeave={handlePaletteMouseLeave}
                    onDragStart={handlePaletteDragStart}
                    onDragEnd={handlePaletteDragEnd}
                    onDragOver={handlePaletteDragOver}
                    onDrop={handlePaletteDrop}
                    title={titleParts.join(' / ')}
                    aria-label={`palette color ${entry.color}`}
                    aria-grabbed={canManualPaletteReorder ? isDragging : undefined}
                  >
                    <span className="palette-item-swatch" aria-hidden="true">
                      <span className="palette-item-swatch-fill" style={{ backgroundColor: entry.color }} />
                      {isMergeDestination ? <span className="palette-item-merge-badge">残</span> : null}
                      {isTranslucent ? <span className="palette-item-alpha-badge">透</span> : null}
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
