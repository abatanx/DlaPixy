import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type DragEvent as ReactDragEvent,
  type SetStateAction
} from 'react';
import type { PaletteColorModalRequest } from '../components/sidebar/types';
import type { PaletteUsageEntry } from '../editor/palette-sync';
import type { HoveredPixelInfo, PaletteEntry, Selection } from '../editor/types';
import { hexToRgba, rgbaToHex8, rgbaToHsva } from '../editor/utils';

type StatusType = 'success' | 'warning' | 'error' | 'info';

type SelectionRect = Exclude<Selection, null>;

type UsePixelReferencesOptions = {
  canvasSize: number;
  pixels: Uint8ClampedArray;
  palette: PaletteEntry[];
  paletteUsageByColor: Record<string, PaletteUsageEntry>;
  floatingPasteRef: { current: unknown };
  scrollCanvasStageToCell: (cell: { x: number; y: number }) => void;
  setSelection: Dispatch<SetStateAction<Selection>>;
  setLastTilePreviewSelection: Dispatch<SetStateAction<Selection>>;
  setSelectedColor: Dispatch<SetStateAction<string>>;
  setPaletteColorModalRequest: Dispatch<SetStateAction<PaletteColorModalRequest>>;
  setStatusText: (text: string, type: StatusType) => void;
};

type PixelInfoFields = {
  rgba: string;
  hex8: string;
  hsva: string;
  paletteIndex: string;
  paletteCaption: string;
};

function hasHoveredPixelInfoSameContent(
  left: NonNullable<HoveredPixelInfo>,
  right: NonNullable<HoveredPixelInfo>
): boolean {
  return (
    left.rgba.r === right.rgba.r &&
    left.rgba.g === right.rgba.g &&
    left.rgba.b === right.rgba.b &&
    left.rgba.a === right.rgba.a &&
    left.hex8 === right.hex8 &&
    left.hsva.h === right.hsva.h &&
    left.hsva.s === right.hsva.s &&
    left.hsva.v === right.hsva.v &&
    left.hsva.a === right.hsva.a &&
    left.paletteIndex === right.paletteIndex &&
    left.paletteCaption === right.paletteCaption
  );
}

export function usePixelReferences({
  canvasSize,
  pixels,
  palette,
  paletteUsageByColor,
  floatingPasteRef,
  scrollCanvasStageToCell,
  setSelection,
  setLastTilePreviewSelection,
  setSelectedColor,
  setPaletteColorModalRequest,
  setStatusText
}: UsePixelReferencesOptions) {
  const [hoveredPixelInfo, setHoveredPixelInfo] = useState<HoveredPixelInfo>(null);
  const [hoveredPaletteColor, setHoveredPaletteColor] = useState<{ hex: string; index: number } | null>(null);
  const [referencePixelInfos, setReferencePixelInfos] = useState<Array<NonNullable<HoveredPixelInfo>>>([]);
  const [draggingReferenceKey, setDraggingReferenceKey] = useState<string | null>(null);

  const resolvePaletteMatch = useCallback(
    (hex8: string): { paletteIndex: number | null; paletteCaption: string | null } => {
      const paletteIndex = palette.findIndex((entry) => entry.color === hex8.toLowerCase());
      if (paletteIndex < 0) {
        return { paletteIndex: null, paletteCaption: null };
      }

      return {
        paletteIndex,
        paletteCaption: palette[paletteIndex]?.caption || null
      };
    },
    [palette]
  );

  const syncReferencePixelInfo = useCallback(
    (info: NonNullable<HoveredPixelInfo>): NonNullable<HoveredPixelInfo> => {
      if (info.x >= 0 && info.y >= 0 && info.x < canvasSize && info.y < canvasSize) {
        const idx = (info.y * canvasSize + info.x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        const a = pixels[idx + 3];
        const hex8 = rgbaToHex8(r, g, b, a).toUpperCase();
        const { paletteIndex, paletteCaption } = resolvePaletteMatch(hex8);
        return {
          x: info.x,
          y: info.y,
          rgba: { r, g, b, a },
          hex8,
          hsva: rgbaToHsva(r, g, b, a),
          paletteIndex,
          paletteCaption
        };
      }

      const paletteSourceIndex = info.paletteIndex ?? info.y;
      const paletteEntry = paletteSourceIndex >= 0 ? palette[paletteSourceIndex] ?? null : null;
      if (!paletteEntry) {
        return {
          ...info,
          paletteIndex: null,
          paletteCaption: null
        };
      }

      const { r, g, b, a } = hexToRgba(paletteEntry.color);
      return {
        x: info.x,
        y: paletteSourceIndex,
        rgba: { r, g, b, a },
        hex8: rgbaToHex8(r, g, b, a).toUpperCase(),
        hsva: rgbaToHsva(r, g, b, a),
        paletteIndex: paletteSourceIndex,
        paletteCaption: paletteEntry.caption || null
      };
    },
    [canvasSize, palette, pixels, resolvePaletteMatch]
  );

  const updateHoveredPixelInfo = useCallback(
    (cell: { x: number; y: number } | null) => {
      if (!cell) {
        setHoveredPixelInfo(null);
        return;
      }

      const idx = (cell.y * canvasSize + cell.x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];
      const hsva = rgbaToHsva(r, g, b, a);
      const hex8 = rgbaToHex8(r, g, b, a).toUpperCase();
      const { paletteIndex, paletteCaption } = resolvePaletteMatch(hex8);

      setHoveredPixelInfo({
        x: cell.x,
        y: cell.y,
        rgba: { r, g, b, a },
        hex8,
        hsva,
        paletteIndex,
        paletteCaption
      });
    },
    [canvasSize, pixels, resolvePaletteMatch]
  );

  const clearHoveredPixelInfo = useCallback(() => {
    setHoveredPixelInfo(null);
  }, []);

  const jumpToPaletteUsage = useCallback(
    (color: string): boolean => {
      if (floatingPasteRef.current) {
        setStatusText('貼り付け移動を確定またはキャンセルしてから使用位置へ移動してください', 'warning');
        return false;
      }

      const usageEntry = paletteUsageByColor[color.toLowerCase()];
      if (!usageEntry) {
        setStatusText(`使用位置がありません: ${color.toUpperCase()}`, 'warning');
        return false;
      }

      const nextSelection = {
        x: usageEntry.firstX,
        y: usageEntry.firstY,
        w: 1,
        h: 1
      } satisfies SelectionRect;

      setSelection(nextSelection);
      setLastTilePreviewSelection(nextSelection);
      updateHoveredPixelInfo({ x: usageEntry.firstX, y: usageEntry.firstY });
      scrollCanvasStageToCell({ x: usageEntry.firstX, y: usageEntry.firstY });
      setStatusText(`使用位置へ移動しました: (${usageEntry.firstX}, ${usageEntry.firstY})`, 'success');
      return true;
    },
    [
      floatingPasteRef,
      paletteUsageByColor,
      scrollCanvasStageToCell,
      setLastTilePreviewSelection,
      setSelection,
      setStatusText,
      updateHoveredPixelInfo
    ]
  );

  const focusHoveredPixel = useCallback((): boolean => {
    if (!hoveredPixelInfo) {
      setStatusText('中心移動: キャンバス上にカーソルを置いてから S を押してください', 'warning');
      return false;
    }

    scrollCanvasStageToCell({ x: hoveredPixelInfo.x, y: hoveredPixelInfo.y });
    setStatusText(`カーソル位置を中央へ移動しました: (${hoveredPixelInfo.x}, ${hoveredPixelInfo.y})`, 'success');
    return true;
  }, [hoveredPixelInfo, scrollCanvasStageToCell, setStatusText]);

  const getPixelInfoFields = useCallback(
    (info: NonNullable<HoveredPixelInfo>): PixelInfoFields => {
      const syncedInfo = syncReferencePixelInfo(info);
      return {
        rgba: `${syncedInfo.rgba.r}, ${syncedInfo.rgba.g}, ${syncedInfo.rgba.b}, ${syncedInfo.rgba.a}`,
        hex8: syncedInfo.hex8,
        hsva: `${syncedInfo.hsva.h.toFixed(1)}, ${syncedInfo.hsva.s.toFixed(1)}%, ${syncedInfo.hsva.v.toFixed(1)}%, ${syncedInfo.hsva.a.toFixed(3)}`,
        paletteIndex: String(syncedInfo.paletteIndex ?? '-'),
        paletteCaption: syncedInfo.paletteCaption || '-'
      };
    },
    [syncReferencePixelInfo]
  );

  const copyTextToClipboard = useCallback(async (text: string): Promise<boolean> => {
    if (!navigator.clipboard?.writeText) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);

  const copyPixelField = useCallback(
    async (label: string, value: string) => {
      const copied = await copyTextToClipboard(value);
      setStatusText(copied ? `${label}をコピーしました` : `${label}のコピーに失敗しました`, copied ? 'success' : 'error');
    },
    [copyTextToClipboard, setStatusText]
  );

  const formatReferenceSourceLabel = useCallback((info: NonNullable<HoveredPixelInfo>): string => {
    return info.x >= 0 ? `(${info.x}, ${info.y})` : `パレット[${info.paletteIndex ?? '-'}]`;
  }, []);

  const selectReferenceByNumber = useCallback(
    (number: number): boolean => {
      if (number < 1 || number > 9) {
        return false;
      }

      const info = referencePixelInfos[number - 1];
      if (!info) {
        return false;
      }

      const syncedInfo = syncReferencePixelInfo(info);
      setSelectedColor(rgbaToHex8(syncedInfo.rgba.r, syncedInfo.rgba.g, syncedInfo.rgba.b, syncedInfo.rgba.a));
      setStatusText(`参照 ${number} の色を選択しました`, 'success');
      return true;
    },
    [referencePixelInfos, setSelectedColor, setStatusText, syncReferencePixelInfo]
  );

  const freezeHoveredPixelInfo = useCallback(() => {
    const infoFromPalette = (() => {
      if (!hoveredPaletteColor) {
        return null;
      }

      const { r, g, b, a } = hexToRgba(hoveredPaletteColor.hex);
      return {
        x: -1,
        y: hoveredPaletteColor.index,
        rgba: { r, g, b, a },
        hex8: rgbaToHex8(r, g, b, a).toUpperCase(),
        hsva: rgbaToHsva(r, g, b, a),
        paletteIndex: hoveredPaletteColor.index,
        paletteCaption: null
      } satisfies NonNullable<HoveredPixelInfo>;
    })();

    const activeInfo = hoveredPixelInfo ?? infoFromPalette;
    if (!activeInfo) {
      setStatusText('参照追加: キャンバスまたはパレット上にマウスを置いてから F を押してください', 'warning');
      return;
    }

    const syncedActiveInfo = syncReferencePixelInfo(activeInfo);
    const matchingPaletteColor =
      syncedActiveInfo.paletteIndex !== null ? palette[syncedActiveInfo.paletteIndex]?.color ?? null : null;
    if (matchingPaletteColor) {
      setSelectedColor(matchingPaletteColor);
    }

    const hasSameInfoIgnoringCoordinate = referencePixelInfos.some(
      (info) =>
        hasHoveredPixelInfoSameContent(info, syncedActiveInfo) &&
        !(info.x === syncedActiveInfo.x && info.y === syncedActiveInfo.y)
    );
    if (hasSameInfoIgnoringCoordinate) {
      setStatusText('参照追加: 同じ色情報がすでに登録済みです', 'warning');
      return;
    }

    const existingIndex = referencePixelInfos.findIndex(
      (info) => info.x === syncedActiveInfo.x && info.y === syncedActiveInfo.y
    );
    if (existingIndex < 0) {
      setReferencePixelInfos((prev) => [...prev, syncedActiveInfo]);
      setStatusText(`参照追加: ${formatReferenceSourceLabel(syncedActiveInfo)} ${syncedActiveInfo.hex8}`, 'success');
      return;
    }

    if (hasHoveredPixelInfoSameContent(referencePixelInfos[existingIndex], syncedActiveInfo)) {
      setStatusText(`参照維持: ${formatReferenceSourceLabel(syncedActiveInfo)} は同じ色です`, 'warning');
      return;
    }

    setReferencePixelInfos((prev) => {
      const next = [...prev];
      next[existingIndex] = syncedActiveInfo;
      return next;
    });
    setStatusText(`参照更新: ${formatReferenceSourceLabel(syncedActiveInfo)} -> ${syncedActiveInfo.hex8}`, 'success');
  }, [
    formatReferenceSourceLabel,
    hoveredPaletteColor,
    hoveredPixelInfo,
    palette,
    referencePixelInfos,
    setSelectedColor,
    setStatusText,
    syncReferencePixelInfo
  ]);

  useEffect(() => {
    setReferencePixelInfos((prev) => {
      let changed = false;
      const next = prev.map((info) => {
        const syncedInfo = syncReferencePixelInfo(info);
        if (syncedInfo.x === info.x && syncedInfo.y === info.y && hasHoveredPixelInfoSameContent(syncedInfo, info)) {
          return info;
        }
        changed = true;
        return syncedInfo;
      });
      return changed ? next : prev;
    });
  }, [syncReferencePixelInfo]);

  const clearReferencePixelInfos = useCallback(() => {
    if (referencePixelInfos.length === 0) {
      setStatusText('参照はすでに空です', 'warning');
      return;
    }

    setReferencePixelInfos([]);
    setStatusText('参照ラインをクリアしました', 'success');
  }, [referencePixelInfos.length, setStatusText]);

  const removeReferencePixelInfo = useCallback(
    (x: number, y: number) => {
      let removed = false;
      setReferencePixelInfos((prev) => {
        const next = prev.filter((info) => {
          const isTarget = info.x === x && info.y === y;
          if (isTarget) {
            removed = true;
          }
          return !isTarget;
        });
        return next.length === prev.length ? prev : next;
      });

      if (removed) {
        setStatusText(`参照を削除しました: (${x}, ${y})`, 'success');
      }
    },
    [setStatusText]
  );

  const openReferencePaletteColorModal = useCallback(
    (info: NonNullable<HoveredPixelInfo>) => {
      const syncedInfo = syncReferencePixelInfo(info);
      const matchedEntry = syncedInfo.paletteIndex !== null ? palette[syncedInfo.paletteIndex] ?? null : null;
      const modalEntry: PaletteEntry = matchedEntry ?? {
        color: syncedInfo.hex8.toLowerCase(),
        caption: syncedInfo.paletteCaption ?? '',
        locked: false
      };

      setSelectedColor(modalEntry.color);
      setPaletteColorModalRequest({
        mode: matchedEntry ? 'edit' : 'create',
        entry: modalEntry
      });
    },
    [palette, setPaletteColorModalRequest, setSelectedColor, syncReferencePixelInfo]
  );

  const getReferenceKey = useCallback((info: NonNullable<HoveredPixelInfo>): string => `${info.x}:${info.y}`, []);

  const onReferenceDragStart = useCallback((event: ReactDragEvent<HTMLDivElement>, sourceKey: string) => {
    setDraggingReferenceKey(sourceKey);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', sourceKey);
  }, []);

  const onReferenceDragEnd = useCallback(() => {
    setDraggingReferenceKey(null);
  }, []);

  const onReferenceDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onReferenceDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, targetKey: string) => {
      event.preventDefault();
      const sourceKey = draggingReferenceKey ?? event.dataTransfer.getData('text/plain');
      setDraggingReferenceKey(null);
      if (!sourceKey || sourceKey === targetKey) {
        return;
      }

      let moved = false;
      setReferencePixelInfos((prev) => {
        const sourceIndex = prev.findIndex((info) => getReferenceKey(info) === sourceKey);
        const targetIndex = prev.findIndex((info) => getReferenceKey(info) === targetKey);
        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
          return prev;
        }

        const next = [...prev];
        const [movedItem] = next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, movedItem);
        moved = true;
        return next;
      });

      if (moved) {
        setStatusText('参照ラインの順序を変更しました', 'success');
      }
    },
    [draggingReferenceKey, getReferenceKey, setStatusText]
  );

  return {
    hoveredPixelInfo,
    setHoveredPaletteColor,
    referencePixelInfos,
    draggingReferenceKey,
    updateHoveredPixelInfo,
    clearHoveredPixelInfo,
    jumpToPaletteUsage,
    focusHoveredPixel,
    getPixelInfoFields,
    copyPixelField,
    selectReferenceByNumber,
    freezeHoveredPixelInfo,
    clearReferencePixelInfos,
    removeReferencePixelInfo,
    openReferencePaletteColorModal,
    getReferenceKey,
    onReferenceDragStart,
    onReferenceDragEnd,
    onReferenceDragOver,
    onReferenceDrop,
    syncReferencePixelInfo
  };
}
