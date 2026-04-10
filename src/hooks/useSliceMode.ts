/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MouseEvent as ReactMouseEvent, type SetStateAction } from 'react';
import {
  cloneSlices,
  createDefaultSliceName,
  generateEditorSliceId,
  hasSameSlices,
  moveSlicesWithinCanvas,
  normalizeSliceName,
  normalizeSliceRect,
  resizeSliceFromHandle,
  type EditorSlice,
  type SliceResizeHandle
} from '../editor/slices';
import type { Selection, Tool } from '../editor/types';

type StatusType = 'success' | 'warning' | 'error' | 'info';

type SliceInteractionSession =
  | {
      type: 'create';
      start: { x: number; y: number };
      preserveSelection: boolean;
    }
  | {
      type: 'select-rect';
      start: { x: number; y: number };
      baseSelectedIds: string[];
      baseActiveId: string | null;
      clickedSliceId?: string;
      clickedSliceWasSelected?: boolean;
    }
  | {
      type: 'move';
      start: { x: number; y: number };
      baseSlices: EditorSlice[];
      selectedIds: string[];
      didSnapshot: boolean;
      didMove: boolean;
    }
  | {
      type: 'resize';
      start: { x: number; y: number };
      baseSlices: EditorSlice[];
      sliceId: string;
      handle: SliceResizeHandle;
      didSnapshot: boolean;
      didResize: boolean;
    };

type UseSliceModeOptions = {
  canvasSize: number;
  tool: Tool;
  slices: EditorSlice[];
  selectedSliceIds: string[];
  activeSliceId: string | null;
  pushUndo: () => void;
  clearFloatingPaste: () => void;
  setSlices: Dispatch<SetStateAction<EditorSlice[]>>;
  setSelectedSliceIds: Dispatch<SetStateAction<string[]>>;
  setActiveSliceId: Dispatch<SetStateAction<string | null>>;
  setSelection: Dispatch<SetStateAction<Selection>>;
  setHasUnsavedChanges: Dispatch<SetStateAction<boolean>>;
  setStatusText: (text: string, type: StatusType) => void;
  resolveCanvasCellFromClient: (clientX: number, clientY: number) => { x: number; y: number } | null;
  resolveCanvasClampedCellFromClient: (clientX: number, clientY: number) => { x: number; y: number } | null;
};

function getUniqueSliceName(baseName: string, slices: EditorSlice[]): string {
  const normalizedBaseName = normalizeSliceName(baseName) || createDefaultSliceName(slices.length + 1);
  const usedNames = new Set(slices.map((slice) => slice.name.toLowerCase()));
  if (!usedNames.has(normalizedBaseName.toLowerCase())) {
    return normalizedBaseName;
  }

  const copyBase = normalizeSliceName(`${normalizedBaseName}-copy`);
  if (!usedNames.has(copyBase.toLowerCase())) {
    return copyBase;
  }

  let index = 2;
  while (index < 10000) {
    const candidate = normalizeSliceName(`${normalizedBaseName}-copy-${index}`);
    if (!usedNames.has(candidate.toLowerCase())) {
      return candidate;
    }
    index += 1;
  }

  return normalizeSliceName(`${normalizedBaseName}-${generateEditorSliceId().slice(0, 8)}`);
}

function resolveNextActiveSliceId(nextSlices: EditorSlice[], preferredIds: string[], preferredActiveId: string | null): string | null {
  if (preferredActiveId && nextSlices.some((slice) => slice.id === preferredActiveId)) {
    return preferredActiveId;
  }

  for (const id of preferredIds) {
    if (nextSlices.some((slice) => slice.id === id)) {
      return id;
    }
  }

  return nextSlices[0]?.id ?? null;
}

function normalizeSliceBounds(slice: EditorSlice, canvasSize: number): EditorSlice {
  const x = Math.max(0, Math.min(canvasSize - 1, Math.trunc(slice.x)));
  const y = Math.max(0, Math.min(canvasSize - 1, Math.trunc(slice.y)));
  const w = Math.max(1, Math.min(canvasSize - x, Math.trunc(slice.w)));
  const h = Math.max(1, Math.min(canvasSize - y, Math.trunc(slice.h)));

  return {
    ...slice,
    x,
    y,
    w,
    h
  };
}

function rectIntersectsSlice(
  rect: { x: number; y: number; w: number; h: number },
  slice: EditorSlice
): boolean {
  return !(
    rect.x + rect.w <= slice.x ||
    slice.x + slice.w <= rect.x ||
    rect.y + rect.h <= slice.y ||
    slice.y + slice.h <= rect.y
  );
}

export function useSliceMode({
  canvasSize,
  tool,
  slices,
  selectedSliceIds,
  activeSliceId,
  pushUndo,
  clearFloatingPaste,
  setSlices,
  setSelectedSliceIds,
  setActiveSliceId,
  setSelection,
  setHasUnsavedChanges,
  setStatusText,
  resolveCanvasCellFromClient,
  resolveCanvasClampedCellFromClient
}: UseSliceModeOptions) {
  const isSliceMode = tool === 'slice';
  const [draftSlice, setDraftSlice] = useState<Omit<EditorSlice, 'id' | 'name'> | null>(null);
  const [selectionMarquee, setSelectionMarquee] = useState<Omit<EditorSlice, 'id' | 'name'> | null>(null);
  const [sliceClipboardCount, setSliceClipboardCount] = useState<number>(0);
  const interactionRef = useRef<SliceInteractionSession | null>(null);
  const clipboardRef = useRef<EditorSlice[]>([]);
  const draftSliceRef = useRef<Omit<EditorSlice, 'id' | 'name'> | null>(null);
  const selectionMarqueeRef = useRef<Omit<EditorSlice, 'id' | 'name'> | null>(null);

  useEffect(() => {
    setSelectedSliceIds((prev) => prev.filter((id) => slices.some((slice) => slice.id === id)));
    setActiveSliceId((prev) => (prev && slices.some((slice) => slice.id === prev) ? prev : null));
  }, [slices]);

  useEffect(() => {
    if (!isSliceMode) {
      interactionRef.current = null;
      setDraftSlice(null);
      draftSliceRef.current = null;
      setSelectionMarquee(null);
      selectionMarqueeRef.current = null;
      return;
    }

    clearFloatingPaste();
    setSelection(null);
  }, [clearFloatingPaste, isSliceMode, setSelection]);

  const activeSlice = useMemo(
    () => slices.find((slice) => slice.id === activeSliceId) ?? null,
    [activeSliceId, slices]
  );

  const orderedSlices = useMemo(
    () =>
      [...slices].sort((left, right) => {
        if (left.y !== right.y) {
          return left.y - right.y;
        }
        if (left.x !== right.x) {
          return left.x - right.x;
        }
        return left.name.localeCompare(right.name, 'ja');
      }),
    [slices]
  );

  const resetSliceUiState = useCallback(() => {
    interactionRef.current = null;
    setDraftSlice(null);
    draftSliceRef.current = null;
    setSelectionMarquee(null);
    selectionMarqueeRef.current = null;
    clipboardRef.current = [];
    setSliceClipboardCount(0);
    setSelectedSliceIds([]);
    setActiveSliceId(null);
  }, []);

  const clearSliceSelection = useCallback(() => {
    setSelectedSliceIds([]);
    setActiveSliceId(null);
  }, []);

  const nudgeSelectedSlices = useCallback(
    (dx: number, dy: number): boolean => {
      if (selectedSliceIds.length === 0) {
        return false;
      }

      const nextSlices = moveSlicesWithinCanvas(slices, selectedSliceIds, dx, dy, canvasSize);
      if (hasSameSlices(nextSlices, slices)) {
        return false;
      }

      pushUndo();
      setSlices(nextSlices);
      setHasUnsavedChanges(true);
      return true;
    },
    [canvasSize, pushUndo, selectedSliceIds, setHasUnsavedChanges, setSlices, slices]
  );

  const selectSliceIds = useCallback((nextIds: string[], nextActiveId: string | null) => {
    const uniqueIds = Array.from(new Set(nextIds)).filter((id) => slices.some((slice) => slice.id === id));
    setSelectedSliceIds(uniqueIds);
    setActiveSliceId(uniqueIds.length > 0 ? resolveNextActiveSliceId(slices, uniqueIds, nextActiveId) : null);
  }, [slices]);

  const selectAllSlices = useCallback(() => {
    if (slices.length === 0) {
      setStatusText('slice がありません', 'warning');
      return false;
    }

    selectSliceIds(slices.map((slice) => slice.id), slices[slices.length - 1]?.id ?? null);
    setStatusText(`${slices.length}件の slice を選択しました`, 'success');
    return true;
  }, [selectSliceIds, setStatusText, slices]);

  const deleteSelectedSlices = useCallback(() => {
    if (selectedSliceIds.length === 0) {
      return false;
    }

    pushUndo();
    setSlices((prev) => prev.filter((slice) => !selectedSliceIds.includes(slice.id)));
    setSelectedSliceIds([]);
    setActiveSliceId(null);
    setHasUnsavedChanges(true);
    setStatusText(
      selectedSliceIds.length === 1 ? 'slice を削除しました' : `${selectedSliceIds.length}件の slice を削除しました`,
      'success'
    );
    return true;
  }, [pushUndo, selectedSliceIds, setHasUnsavedChanges, setSlices, setStatusText]);

  const removeSlice = useCallback((sliceId: string) => {
    if (!slices.some((slice) => slice.id === sliceId)) {
      return false;
    }

    pushUndo();
    setSlices((prev) => prev.filter((slice) => slice.id !== sliceId));
    const nextSelectedIds = selectedSliceIds.filter((id) => id !== sliceId);
    setSelectedSliceIds(nextSelectedIds);
    setActiveSliceId((prev) => (prev === sliceId ? resolveNextActiveSliceId(slices.filter((slice) => slice.id !== sliceId), nextSelectedIds, null) : prev));
    setHasUnsavedChanges(true);
    setStatusText('slice を削除しました', 'success');
    return true;
  }, [pushUndo, selectedSliceIds, setHasUnsavedChanges, setSlices, setStatusText, slices]);

  const copySelectedSlices = useCallback(() => {
    if (selectedSliceIds.length === 0) {
      setStatusText('コピーする slice を選択してください', 'warning');
      return false;
    }

    clipboardRef.current = slices
      .filter((slice) => selectedSliceIds.includes(slice.id))
      .map((slice) => ({ ...slice }));
    setSliceClipboardCount(clipboardRef.current.length);
    setStatusText(
      clipboardRef.current.length === 1
        ? 'slice をコピーしました'
        : `${clipboardRef.current.length}件の slice をコピーしました`,
      'success'
    );
    return true;
  }, [selectedSliceIds, setStatusText, slices]);

  const pasteSlices = useCallback(() => {
    if (clipboardRef.current.length === 0) {
      setStatusText('貼り付けできる slice がありません', 'warning');
      return false;
    }

    pushUndo();
    setSlices((prev) => {
      const next = cloneSlices(prev);
      const shifted = moveSlicesWithinCanvas(
        clipboardRef.current,
        clipboardRef.current.map((slice) => slice.id),
        1,
        1,
        canvasSize
      );
      const created = shifted.map((slice) => {
        const createdSlice: EditorSlice = {
          ...slice,
          id: generateEditorSliceId(),
          name: getUniqueSliceName(slice.name || createDefaultSliceName(next.length + 1), next)
        };
        next.push(createdSlice);
        return createdSlice;
      });
      setSelectedSliceIds(created.map((slice) => slice.id));
      setActiveSliceId(created[created.length - 1]?.id ?? null);
      return next;
    });
    setHasUnsavedChanges(true);
    setStatusText(
      clipboardRef.current.length === 1
        ? 'slice を貼り付けました'
        : `${clipboardRef.current.length}件の slice を貼り付けました`,
      'success'
    );
    return true;
  }, [canvasSize, pushUndo, setHasUnsavedChanges, setSlices, setStatusText]);

  const duplicateSelectedSlices = useCallback(() => {
    if (selectedSliceIds.length === 0) {
      setStatusText('複製する slice を選択してください', 'warning');
      return false;
    }

    clipboardRef.current = slices
      .filter((slice) => selectedSliceIds.includes(slice.id))
      .map((slice) => ({ ...slice }));
    setSliceClipboardCount(clipboardRef.current.length);
    return pasteSlices();
  }, [pasteSlices, selectedSliceIds, setStatusText, slices]);

  const updateActiveSlice = useCallback(
    (updater: (slice: EditorSlice) => EditorSlice) => {
      if (!activeSliceId) {
        return false;
      }

      const target = slices.find((slice) => slice.id === activeSliceId);
      if (!target) {
        return false;
      }

      const nextSlice = normalizeSliceBounds(updater(target), canvasSize);
      if (
        nextSlice.name === target.name &&
        nextSlice.x === target.x &&
        nextSlice.y === target.y &&
        nextSlice.w === target.w &&
        nextSlice.h === target.h
      ) {
        return false;
      }

      pushUndo();
      setSlices((prev) => prev.map((slice) => (slice.id === activeSliceId ? nextSlice : slice)));
      setHasUnsavedChanges(true);
      return true;
    },
    [activeSliceId, canvasSize, pushUndo, setHasUnsavedChanges, setSlices, slices]
  );

  const updateActiveSliceName = useCallback(
    (value: string) =>
      updateActiveSlice((slice) => ({
        ...slice,
        name: normalizeSliceName(value)
      })),
    [updateActiveSlice]
  );

  const updateActiveSliceBounds = useCallback(
    (partial: Partial<Pick<EditorSlice, 'x' | 'y' | 'w' | 'h'>>) =>
      updateActiveSlice((slice) => ({
        ...slice,
        ...partial
      })),
    [updateActiveSlice]
  );

  const commitCreatedSlice = useCallback(
    (rect: Omit<EditorSlice, 'id' | 'name'>) => {
      pushUndo();
      setSlices((prev) => {
        const nextSlice: EditorSlice = {
          id: generateEditorSliceId(),
          name: getUniqueSliceName(createDefaultSliceName(prev.length + 1), prev),
          ...rect
        };
        const next = [...prev, nextSlice];
        setSelectedSliceIds([nextSlice.id]);
        setActiveSliceId(nextSlice.id);
        return next;
      });
      setHasUnsavedChanges(true);
      setStatusText('slice を追加しました', 'success');
    },
    [pushUndo, setHasUnsavedChanges, setSlices, setStatusText]
  );

  const beginCanvasInteractionFromClient = useCallback(
    (clientX: number, clientY: number, modifiers?: { shiftKey?: boolean; preserveSelection?: boolean }) => {
      if (!isSliceMode) {
        return false;
      }

      const cell = resolveCanvasClampedCellFromClient(clientX, clientY);
      if (!cell) {
        return false;
      }

      interactionRef.current = modifiers?.shiftKey
        ? {
            type: 'select-rect',
            start: cell,
            baseSelectedIds: selectedSliceIds,
            baseActiveId: activeSliceId
          }
        : {
            type: 'create',
            start: cell,
            preserveSelection: Boolean(modifiers?.preserveSelection)
          };
      setDraftSlice(null);
      draftSliceRef.current = null;
      setSelectionMarquee(null);
      selectionMarqueeRef.current = null;
      return true;
    },
    [activeSliceId, isSliceMode, resolveCanvasClampedCellFromClient, selectedSliceIds]
  );

  const onCanvasMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      beginCanvasInteractionFromClient(event.clientX, event.clientY, {
        shiftKey: event.shiftKey,
        preserveSelection: event.metaKey || event.ctrlKey
      });
    },
    [beginCanvasInteractionFromClient]
  );

  const onSliceMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>, sliceId: string) => {
      if (!isSliceMode) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const cell = resolveCanvasCellFromClient(event.clientX, event.clientY);
      if (!cell) {
        return;
      }

      if (event.shiftKey) {
        interactionRef.current = {
          type: 'select-rect',
          start: cell,
          baseSelectedIds: selectedSliceIds,
          baseActiveId: activeSliceId,
          clickedSliceId: sliceId,
          clickedSliceWasSelected: selectedSliceIds.includes(sliceId)
        };
        setSelectionMarquee(null);
        selectionMarqueeRef.current = null;
        return;
      }

      const withSystemKey = event.metaKey || event.ctrlKey;
      const currentlySelected = selectedSliceIds.includes(sliceId);
      if (withSystemKey) {
        const nextIds = currentlySelected
          ? selectedSliceIds.filter((id) => id !== sliceId)
          : [...selectedSliceIds, sliceId];
        selectSliceIds(nextIds, currentlySelected ? activeSliceId : sliceId);
        return;
      }

      const nextSelectedIds = currentlySelected ? selectedSliceIds : [sliceId];
      selectSliceIds(nextSelectedIds, sliceId);
      interactionRef.current = {
        type: 'move',
        start: cell,
        baseSlices: cloneSlices(slices),
        selectedIds: nextSelectedIds,
        didSnapshot: false,
        didMove: false
      };
    },
    [activeSliceId, isSliceMode, resolveCanvasCellFromClient, selectSliceIds, selectedSliceIds, slices]
  );

  const onSliceHandleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, sliceId: string, handle: SliceResizeHandle) => {
      if (!isSliceMode) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const cell = resolveCanvasCellFromClient(event.clientX, event.clientY);
      if (!cell) {
        return;
      }

      selectSliceIds([sliceId], sliceId);
      interactionRef.current = {
        type: 'resize',
        start: cell,
        baseSlices: cloneSlices(slices),
        sliceId,
        handle,
        didSnapshot: false,
        didResize: false
      };
    },
    [isSliceMode, resolveCanvasCellFromClient, selectSliceIds, slices]
  );

  const updateInteractionFromClient = useCallback(
    (clientX: number, clientY: number) => {
      if (!isSliceMode || !interactionRef.current) {
        return;
      }

      const cell = resolveCanvasClampedCellFromClient(clientX, clientY);
      if (!cell) {
        return;
      }

      const session = interactionRef.current;
      if (session.type === 'create') {
        if (cell.x === session.start.x && cell.y === session.start.y) {
          setDraftSlice(null);
          draftSliceRef.current = null;
          return;
        }

        const nextDraft = normalizeSliceRect(session.start.x, session.start.y, cell.x, cell.y, canvasSize);
        draftSliceRef.current = nextDraft;
        setDraftSlice(nextDraft);
        return;
      }

      if (session.type === 'select-rect') {
        const nextMarquee = normalizeSliceRect(session.start.x, session.start.y, cell.x, cell.y, canvasSize);
        selectionMarqueeRef.current = nextMarquee;
        setSelectionMarquee(nextMarquee);
        return;
      }

      if (session.type === 'move') {
        const dx = cell.x - session.start.x;
        const dy = cell.y - session.start.y;
        if (dx === 0 && dy === 0) {
          return;
        }

        if (!session.didSnapshot) {
          pushUndo();
          session.didSnapshot = true;
        }
        session.didMove = true;
        setSlices(moveSlicesWithinCanvas(session.baseSlices, session.selectedIds, dx, dy, canvasSize));
        return;
      }

      const sourceSlice = session.baseSlices.find((slice) => slice.id === session.sliceId);
      if (!sourceSlice) {
        return;
      }

      const resized = resizeSliceFromHandle(sourceSlice, session.handle, cell, canvasSize);
      if (
        resized.x === sourceSlice.x &&
        resized.y === sourceSlice.y &&
        resized.w === sourceSlice.w &&
        resized.h === sourceSlice.h
      ) {
        return;
      }

      if (!session.didSnapshot) {
        pushUndo();
        session.didSnapshot = true;
      }
      session.didResize = true;
      setSlices(session.baseSlices.map((slice) => (slice.id === session.sliceId ? resized : slice)));
    },
    [canvasSize, isSliceMode, pushUndo, resolveCanvasClampedCellFromClient, setSlices]
  );

  const finishInteraction = useCallback(() => {
    const session = interactionRef.current;
    interactionRef.current = null;

    if (!session) {
      return;
    }

    if (session.type === 'create') {
      const latestDraftSlice = draftSliceRef.current;
      if (!latestDraftSlice) {
        if (!session.preserveSelection) {
          clearSliceSelection();
        }
        return;
      }

      commitCreatedSlice(latestDraftSlice);
      setDraftSlice(null);
      draftSliceRef.current = null;
      return;
    }

    if (session.type === 'select-rect') {
      const latestMarquee = selectionMarqueeRef.current;
      setSelectionMarquee(null);
      selectionMarqueeRef.current = null;
      if (!latestMarquee) {
        if (session.clickedSliceId) {
          const nextIds = session.clickedSliceWasSelected
            ? session.baseSelectedIds.filter((id) => id !== session.clickedSliceId)
            : [...session.baseSelectedIds, session.clickedSliceId];
          selectSliceIds(nextIds, session.clickedSliceWasSelected ? session.baseActiveId : session.clickedSliceId);
        }
        return;
      }

      const nextSelectedIds = slices
        .filter((slice) => rectIntersectsSlice(latestMarquee, slice))
        .map((slice) => slice.id);
      setSelectedSliceIds(nextSelectedIds);
      setActiveSliceId(nextSelectedIds[nextSelectedIds.length - 1] ?? null);
      setStatusText(
        nextSelectedIds.length > 0
          ? `${nextSelectedIds.length}件の slice を選択しました`
          : '範囲内に slice はありません',
        nextSelectedIds.length > 0 ? 'success' : 'warning'
      );
      return;
    }

    if (session.didSnapshot) {
      setHasUnsavedChanges(true);
      setStatusText(session.type === 'move' ? 'slice を移動しました' : 'slice のサイズを変更しました', 'success');
    }
  }, [clearSliceSelection, commitCreatedSlice, setHasUnsavedChanges, setStatusText]);

  const onMouseLeaveCanvas = useCallback(() => {
    if (!isSliceMode) {
      return;
    }
  }, [isSliceMode]);

  useEffect(() => {
    const onWindowMouseMove = (event: MouseEvent) => {
      if (!interactionRef.current) {
        return;
      }
      updateInteractionFromClient(event.clientX, event.clientY);
    };

    const onWindowMouseUp = () => {
      if (!interactionRef.current) {
        return;
      }
      finishInteraction();
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [finishInteraction, updateInteractionFromClient]);

  const canCopySlices = selectedSliceIds.length > 0;
  const canDeleteSlices = selectedSliceIds.length > 0;
  const canDuplicateSlices = selectedSliceIds.length > 0;
  const canPasteSlices = sliceClipboardCount > 0;

  const selectSliceFromList = useCallback(
    (sliceId: string, selectionMode: 'replace' | 'toggle' | 'range') => {
      if (selectionMode === 'range') {
        const targetIndex = orderedSlices.findIndex((slice) => slice.id === sliceId);
        if (targetIndex < 0) {
          return;
        }

        const anchorId = activeSliceId && orderedSlices.some((slice) => slice.id === activeSliceId)
          ? activeSliceId
          : sliceId;
        const anchorIndex = orderedSlices.findIndex((slice) => slice.id === anchorId);
        if (anchorIndex < 0) {
          selectSliceIds([sliceId], sliceId);
          return;
        }

        const startIndex = Math.min(anchorIndex, targetIndex);
        const endIndex = Math.max(anchorIndex, targetIndex);
        const nextIds = orderedSlices.slice(startIndex, endIndex + 1).map((slice) => slice.id);
        selectSliceIds(nextIds, sliceId);
        return;
      }

      if (selectionMode === 'toggle') {
        const nextIds = selectedSliceIds.includes(sliceId)
          ? selectedSliceIds.filter((id) => id !== sliceId)
          : [...selectedSliceIds, sliceId];
        selectSliceIds(nextIds, sliceId);
        return;
      }

      selectSliceIds([sliceId], sliceId);
    },
    [activeSliceId, orderedSlices, selectSliceIds, selectedSliceIds]
  );

  return {
    isSliceMode,
    orderedSlices,
    draftSlice,
    selectionMarquee,
    selectedSliceIds,
    activeSliceId,
    activeSlice,
    canCopySlices,
    canDeleteSlices,
    canDuplicateSlices,
    canPasteSlices,
    sliceClipboardCount,
    resetSliceUiState,
    clearSliceSelection,
    nudgeSelectedSlices,
    selectAllSlices,
    selectSliceFromList,
    deleteSelectedSlices,
    removeSlice,
    copySelectedSlices,
    pasteSlices,
    duplicateSelectedSlices,
    updateActiveSliceName,
    updateActiveSliceBounds,
    beginCanvasInteractionFromClient,
    onCanvasMouseDown,
    onSliceMouseDown,
    onSliceHandleMouseDown,
    onMouseMoveCanvas: updateInteractionFromClient,
    onMouseUpCanvas: finishInteraction,
    onMouseLeaveCanvas
  };
}
