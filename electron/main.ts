/// <reference path="./png-modules.d.ts" />
import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage } from 'electron';
import type { MessageBoxOptions } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import extractChunks from 'png-chunks-extract';
import encodeChunks from 'png-chunks-encode';
import * as pngText from 'png-chunk-text';
import type { MenuAction } from '../shared/ipc';
import { parseGplPalette, serializeGplPalette, type GplExportFormat } from '../shared/palette-gpl';
import type { PaletteEntry } from '../shared/palette';
import { buildApplicationMenu, type AppPreferences } from './menu';

type EditorMeta = {
  version: number;
  canvasSize?: number;
  gridSpacing?: number;
  palette: PaletteEntry[];
  lastTool: 'pencil' | 'eraser' | 'fill' | 'select';
};

const META_KEYWORD = 'dla-pixy-meta';
const RECENT_MAX = 10;
const PREFERENCES_FILE = 'preferences.json';

let mainWindow: BrowserWindow | null = null;
let preferences: AppPreferences = {
  recentFiles: [],
  lastDirectory: null
};

function getPreferencesPath(): string {
  return path.join(app.getPath('userData'), PREFERENCES_FILE);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveInitialDirectory(): Promise<string> {
  if (preferences.lastDirectory && (await pathExists(preferences.lastDirectory))) {
    return preferences.lastDirectory;
  }
  return os.homedir();
}

async function savePreferences(): Promise<void> {
  try {
    await fs.writeFile(getPreferencesPath(), JSON.stringify(preferences, null, 2), 'utf8');
  } catch {
    // ignore persistence failure
  }
}

async function loadPreferences(): Promise<void> {
  try {
    const raw = await fs.readFile(getPreferencesPath(), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    const parsedPreferences =
      parsed && typeof parsed === 'object'
        ? (parsed as { recentFiles?: unknown; lastDirectory?: unknown })
        : {};
    const recentFiles = Array.isArray(parsedPreferences.recentFiles)
      ? parsedPreferences.recentFiles.filter((item): item is string => typeof item === 'string')
      : [];
    const lastDirectory =
      typeof parsedPreferences.lastDirectory === 'string' ? parsedPreferences.lastDirectory : null;
    preferences = {
      recentFiles: recentFiles.slice(0, RECENT_MAX),
      lastDirectory
    };
  } catch {
    preferences = { recentFiles: [], lastDirectory: null };
  }
}

function sendMenuAction(action: MenuAction): void {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
  if (!targetWindow || targetWindow.isDestroyed()) {
    return;
  }
  targetWindow.webContents.send('menu:file-action', action);
}

function removeRecentFile(filePath: string): void {
  const before = preferences.recentFiles.length;
  preferences.recentFiles = preferences.recentFiles.filter((item) => item !== filePath);
  if (preferences.recentFiles.length !== before) {
    void savePreferences();
    rebuildApplicationMenu();
  }
}

function addRecentFile(filePath: string): void {
  preferences.recentFiles = [filePath, ...preferences.recentFiles.filter((item) => item !== filePath)].slice(0, RECENT_MAX);
  preferences.lastDirectory = path.dirname(filePath);
  void savePreferences();
  rebuildApplicationMenu();
}

function rememberLastDirectory(targetPath: string): void {
  preferences.lastDirectory = path.dirname(targetPath);
  void savePreferences();
}

function rebuildApplicationMenu(): void {
  buildApplicationMenu({
    preferences,
    createWindow,
    sendMenuAction
  });
}

function createWindow(): void {
  // Main application window for renderer UI.
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 980,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function attachMetadataToPng(buffer: Buffer, metadata: EditorMeta): Buffer {
  // Replace existing editor metadata chunk to avoid duplicates on re-save.
  const chunks = extractChunks(new Uint8Array(buffer));
  const filtered = chunks.filter((chunk) => {
    if (chunk.name !== 'tEXt') {
      return true;
    }
    try {
      const decoded = pngText.decode(chunk.data);
      return decoded.keyword !== META_KEYWORD;
    } catch {
      return true;
    }
  });

  const iendIndex = filtered.findIndex((chunk) => chunk.name === 'IEND');
  const metaChunk = pngText.encode(META_KEYWORD, JSON.stringify(metadata));

  if (iendIndex === -1) {
    filtered.push(metaChunk);
  } else {
    filtered.splice(iendIndex, 0, metaChunk);
  }

  return Buffer.from(encodeChunks(filtered));
}

function parseMetadataFromPng(buffer: Buffer): EditorMeta | null {
  // Read first matching tEXt chunk and parse editor metadata.
  const chunks = extractChunks(new Uint8Array(buffer));
  for (const chunk of chunks) {
    if (chunk.name !== 'tEXt') {
      continue;
    }
    try {
      const decoded = pngText.decode(chunk.data);
      if (decoded.keyword === META_KEYWORD) {
        return JSON.parse(decoded.text) as EditorMeta;
      }
    } catch {
      // ignore invalid chunk
    }
  }
  return null;
}

app.whenReady().then(async () => {
  await loadPreferences();
  createWindow();
  rebuildApplicationMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      rebuildApplicationMenu();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle(
  'png:save',
  async (_, args: { base64Png: string; metadata: EditorMeta; filePath?: string; saveAs?: boolean }) => {
  // Renderer sends raw PNG bytes + metadata; main process writes file.
  const rawBuffer = Buffer.from(args.base64Png, 'base64');
  const bufferWithMetadata = attachMetadataToPng(rawBuffer, args.metadata);

  let outputPath = args.filePath;
  if (!outputPath || args.saveAs) {
    const initialDir = await resolveInitialDirectory();
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
      defaultPath: outputPath ?? path.join(initialDir, 'pixel-art.png')
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    outputPath = result.filePath;
  }

  await fs.writeFile(outputPath, bufferWithMetadata);
  addRecentFile(outputPath);
  return { canceled: false, filePath: outputPath };
});

ipcMain.handle('png:open', async (_, args?: { filePath?: string }) => {
  // Main process returns PNG bytes + embedded metadata to renderer.
  let filePath = args?.filePath;
  if (!filePath) {
    const initialDir = await resolveInitialDirectory();
    const result = await dialog.showOpenDialog({
      defaultPath: initialDir,
      properties: ['openFile'],
      filters: [{ name: 'PNG Image', extensions: ['png'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    filePath = result.filePaths[0];
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await fs.readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      removeRecentFile(filePath);
      return { canceled: false, error: 'not-found' as const, filePath };
    }
    return { canceled: false, error: 'read-failed' as const, filePath };
  }
  const metadata = parseMetadataFromPng(fileBuffer);
  addRecentFile(filePath);

  return {
    canceled: false,
    filePath,
    base64Png: fileBuffer.toString('base64'),
    metadata
  };
});

ipcMain.handle('palette:import-gpl', async (_, args?: { mode?: 'replace' | 'append' }) => {
  const initialDir = await resolveInitialDirectory();
  const result = await dialog.showOpenDialog({
    defaultPath: initialDir,
    properties: ['openFile'],
    filters: [{ name: 'GPL Palette', extensions: ['gpl'] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];

  let rawText: string;
  try {
    rawText = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { canceled: false, error: 'not-found' as const, filePath };
    }
    return { canceled: false, error: 'read-failed' as const, filePath };
  }

  try {
    const parsed = parseGplPalette(rawText);
    rememberLastDirectory(filePath);
    return {
      canceled: false,
      filePath,
      mode: args?.mode ?? 'replace',
      palette: parsed.entries
    };
  } catch (error) {
    return {
      canceled: false,
      error: 'parse-failed' as const,
      filePath,
      message: error instanceof Error ? error.message : 'GPL の解析に失敗しました'
    };
  }
});

ipcMain.handle(
  'palette:export-gpl',
  async (
    _,
    args: {
      palette: PaletteEntry[];
      format?: GplExportFormat;
      suggestedFileName?: string;
      paletteName?: string;
    }
  ) => {
    let content: string;
    try {
      content = serializeGplPalette(args.palette, { name: args.paletteName, format: args.format });
    } catch (error) {
      return {
        canceled: false,
        error: 'serialize-failed' as const,
        message: error instanceof Error ? error.message : 'GPL の書き出し内容を生成できませんでした'
      };
    }

    const initialDir = await resolveInitialDirectory();
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'GPL Palette', extensions: ['gpl'] }],
      defaultPath: path.join(initialDir, args.suggestedFileName ?? 'palette.gpl')
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    try {
      await fs.writeFile(result.filePath, content, 'utf8');
      rememberLastDirectory(result.filePath);
      return { canceled: false, filePath: result.filePath };
    } catch (error) {
      return {
        canceled: false,
        error: 'write-failed' as const,
        filePath: result.filePath,
        message: error instanceof Error ? error.message : 'GPL の書き出しに失敗しました'
      };
    }
  }
);

ipcMain.handle('dialog:confirmOpenWithUnsaved', async () => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const options: MessageBoxOptions = {
    type: 'warning',
    title: '未保存の変更があります',
    message: '未保存の変更があります。読み込み前にどうしますか？',
    buttons: ['保存して開く', '破棄して開く', 'キャンセル'],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  };
  const result = focusedWindow
    ? await dialog.showMessageBox(focusedWindow, options)
    : await dialog.showMessageBox(options);

  if (result.response === 0) {
    return { action: 'save-open' as const };
  }
  if (result.response === 1) {
    return { action: 'discard-open' as const };
  }
  return { action: 'cancel' as const };
});

ipcMain.handle('clipboard:writeImageDataUrl', async (_, dataUrl: string) => {
  // OS clipboard write must run in Electron main process.
  const image = nativeImage.createFromDataURL(dataUrl);
  clipboard.writeImage(image);
  return { ok: true };
});
