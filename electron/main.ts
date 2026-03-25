/// <reference path="./png-modules.d.ts" />
import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage } from 'electron';
import type { MessageBoxOptions } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import extractChunks from 'png-chunks-extract';
import encodeChunks from 'png-chunks-encode';
import type { MenuAction } from '../shared/ipc';
import { parseGplPalette, serializeGplPalette, type GplExportFormat } from '../shared/palette-gpl';
import type { PaletteEntry } from '../shared/palette';
import {
  DEFAULT_TRANSPARENT_BACKGROUND_MODE,
  isTransparentBackgroundMode,
  type TransparentBackgroundMode
} from '../shared/transparent-background';
import { buildApplicationMenu, type AppPreferences } from './menu';

type EditorMeta = {
  version: number;
  canvasSize?: number;
  gridSpacing?: number;
  palette: PaletteEntry[];
  lastTool: 'pencil' | 'eraser' | 'fill' | 'select';
};

type PngChunk = ReturnType<typeof extractChunks>[number];

const RECENT_MAX = 10;
const PREFERENCES_FILE = 'preferences.json';
const SIDECAR_SUFFIX = '.dla-pixy.json';

let mainWindow: BrowserWindow | null = null;
let preferences: AppPreferences = {
  recentFiles: [],
  lastDirectory: null,
  transparentBackgroundMode: DEFAULT_TRANSPARENT_BACKGROUND_MODE
};

function getPreferencesPath(): string {
  return path.join(app.getPath('userData'), PREFERENCES_FILE);
}

function getSidecarPath(pngFilePath: string): string {
  const parsed = path.parse(pngFilePath);
  return path.join(parsed.dir, `${parsed.name}${SIDECAR_SUFFIX}`);
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
        ? (parsed as { recentFiles?: unknown; lastDirectory?: unknown; transparentBackgroundMode?: unknown })
        : {};
    const recentFiles = Array.isArray(parsedPreferences.recentFiles)
      ? parsedPreferences.recentFiles.filter((item): item is string => typeof item === 'string')
      : [];
    const lastDirectory =
      typeof parsedPreferences.lastDirectory === 'string' ? parsedPreferences.lastDirectory : null;
    const transparentBackgroundMode = isTransparentBackgroundMode(parsedPreferences.transparentBackgroundMode)
      ? parsedPreferences.transparentBackgroundMode
      : DEFAULT_TRANSPARENT_BACKGROUND_MODE;
    preferences = {
      recentFiles: recentFiles.slice(0, RECENT_MAX),
      lastDirectory,
      transparentBackgroundMode
    };
  } catch {
    preferences = {
      recentFiles: [],
      lastDirectory: null,
      transparentBackgroundMode: DEFAULT_TRANSPARENT_BACKGROUND_MODE
    };
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
    sendMenuAction,
    setTransparentBackgroundMode
  });
}

function setTransparentBackgroundMode(mode: TransparentBackgroundMode): void {
  if (preferences.transparentBackgroundMode === mode) {
    return;
  }

  preferences.transparentBackgroundMode = mode;
  void savePreferences();
  rebuildApplicationMenu();
  sendMenuAction({ type: 'transparent-background', mode });
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

function isPaletteEntry(value: unknown): value is PaletteEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as { color?: unknown; caption?: unknown; locked?: unknown };
  return (
    typeof candidate.color === 'string' &&
    typeof candidate.caption === 'string' &&
    typeof candidate.locked === 'boolean'
  );
}

function isTool(value: unknown): value is EditorMeta['lastTool'] {
  return value === 'pencil' || value === 'eraser' || value === 'fill' || value === 'select';
}

function parseEditorMeta(rawText: string): EditorMeta | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const candidate = parsed as {
    version?: unknown;
    canvasSize?: unknown;
    gridSpacing?: unknown;
    palette?: unknown;
    lastTool?: unknown;
  };

  if (typeof candidate.version !== 'number' || !Number.isFinite(candidate.version)) {
    return null;
  }
  if (candidate.canvasSize !== undefined && (typeof candidate.canvasSize !== 'number' || !Number.isFinite(candidate.canvasSize))) {
    return null;
  }
  if (
    candidate.gridSpacing !== undefined &&
    (typeof candidate.gridSpacing !== 'number' || !Number.isFinite(candidate.gridSpacing))
  ) {
    return null;
  }
  if (!Array.isArray(candidate.palette) || !candidate.palette.every(isPaletteEntry)) {
    return null;
  }
  if (!isTool(candidate.lastTool)) {
    return null;
  }

  return {
    version: candidate.version,
    canvasSize: candidate.canvasSize,
    gridSpacing: candidate.gridSpacing,
    palette: candidate.palette,
    lastTool: candidate.lastTool
  };
}

async function showInvalidSidecarAlert(sidecarPath: string): Promise<void> {
  const focusedWindow = BrowserWindow.getFocusedWindow() ?? mainWindow ?? undefined;
  const options: MessageBoxOptions = {
    type: 'warning',
    title: '編集メタ情報の読み込みに失敗しました',
    message: `編集メタ情報の読み込みに失敗したため、PNG 単体として開きます。\n${sidecarPath}`,
    buttons: ['OK'],
    defaultId: 0,
    noLink: true
  };

  if (focusedWindow && !focusedWindow.isDestroyed()) {
    await dialog.showMessageBox(focusedWindow, options);
    return;
  }

  await dialog.showMessageBox(options);
}

async function loadSidecarMetadata(
  pngFilePath: string
): Promise<{ metadata: EditorMeta | null }> {
  const sidecarPath = getSidecarPath(pngFilePath);

  let rawText: string;
  try {
    rawText = await fs.readFile(sidecarPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { metadata: null };
    }
    await showInvalidSidecarAlert(sidecarPath);
    return { metadata: null };
  }

  const metadata = parseEditorMeta(rawText);
  if (metadata) {
    return { metadata };
  }

  await showInvalidSidecarAlert(sidecarPath);
  return { metadata: null };
}

async function writeSidecarMetadata(pngFilePath: string, metadata: EditorMeta): Promise<void> {
  const sidecarPath = getSidecarPath(pngFilePath);
  await fs.writeFile(sidecarPath, JSON.stringify(metadata, null, 2), 'utf8');
}

function mergeRenderedPngWithExistingMetadata(renderedBuffer: Buffer, sourceBuffer?: Buffer): Buffer {
  if (!sourceBuffer) {
    return renderedBuffer;
  }

  try {
    const renderedChunks = extractChunks(new Uint8Array(renderedBuffer));
    const sourceChunks = extractChunks(new Uint8Array(sourceBuffer));

    const renderedIhdr = renderedChunks.find((chunk) => chunk.name === 'IHDR');
    const renderedIdats = renderedChunks.filter((chunk) => chunk.name === 'IDAT');
    const renderedIend = renderedChunks.find((chunk) => chunk.name === 'IEND');

    if (!renderedIhdr || renderedIdats.length === 0 || !renderedIend) {
      return renderedBuffer;
    }

    const mergedChunks: PngChunk[] = [];
    let insertedIhdr = false;
    let insertedIdats = false;
    let insertedIend = false;

    for (const chunk of sourceChunks) {
      if (chunk.name === 'IHDR') {
        if (!insertedIhdr) {
          mergedChunks.push(renderedIhdr);
          insertedIhdr = true;
        }
        continue;
      }

      if (chunk.name === 'IDAT') {
        if (!insertedIdats) {
          mergedChunks.push(...renderedIdats);
          insertedIdats = true;
        }
        continue;
      }

      if (chunk.name === 'IEND') {
        if (!insertedIdats) {
          mergedChunks.push(...renderedIdats);
          insertedIdats = true;
        }
        mergedChunks.push(renderedIend);
        insertedIend = true;
        continue;
      }

      // These chunks depend on source transparency/palette encoding and can become invalid
      // when the pixel data is regenerated through the canvas save path.
      if (chunk.name === 'tRNS' || chunk.name === 'hIST') {
        continue;
      }

      mergedChunks.push(chunk);
    }

    if (!insertedIhdr) {
      mergedChunks.unshift(renderedIhdr);
    }
    if (!insertedIdats) {
      mergedChunks.push(...renderedIdats);
    }
    if (!insertedIend) {
      mergedChunks.push(renderedIend);
    }

    return Buffer.from(encodeChunks(mergedChunks));
  } catch {
    return renderedBuffer;
  }
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
  // Renderer sends regenerated PNG bytes + sidecar metadata; main process writes both.
  const rawBuffer = Buffer.from(args.base64Png, 'base64');

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

  let sourceBuffer: Buffer | undefined;
  if (args.filePath) {
    try {
      sourceBuffer = await fs.readFile(args.filePath);
    } catch {
      sourceBuffer = undefined;
    }
  }

  const outputBuffer = mergeRenderedPngWithExistingMetadata(rawBuffer, sourceBuffer);
  await fs.writeFile(outputPath, outputBuffer);
  await writeSidecarMetadata(outputPath, args.metadata);
  addRecentFile(outputPath);
  return { canceled: false, filePath: outputPath };
});

ipcMain.handle('png:open', async (_, args?: { filePath?: string }) => {
  // Main process returns PNG bytes and optional sidecar metadata to renderer.
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
  const { metadata } = await loadSidecarMetadata(filePath);
  addRecentFile(filePath);

  return {
    canceled: false,
    filePath,
    base64Png: fileBuffer.toString('base64'),
    metadata
  };
});

ipcMain.handle('preferences:get', async () => ({
  transparentBackgroundMode: preferences.transparentBackgroundMode
}));

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
