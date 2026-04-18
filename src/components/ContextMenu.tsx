/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useLayoutEffect, useState, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import type { ContextMenuActionItem, ContextMenuItem } from '../hooks/useContextMenu';

type ContextMenuProps = {
  menu: {
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null;
  menuRef: MutableRefObject<HTMLDivElement | null>;
  onClose: () => void;
};

function isContextMenuActionItem(item: ContextMenuItem): item is ContextMenuActionItem {
  return item.type === 'action';
}

export function ContextMenu({
  menu,
  menuRef,
  onClose
}: ContextMenuProps) {
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (!menu) {
      return;
    }

    setPosition({ x: menu.x, y: menu.y });

    const node = menuRef.current;
    if (!node) {
      return;
    }

    const viewportPaddingPx = 10;
    const rect = node.getBoundingClientRect();
    const nextX = Math.max(viewportPaddingPx, Math.min(menu.x, window.innerWidth - rect.width - viewportPaddingPx));
    const nextY = Math.max(viewportPaddingPx, Math.min(menu.y, window.innerHeight - rect.height - viewportPaddingPx));

    setPosition({ x: nextX, y: nextY });
    node.focus();
  }, [menu, menuRef]);

  if (!menu) {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      className="context-menu-popover"
      role="menu"
      aria-label="context menu"
      tabIndex={-1}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
    >
      {menu.items.map((item) =>
        isContextMenuActionItem(item) ? (
          <button
            key={item.id}
            type="button"
            className="context-menu-item"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) {
                return;
              }
              onClose();
              void item.onSelect();
            }}
          >
            <span className="context-menu-item-icon" aria-hidden="true">
              {item.iconClassName ? <i className={item.iconClassName} /> : null}
            </span>
            <span className="context-menu-item-label">{item.label}</span>
            <span className="context-menu-item-shortcut">{item.shortcutLabel ?? ''}</span>
          </button>
        ) : (
          <div
            key={item.id}
            className="context-menu-separator"
            role="separator"
          />
        )
      )}
    </div>,
    document.body
  );
}
