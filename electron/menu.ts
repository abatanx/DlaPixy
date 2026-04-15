/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { app, Menu } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import type { MenuAction } from '../shared/ipc';
import {
  TRANSPARENT_BACKGROUND_LABELS,
  TRANSPARENT_BACKGROUND_MODES,
  type TransparentBackgroundMode
} from '../shared/transparent-background';

export type AppPreferences = {
  recentFiles: string[];
  lastDirectory: string | null;
};

type BuildApplicationMenuArgs = {
  preferences: AppPreferences;
  transparentBackgroundMode: TransparentBackgroundMode;
  createWindow: () => void;
  sendMenuAction: (action: MenuAction) => void;
  setTransparentBackgroundMode: (mode: TransparentBackgroundMode) => void;
};

function buildAppMenuTemplate({ sendMenuAction }: BuildApplicationMenuArgs): MenuItemConstructorOptions {
  return {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      {
        label: 'ライセンス',
        click: () => sendMenuAction({ type: 'show-licenses' })
      },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  };
}

function buildFileMenuTemplate({
  preferences,
  createWindow,
  sendMenuAction
}: BuildApplicationMenuArgs): MenuItemConstructorOptions {
  const recentSubmenu: MenuItemConstructorOptions[] =
    preferences.recentFiles.length === 0
      ? [{ label: '履歴なし', enabled: false }]
      : preferences.recentFiles.map((filePath) => ({
          label: path.basename(filePath),
          sublabel: filePath,
          click: () => sendMenuAction({ type: 'open-recent', filePath })
        }));

  return {
    label: 'File',
    submenu: [
      {
        label: '新規',
        accelerator: 'CmdOrCtrl+N',
        click: () => createWindow()
      },
      {
        label: '開く...',
        accelerator: 'CmdOrCtrl+O',
        click: () => sendMenuAction({ type: 'open' })
      },
      { type: 'separator' },
      {
        label: '保存',
        accelerator: 'CmdOrCtrl+S',
        click: () => sendMenuAction({ type: 'save' })
      },
      {
        label: '別名で保存...',
        accelerator: 'Shift+CmdOrCtrl+S',
        click: () => sendMenuAction({ type: 'save-as' })
      },
      { type: 'separator' },
      {
        label: '最近使ったファイル',
        submenu: recentSubmenu
      },
      { type: 'separator' },
      ...(process.platform === 'darwin'
        ? [{ role: 'close' as const }]
        : [{ role: 'quit' as const }])
    ]
  };
}

function buildCanvasMenuTemplate({
  transparentBackgroundMode,
  sendMenuAction,
  setTransparentBackgroundMode
}: BuildApplicationMenuArgs): MenuItemConstructorOptions {
  return {
    label: 'Canvas',
    submenu: [
      {
        label: 'キャンバスサイズ変更...',
        click: () => sendMenuAction({ type: 'canvas-size' })
      },
      {
        label: 'グリッド線間隔変更...',
        click: () => sendMenuAction({ type: 'grid-spacing' })
      },
      { type: 'separator' },
      {
        label: 'Slice',
        submenu: [
          {
            label: '自動スライス...',
            click: () => sendMenuAction({ type: 'slice-auto' })
          },
          {
            label: '保存...',
            click: () => sendMenuAction({ type: 'slice-export' })
          }
        ]
      },
      { type: 'separator' },
      {
        label: '透過バックグラウンド',
        submenu: TRANSPARENT_BACKGROUND_MODES.map((mode) => ({
          label: TRANSPARENT_BACKGROUND_LABELS[mode],
          type: 'radio',
          checked: transparentBackgroundMode === mode,
          click: () => setTransparentBackgroundMode(mode)
        }))
      }
    ]
  };
}

function buildPaletteMenuTemplate({ sendMenuAction }: BuildApplicationMenuArgs): MenuItemConstructorOptions {
  return {
    label: 'Palette',
    submenu: [
      {
        label: 'インポート（GPL/すべて置換）...',
        click: () => sendMenuAction({ type: 'palette-import-replace' })
      },
      {
        label: 'インポート（GPL/追加）...',
        click: () => sendMenuAction({ type: 'palette-import-append' })
      },
      { type: 'separator' },
      {
        label: 'K-Meansで減色する...',
        click: () => sendMenuAction({ type: 'palette-kmeans-quantize' })
      },
      {
        label: '不要パレットを削除...',
        click: () => sendMenuAction({ type: 'palette-remove-unused' })
      },
      { type: 'separator' },
      {
        label: 'エクスポート（標準 GPL）...',
        click: () => sendMenuAction({ type: 'palette-export', format: 'rgb' })
      },
      {
        label: 'エクスポート（Aseprite向け RGBA GPL）...',
        click: () => sendMenuAction({ type: 'palette-export', format: 'rgba' })
      }
    ]
  };
}

function buildHelpMenuTemplate({ sendMenuAction }: BuildApplicationMenuArgs): MenuItemConstructorOptions {
  return {
    label: 'Help',
    submenu: [
      {
        label: 'ライセンス',
        click: () => sendMenuAction({ type: 'show-licenses' })
      }
    ]
  };
}

export function buildApplicationMenu(args: BuildApplicationMenuArgs): void {
  const appMenu = buildAppMenuTemplate(args);
  const fileMenu = buildFileMenuTemplate(args);
  const canvasMenu = buildCanvasMenuTemplate(args);
  const paletteMenu = buildPaletteMenuTemplate(args);
  const helpMenu = buildHelpMenuTemplate(args);
  const template: MenuItemConstructorOptions[] = process.platform === 'darwin'
    ? [
        appMenu,
        fileMenu,
        canvasMenu,
        paletteMenu,
        { role: 'editMenu' },
        { role: 'viewMenu' },
        { role: 'windowMenu' },
        helpMenu
      ]
    : [fileMenu, canvasMenu, paletteMenu, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }, helpMenu];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
