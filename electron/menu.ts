import { Menu } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import type { MenuAction } from '../shared/ipc';

export type AppPreferences = {
  recentFiles: string[];
  lastDirectory: string | null;
};

type BuildApplicationMenuArgs = {
  preferences: AppPreferences;
  createWindow: () => void;
  sendMenuAction: (action: MenuAction) => void;
};

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

function buildCanvasMenuTemplate({ sendMenuAction }: BuildApplicationMenuArgs): MenuItemConstructorOptions {
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

export function buildApplicationMenu(args: BuildApplicationMenuArgs): void {
  const fileMenu = buildFileMenuTemplate(args);
  const canvasMenu = buildCanvasMenuTemplate(args);
  const paletteMenu = buildPaletteMenuTemplate(args);
  const template: MenuItemConstructorOptions[] = process.platform === 'darwin'
    ? [
        { role: 'appMenu' },
        fileMenu,
        canvasMenu,
        paletteMenu,
        { role: 'editMenu' },
        { role: 'viewMenu' },
        { role: 'windowMenu' }
      ]
    : [fileMenu, canvasMenu, paletteMenu, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
