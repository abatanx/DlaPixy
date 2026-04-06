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
  const [paletteMergeDestinationColor, setPaletteMergeDestinationColor] = useState<string | null>(null);

  const isSelectedColorInPalette = useMemo(
    () => palette.some((entry) => entry.color === selectedColor),
    [palette, selectedColor]
  );

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

  const togglePaletteMergeColor = useCallback(
    (color: string) => {
      const nextColor = color.toLowerCase();
      const normalizedSelectedColor = selectedColor.toLowerCase();
      const mergeSelectionBase =
        paletteMergeSelection.length > 0
          ? paletteMergeSelection
          : isSelectedColorInPalette && normalizedSelectedColor !== nextColor
            ? [normalizedSelectedColor]
            : [];
      const isSelectedForMerge = mergeSelectionBase.includes(nextColor);
      const nextMergeSelection = isSelectedForMerge
        ? mergeSelectionBase.filter((mergeColor) => mergeColor !== nextColor)
        : [...mergeSelectionBase, nextColor];

      if (nextMergeSelection.length < 2) {
        clearPaletteMergeSelection();
        setSelectedColor(nextColor);
        return;
      }

      setPaletteMergeSelection(nextMergeSelection);
      setPaletteMergeDestinationColor(resolvePaletteMergeDestination(nextMergeSelection));
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

  const selectPaletteMergeDestination = useCallback(
    (color: string) => {
      const nextColor = color.toLowerCase();
      setPaletteMergeDestinationColor(nextColor);
      setSelectedColor(nextColor);
    },
    [setSelectedColor]
  );

  const removePaletteMergeColor = useCallback(
    (color: string) => {
      const nextColor = color.toLowerCase();
      const nextMergeSelection = paletteMergeSelection.filter((mergeColor) => mergeColor !== nextColor);
      if (nextMergeSelection.length < 2) {
        clearPaletteMergeSelection();
        const fallbackSelectedColor = nextMergeSelection[0] ?? selectedColor;
        setSelectedColor(fallbackSelectedColor.toLowerCase());
        return;
      }

      const nextDestinationColor = resolvePaletteMergeDestination(nextMergeSelection);
      setPaletteMergeSelection(nextMergeSelection);
      setPaletteMergeDestinationColor(nextDestinationColor);

      if (!nextMergeSelection.includes(selectedColor.toLowerCase())) {
        setSelectedColor((nextDestinationColor ?? nextMergeSelection[0] ?? selectedColor).toLowerCase());
      }
    },
    [clearPaletteMergeSelection, paletteMergeSelection, resolvePaletteMergeDestination, selectedColor, setSelectedColor]
  );

  useEffect(() => {
    const nextMergeSelection = paletteMergeSelection.filter((color) => palette.some((entry) => entry.color === color));
    if (nextMergeSelection.length < 2) {
      if (paletteMergeSelection.length > 0 || paletteMergeDestinationColor !== null) {
        clearPaletteMergeSelection();
      }
      return;
    }

    if (nextMergeSelection.length !== paletteMergeSelection.length) {
      setPaletteMergeSelection(nextMergeSelection);
    }

    const nextDestinationColor = resolvePaletteMergeDestination(nextMergeSelection);
    if (nextDestinationColor !== paletteMergeDestinationColor) {
      setPaletteMergeDestinationColor(nextDestinationColor);
    }
  }, [
    clearPaletteMergeSelection,
    palette,
    paletteMergeDestinationColor,
    paletteMergeSelection,
    resolvePaletteMergeDestination
  ]);

  return {
    paletteMergeSelection,
    paletteMergeDestinationColor,
    showPaletteMergeUi: paletteMergeSelection.length >= 2,
    clearPaletteMergeSelection,
    togglePaletteMergeColor,
    selectPaletteMergeDestination,
    removePaletteMergeColor
  };
}
