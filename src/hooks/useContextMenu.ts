/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useEffect, useRef, useState } from 'react';

export type ContextMenuActionItem = {
  type: 'action';
  id: string;
  label: string;
  iconClassName?: string;
  shortcutLabel?: string;
  selected?: boolean;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  onSelect: () => void | Promise<void>;
};

export type ContextMenuSeparatorItem = {
  type: 'separator';
  id: string;
};

export type ContextMenuItem = ContextMenuActionItem | ContextMenuSeparatorItem;

export type ContextMenuState<TContext> = {
  x: number;
  y: number;
  target: TContext;
  items: ContextMenuItem[];
} | null;

type ContextMenuTriggerEvent = {
  clientX: number;
  clientY: number;
  preventDefault: () => void;
  stopPropagation: () => void;
};

type OpenContextMenuArgs<TContext> = {
  target: TContext;
  items: ContextMenuItem[];
};

export function useContextMenu<TContext>() {
  const [contextMenu, setContextMenu] = useState<ContextMenuState<TContext>>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const openContextMenu = useCallback(
    (event: ContextMenuTriggerEvent, args: OpenContextMenuArgs<TContext>) => {
      if (args.items.length === 0) {
        setContextMenu(null);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        target: args.target,
        items: args.items
      });
    },
    []
  );

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && contextMenuRef.current?.contains(target)) {
        return;
      }
      setContextMenu(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      setContextMenu(null);
    };

    const close = () => {
      setContextMenu(null);
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, [contextMenu]);

  return {
    contextMenu,
    contextMenuRef,
    openContextMenu,
    closeContextMenu
  };
}
