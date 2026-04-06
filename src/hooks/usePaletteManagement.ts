/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { GplExportFormat } from '../../shared/palette-gpl';
import { getFileNameFromPath, hasSamePaletteEntries, replaceFileExtension, resolveNextSelectedColor } from '../editor/app-utils';
import { mergePaletteColorsIntoDestination } from '../editor/palette-merge';
import { syncPaletteEntriesFromPixels, type PaletteUsageEntry } from '../editor/palette-sync';
import type { PaletteEntry } from '../editor/types';
import { clonePaletteEntries, clonePixels, generatePaletteEntryId, hexToRgba, normalizePaletteEntries } from '../editor/utils';

type StatusType = 'success' | 'warning' | 'error' | 'info';

export type PaletteRemovalRequest = {
  colors: string[];
  usedPixelCount: number;
};

type UsePaletteManagementOptions = {
  canvasSize: number;
  currentFilePath?: string;
  palette: PaletteEntry[];
  selectedColor: string;
  pixels: Uint8ClampedArray;
  paletteUsageByColor: Record<string, PaletteUsageEntry>;
  pushUndo: () => void;
  setPalette: Dispatch<SetStateAction<PaletteEntry[]>>;
  setSelectedColor: Dispatch<SetStateAction<string>>;
  setPixels: Dispatch<SetStateAction<Uint8ClampedArray>>;
  setHasUnsavedChanges: Dispatch<SetStateAction<boolean>>;
  setStatusText: (text: string, type: StatusType) => void;
};

export function usePaletteManagement({
  canvasSize,
  currentFilePath,
  palette,
  selectedColor,
  pixels,
  paletteUsageByColor,
  pushUndo,
  setPalette,
  setSelectedColor,
  setPixels,
  setHasUnsavedChanges,
  setStatusText
}: UsePaletteManagementOptions) {
  const [paletteRemovalRequest, setPaletteRemovalRequest] = useState<PaletteRemovalRequest | null>(null);

  const syncPaletteAfterPaste = useCallback(
    (nextPixels: Uint8ClampedArray) => {
      const { palette: nextPalette } = syncPaletteEntriesFromPixels(palette, nextPixels, canvasSize, {
        removeUnusedColors: false,
        addUsedColors: true
      });
      if (!hasSamePaletteEntries(palette, nextPalette)) {
        setPalette(nextPalette);
        setSelectedColor(resolveNextSelectedColor(nextPalette, selectedColor));
      }
    },
    [canvasSize, palette, selectedColor, setPalette, setSelectedColor]
  );

  const removePaletteColorsInternal = useCallback(
    (colorsToRemove: string[], clearUsedPixels: boolean): boolean => {
      const normalizedColorsToRemove = Array.from(new Set(colorsToRemove.map((color) => color.toLowerCase()))).filter((color) =>
        palette.some((entry) => entry.color === color)
      );
      if (normalizedColorsToRemove.length === 0) {
        setPaletteRemovalRequest(null);
        setStatusText('削除対象の色はパレットにありません', 'warning');
        return false;
      }

      const removedColorsSet = new Set(normalizedColorsToRemove);
      const nextPalette = palette.filter((entry) => !removedColorsSet.has(entry.color));
      const nextSelectedColor = resolveNextSelectedColor(nextPalette, selectedColor);
      let nextPixels = pixels;
      let clearedPixelCount = 0;

      if (clearUsedPixels) {
        const targetColors = normalizedColorsToRemove.map((color) => hexToRgba(color));
        const clearedPixels = clonePixels(pixels);

        for (let index = 0; index < clearedPixels.length; index += 4) {
          const hasMatchingColor = targetColors.some((targetColor) => (
            clearedPixels[index] === targetColor.r &&
            clearedPixels[index + 1] === targetColor.g &&
            clearedPixels[index + 2] === targetColor.b &&
            clearedPixels[index + 3] === targetColor.a
          ));
          if (!hasMatchingColor) {
            continue;
          }

          clearedPixels[index] = 0;
          clearedPixels[index + 1] = 0;
          clearedPixels[index + 2] = 0;
          clearedPixels[index + 3] = 0;
          clearedPixelCount += 1;
        }

        nextPixels = clearedPixels;
      }

      pushUndo();
      setPalette(nextPalette);
      setSelectedColor(nextSelectedColor);
      if (clearUsedPixels) {
        setPixels(nextPixels);
      }
      setPaletteRemovalRequest(null);
      setHasUnsavedChanges(true);
      const removedLabel =
        normalizedColorsToRemove.length === 1
          ? normalizedColorsToRemove[0]?.toUpperCase() ?? '-'
          : `${normalizedColorsToRemove.length}色`;
      setStatusText(
        clearUsedPixels && clearedPixelCount > 0
          ? `使用中の色をクリアして削除しました: ${removedLabel} / ${clearedPixelCount.toLocaleString()}px`
          : `パレットから削除しました: ${removedLabel}`,
        'success'
      );
      return true;
    },
    [palette, pixels, pushUndo, selectedColor, setHasUnsavedChanges, setPalette, setPixels, setSelectedColor, setStatusText]
  );

  const addPaletteColor = useCallback(
    ({ id: nextId, color: nextColor, caption: nextCaption, locked: nextLocked }: PaletteEntry) => {
      if (palette.some((entry) => entry.color === nextColor)) {
        setStatusText('同じ色はすでにパレットにあります', 'warning');
        return;
      }

      pushUndo();
      setSelectedColor(nextColor);
      setPalette((prev) => [
        ...prev,
        {
          id: nextId || generatePaletteEntryId(),
          color: nextColor,
          caption: nextCaption,
          locked: nextLocked
        }
      ]);
      setHasUnsavedChanges(true);
      setStatusText(`パレットに追加しました: ${nextColor.toUpperCase()}`, 'success');
    },
    [palette, pushUndo, setHasUnsavedChanges, setPalette, setSelectedColor, setStatusText]
  );

  const removeSelectedColorFromPalette = useCallback(() => {
    const selectedPaletteIndex = palette.findIndex((entry) => entry.color === selectedColor);
    if (selectedPaletteIndex < 0) {
      setStatusText('選択色はパレットにありません', 'warning');
      return;
    }

    const usedPixelCount = paletteUsageByColor[selectedColor]?.count ?? 0;
    if (usedPixelCount > 0) {
      setPaletteRemovalRequest({
        colors: [selectedColor],
        usedPixelCount
      });
      return;
    }

    void removePaletteColorsInternal([selectedColor], false);
  }, [palette, paletteUsageByColor, removePaletteColorsInternal, selectedColor, setStatusText]);

  const removePaletteColors = useCallback(
    (colorsToRemove: string[]): boolean => {
      const normalizedColorsToRemove = Array.from(new Set(colorsToRemove.map((color) => color.toLowerCase()))).filter((color) =>
        palette.some((entry) => entry.color === color)
      );
      if (normalizedColorsToRemove.length === 0) {
        setStatusText('削除対象の色はパレットにありません', 'warning');
        return false;
      }

      const usedPixelCount = normalizedColorsToRemove.reduce(
        (total, color) => total + (paletteUsageByColor[color]?.count ?? 0),
        0
      );
      if (usedPixelCount > 0) {
        setPaletteRemovalRequest({
          colors: normalizedColorsToRemove,
          usedPixelCount
        });
        return false;
      }

      return removePaletteColorsInternal(normalizedColorsToRemove, false);
    },
    [palette, paletteUsageByColor, removePaletteColorsInternal, setStatusText]
  );

  const mergePaletteColors = useCallback(
    (selectedColors: string[], destinationColor: string): boolean => {
      const mergeResult = mergePaletteColorsIntoDestination({
        palette,
        pixels,
        selectedColors,
        destinationColor,
        currentSelectedColor: selectedColor
      });
      if (!mergeResult) {
        setStatusText('統合できる色の組み合わせを選んでください', 'warning');
        return false;
      }

      pushUndo();
      setPalette(mergeResult.nextPalette);
      setPixels(mergeResult.nextPixels);
      setSelectedColor(mergeResult.nextSelectedColor);
      setHasUnsavedChanges(true);
      const mergeStatusParts = [
        `${mergeResult.mergedColorCount}色`,
        `削除 ${mergeResult.removedColorCount}`,
      ];
      if (mergeResult.preservedLockedColorCount > 0) {
        mergeStatusParts.push(`保持 ${mergeResult.preservedLockedColorCount}`);
      }
      mergeStatusParts.push(`置換 ${mergeResult.replacedPixelCount.toLocaleString()}px`);
      setStatusText(
        `パレット色を統合しました: ${mergeStatusParts.join(' / ')} -> ${mergeResult.nextSelectedColor.toUpperCase()}`,
        'success'
      );
      return true;
    },
    [palette, pixels, pushUndo, selectedColor, setHasUnsavedChanges, setPalette, setPixels, setSelectedColor, setStatusText]
  );

  const applySelectedColorChange = useCallback(
    ({ color: nextColor, caption: nextCaption, locked: nextLocked }: PaletteEntry) => {
      const selectedPaletteIndex = palette.findIndex((entry) => entry.color === selectedColor);
      const currentEntry = selectedPaletteIndex >= 0 ? palette[selectedPaletteIndex] ?? null : null;
      const currentCaption = currentEntry?.caption ?? '';
      const currentLocked = currentEntry?.locked ?? false;
      if (nextColor === selectedColor && nextCaption === currentCaption && nextLocked === currentLocked) {
        return;
      }

      if (selectedPaletteIndex < 0) {
        setSelectedColor(nextColor);
        return;
      }

      const previousColor = hexToRgba(selectedColor);
      const updatedColor = hexToRgba(nextColor);
      const nextPixels = clonePixels(pixels);
      let replacedPixelCount = 0;

      for (let index = 0; index < nextPixels.length; index += 4) {
        if (
          nextPixels[index] !== previousColor.r ||
          nextPixels[index + 1] !== previousColor.g ||
          nextPixels[index + 2] !== previousColor.b ||
          nextPixels[index + 3] !== previousColor.a
        ) {
          continue;
        }

        nextPixels[index] = updatedColor.r;
        nextPixels[index + 1] = updatedColor.g;
        nextPixels[index + 2] = updatedColor.b;
        nextPixels[index + 3] = updatedColor.a;
        replacedPixelCount += 1;
      }

      const nextPalette = palette.map((entry, index) =>
        index === selectedPaletteIndex
          ? {
              ...entry,
              color: nextColor,
              caption: nextCaption,
              locked: nextLocked
            }
          : entry
      );

      pushUndo();
      setSelectedColor(nextColor);
      setPalette(nextPalette);
      setPixels(replacedPixelCount > 0 ? nextPixels : pixels);
      setHasUnsavedChanges(true);
      if (nextColor !== selectedColor) {
        setStatusText(
          `パレット色を更新しました: ${selectedColor.toUpperCase()} -> ${nextColor.toUpperCase()}${replacedPixelCount > 0 ? ` / ${replacedPixelCount}px` : ''}`,
          'success'
        );
      } else {
        setStatusText('パレット設定を更新しました', 'success');
      }
    },
    [palette, pixels, pushUndo, selectedColor, setHasUnsavedChanges, setPalette, setPixels, setSelectedColor, setStatusText]
  );

  const applyImportedPalette = useCallback(
    (importedPalette: PaletteEntry[], mode: 'replace' | 'append', filePath?: string) => {
      const normalizedImported = normalizePaletteEntries(importedPalette);
      if (normalizedImported.length === 0) {
        setStatusText('インポートできる色がありませんでした', 'warning');
        return;
      }

      const nextPalette =
        mode === 'append'
          ? normalizePaletteEntries([...clonePaletteEntries(palette), ...clonePaletteEntries(normalizedImported)])
          : clonePaletteEntries(normalizedImported);

      if (hasSamePaletteEntries(palette, nextPalette)) {
        setStatusText(
          mode === 'append'
            ? '追加できる新しい色がありませんでした'
            : '読み込んだパレットは現在の内容と同じです',
          'warning'
        );
        return;
      }

      const nextSelectedColor = resolveNextSelectedColor(nextPalette, selectedColor);
      const importedCount =
        mode === 'append' ? Math.max(0, nextPalette.length - palette.length) : nextPalette.length;
      const sourceLabel = getFileNameFromPath(filePath) ?? 'palette.gpl';

      pushUndo();
      setPalette(nextPalette);
      setSelectedColor(nextSelectedColor);
      setHasUnsavedChanges(true);
      setStatusText(
        mode === 'append'
          ? `パレットを追加インポートしました: ${sourceLabel} / +${importedCount} colors`
          : `パレットを置換インポートしました: ${sourceLabel} / ${importedCount} colors`,
        'success'
      );
    },
    [palette, pushUndo, selectedColor, setHasUnsavedChanges, setPalette, setSelectedColor, setStatusText]
  );

  const importGplPalette = useCallback(
    async (mode: 'replace' | 'append') => {
      try {
        const result = await window.pixelApi.importGplPalette({ mode });
        if (result.canceled) {
          setStatusText('パレットのインポートをキャンセルしました', 'warning');
          return;
        }
        if (result.error) {
          const label = result.filePath ? `: ${result.filePath}` : '';
          const detail = result.message ? ` / ${result.message}` : '';
          if (result.error === 'not-found') {
            setStatusText(`パレットファイルが見つかりません${label}`, 'error');
            return;
          }
          if (result.error === 'read-failed') {
            setStatusText(`パレットの読み込みに失敗しました${label}`, 'error');
            return;
          }
          setStatusText(`GPL の解析に失敗しました${label}${detail}`, 'error');
          return;
        }
        if (!result.palette) {
          setStatusText('パレットのインポート結果が空です', 'error');
          return;
        }
        applyImportedPalette(result.palette, result.mode ?? mode, result.filePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : '不明なエラー';
        setStatusText(`パレットのインポートに失敗しました: ${message}`, 'error');
      }
    },
    [applyImportedPalette, setStatusText]
  );

  const exportGplPalette = useCallback(
    async (format: GplExportFormat) => {
      try {
        const currentFileName = getFileNameFromPath(currentFilePath);
        const suggestedFileName = replaceFileExtension(
          currentFileName ?? 'palette',
          format === 'rgba' ? '-rgba.gpl' : '.gpl'
        );
        const exportLabel = format === 'rgba' ? 'Aseprite向け RGBA GPL' : '標準 GPL';
        const result = await window.pixelApi.exportGplPalette({
          palette: clonePaletteEntries(palette),
          format,
          suggestedFileName,
          paletteName: currentFileName ? currentFileName.replace(/\.[^.]+$/, '') : 'DlaPixy Palette'
        });

        if (result.canceled) {
          setStatusText('パレットのエクスポートをキャンセルしました', 'warning');
          return;
        }
        if (result.error) {
          const detail = result.message ? `: ${result.message}` : '';
          setStatusText(`パレットのエクスポートに失敗しました${detail}`, 'error');
          return;
        }

        setStatusText(
          `パレットを${exportLabel}でエクスポートしました: ${result.filePath ?? suggestedFileName}`,
          'success'
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : '不明なエラー';
        setStatusText(`パレットのエクスポートに失敗しました: ${message}`, 'error');
      }
    },
    [currentFilePath, palette, setStatusText]
  );

  const confirmPaletteRemoval = useCallback(() => {
    if (!paletteRemovalRequest) {
      return;
    }
    void removePaletteColorsInternal(paletteRemovalRequest.colors, true);
  }, [paletteRemovalRequest, removePaletteColorsInternal]);

  const closePaletteRemovalModal = useCallback(() => {
    setPaletteRemovalRequest(null);
  }, []);

  return {
    paletteRemovalRequest,
    syncPaletteAfterPaste,
    addPaletteColor,
    removeSelectedColorFromPalette,
    removePaletteColors,
    mergePaletteColors,
    applySelectedColorChange,
    importGplPalette,
    exportGplPalette,
    confirmPaletteRemoval,
    closePaletteRemovalModal
  };
}
