/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { PaletteEntry } from '../editor/types';

type UsePaletteMergeSelectionOptions = {
  palette: PaletteEntry[];
  selectedColor: string;
  setSelectedColor: Dispatch<SetStateAction<string>>;
};

export function usePaletteMergeSelection({
  palette,
  selectedColor,
  setSelectedColor
}: UsePaletteMergeSelectionOptions) {
  const [paletteMergeSelection, setPaletteMergeSelection] = useState<string[]>([]);
  const [paletteMergeDestinationId, setPaletteMergeDestinationId] = useState<string | null>(null);

  const isSelectedColorInPalette = useMemo(
    () => palette.some((entry) => entry.color === selectedColor),
    [palette, selectedColor]
  );

  const clearPaletteMergeSelection = useCallback(() => {
    setPaletteMergeSelection([]);
    setPaletteMergeDestinationId(null);
  }, []);

  const resolvePaletteEntryById = useCallback(
    (paletteId: string | null | undefined): PaletteEntry | null => {
      if (!paletteId) {
        return null;
      }

      return palette.find((entry) => entry.id === paletteId) ?? null;
    },
    [palette]
  );

  const resolvePaletteMergeDestination = useCallback(
    (nextSelectionIds: string[], preferredId?: string | null) => {
      if (nextSelectionIds.length === 0) {
        return null;
      }

      if (preferredId && nextSelectionIds.includes(preferredId)) {
        return preferredId;
      }

      if (paletteMergeDestinationId && nextSelectionIds.includes(paletteMergeDestinationId)) {
        return paletteMergeDestinationId;
      }

      const selectedEntryId = palette.find((entry) => entry.color === selectedColor)?.id ?? null;
      if (selectedEntryId && nextSelectionIds.includes(selectedEntryId)) {
        return selectedEntryId;
      }

      return nextSelectionIds[nextSelectionIds.length - 1] ?? nextSelectionIds[0] ?? null;
    },
    [palette, paletteMergeDestinationId, selectedColor]
  );

  const togglePaletteMergeColor = useCallback(
    (entry: PaletteEntry) => {
      const nextEntryId = entry.id;
      const selectedEntryId = palette.find((candidate) => candidate.color === selectedColor)?.id ?? null;
      const mergeSelectionBase =
        paletteMergeSelection.length > 0
          ? paletteMergeSelection
          : isSelectedColorInPalette && selectedEntryId && selectedEntryId !== nextEntryId
            ? [selectedEntryId]
            : [];
      const isSelectedForMerge = mergeSelectionBase.includes(nextEntryId);
      const nextMergeSelection = isSelectedForMerge
        ? mergeSelectionBase.filter((paletteId) => paletteId !== nextEntryId)
        : [...mergeSelectionBase, nextEntryId];

      if (nextMergeSelection.length < 2) {
        clearPaletteMergeSelection();
        setSelectedColor(entry.color);
        return;
      }

      setPaletteMergeSelection(nextMergeSelection);
      setPaletteMergeDestinationId(resolvePaletteMergeDestination(nextMergeSelection));
      setSelectedColor(entry.color);
    },
    [
      clearPaletteMergeSelection,
      isSelectedColorInPalette,
      palette,
      paletteMergeSelection,
      resolvePaletteMergeDestination,
      selectedColor,
      setSelectedColor
    ]
  );

  const selectPaletteMergeDestination = useCallback(
    (paletteId: string) => {
      const nextEntry = resolvePaletteEntryById(paletteId);
      if (!nextEntry) {
        return;
      }

      setPaletteMergeDestinationId(nextEntry.id);
      setSelectedColor(nextEntry.color);
    },
    [resolvePaletteEntryById, setSelectedColor]
  );

  const removePaletteMergeColor = useCallback(
    (paletteId: string) => {
      const nextMergeSelection = paletteMergeSelection.filter((mergeId) => mergeId !== paletteId);
      if (nextMergeSelection.length < 2) {
        clearPaletteMergeSelection();
        const fallbackSelectedEntry = resolvePaletteEntryById(nextMergeSelection[0] ?? null);
        setSelectedColor(fallbackSelectedEntry?.color ?? selectedColor.toLowerCase());
        return;
      }

      const nextDestinationColor = resolvePaletteMergeDestination(nextMergeSelection);
      setPaletteMergeSelection(nextMergeSelection);
      setPaletteMergeDestinationId(nextDestinationColor);

      const selectedEntryId = palette.find((entry) => entry.color === selectedColor)?.id ?? null;
      if (!selectedEntryId || !nextMergeSelection.includes(selectedEntryId)) {
        const fallbackSelectedEntry = resolvePaletteEntryById(nextDestinationColor ?? nextMergeSelection[0] ?? null);
        if (fallbackSelectedEntry) {
          setSelectedColor(fallbackSelectedEntry.color);
        }
      }
    },
    [
      clearPaletteMergeSelection,
      palette,
      paletteMergeSelection,
      resolvePaletteEntryById,
      resolvePaletteMergeDestination,
      selectedColor,
      setSelectedColor
    ]
  );

  useEffect(() => {
    const nextMergeSelection = paletteMergeSelection.filter((paletteId) => palette.some((entry) => entry.id === paletteId));
    if (nextMergeSelection.length < 2) {
      if (paletteMergeSelection.length > 0 || paletteMergeDestinationId !== null) {
        clearPaletteMergeSelection();
      }
      return;
    }

    if (nextMergeSelection.length !== paletteMergeSelection.length) {
      setPaletteMergeSelection(nextMergeSelection);
    }

    const nextDestinationColor = resolvePaletteMergeDestination(nextMergeSelection);
    if (nextDestinationColor !== paletteMergeDestinationId) {
      setPaletteMergeDestinationId(nextDestinationColor);
    }
  }, [
    clearPaletteMergeSelection,
    palette,
    paletteMergeDestinationId,
    paletteMergeSelection,
    resolvePaletteMergeDestination
  ]);

  return {
    paletteMergeSelection,
    paletteMergeDestinationId,
    showPaletteMergeUi: paletteMergeSelection.length >= 2,
    clearPaletteMergeSelection,
    togglePaletteMergeColor,
    selectPaletteMergeDestination,
    removePaletteMergeColor
  };
}
