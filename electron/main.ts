/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

/// <reference path="./png-modules.d.ts" />
import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage } from 'electron';
import type { MessageBoxOptions } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import toIco from 'to-ico';
import { Icns, IcnsImage, type OSType } from '@fiahfy/icns';
import extractChunks from 'png-chunks-extract';
import encodeChunks from 'png-chunks-encode';
import type { MenuAction } from '../shared/ipc';
import {
  DEFAULT_FLOATING_COMPOSITE_MODE,
  isFloatingCompositeMode
} from '../shared/floating-composite';
import {
  DEFAULT_FLOATING_SCALE_MODE,
  isFloatingScaleMode
} from '../shared/floating-scale-mode';
import { parseGplPalette, serializeGplPalette, type GplExportFormat } from '../shared/palette-gpl';
import { isPaletteEntryId, type PaletteEntry } from '../shared/palette';
import { isEditorSliceId, type EditorSlice } from '../shared/slice';
import type { SliceExportWriteBundleFile, SliceExportWriteFile, SliceExportWriteRequest } from '../shared/slice-export-ipc';
import { SIDECAR_SCHEMA_VERSION, type EditorSidecar } from '../shared/sidecar';
import {
  DEFAULT_TRANSPARENT_BACKGROUND_MODE,
  isTransparentBackgroundMode,
  type TransparentBackgroundMode
} from '../shared/transparent-background';
import { buildApplicationMenu, type AppPreferences } from './menu';

type EditorMeta = EditorSidecar;

type PngChunk = ReturnType<typeof extractChunks>[number];

const RECENT_MAX = 10;
const PREFERENCES_FILE = 'preferences.json';
const SIDECAR_SUFFIX = '.dla-pixy.json';
const CLIPBOARD_MARKER_FORMAT = 'application/x-dlapixy-selection-token';
const ICNS_OS_TYPE_BY_VARIANT_KEY: Record<string, OSType> = {
  '16': 'icp4',
  '16@2x': 'ic11',
  '32': 'icp5',
  '32@2x': 'ic12',
  '128': 'ic07',
  '128@2x': 'ic13',
  '256': 'ic08',
  '256@2x': 'ic14',
  '512': 'ic09',
  '512@2x': 'ic10'
};

let mainWindow: BrowserWindow | null = null;
let preferences: AppPreferences = {
  recentFiles: [],
  lastDirectory: null
};
let currentTransparentBackgroundMode: TransparentBackgroundMode = DEFAULT_TRANSPARENT_BACKGROUND_MODE;

app.setName('DlaPixy');

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

async function readFileIfExists(targetPath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(targetPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function isSliceExportWriteBundleFile(value: SliceExportWriteFile): value is SliceExportWriteBundleFile {
  return value.kind === 'bundle';
}

function isValidSliceExportWriteFile(value: unknown): value is SliceExportWriteFile {
  if (!isRecord(value) || typeof value.relativePath !== 'string' || typeof value.kind !== 'string') {
    return false;
  }

  if (value.kind === 'png') {
    return typeof value.base64Png === 'string';
  }

  if (value.kind === 'bundle') {
    return (
      (value.format === 'ico' || value.format === 'icns') &&
      Array.isArray(value.members) &&
      value.members.every(
        (member) =>
          isRecord(member) &&
          typeof member.variantKey === 'string' &&
          typeof member.base64Png === 'string'
      )
    );
  }

  return false;
}

async function buildSliceExportBundleBuffer(bundle: SliceExportWriteBundleFile): Promise<Buffer> {
  if (bundle.members.length === 0) {
    throw new Error(`${bundle.format.toUpperCase()} の合成対象がありません`);
  }

  if (bundle.format === 'ico') {
    return toIco(
      bundle.members.map((member) => Buffer.from(member.base64Png, 'base64')),
      { resize: false }
    );
  }

  return buildIcnsBuffer(bundle);
}

function buildIcnsBuffer(bundle: SliceExportWriteBundleFile): Buffer {
  const icns = new Icns();
  const sortedMembers = [...bundle.members].sort(
    (left, right) => getIcnsVariantOrder(left.variantKey) - getIcnsVariantOrder(right.variantKey)
  );

  for (const member of sortedMembers) {
    const osType = ICNS_OS_TYPE_BY_VARIANT_KEY[member.variantKey];
    if (!osType) {
      throw new Error(`ICNS の variant が不明です: ${member.variantKey}`);
    }

    icns.append(IcnsImage.fromPNG(Buffer.from(member.base64Png, 'base64'), osType));
  }

  return icns.data;
}

function getIcnsVariantOrder(variantKey: string): number {
  const keys = Object.keys(ICNS_OS_TYPE_BY_VARIANT_KEY);
  const index = keys.indexOf(variantKey);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
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
    preferences = {
      recentFiles: [],
      lastDirectory: null
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
    transparentBackgroundMode: currentTransparentBackgroundMode,
    createWindow,
    sendMenuAction,
    setTransparentBackgroundMode
  });
}

function setTransparentBackgroundMode(mode: TransparentBackgroundMode, notifyRenderer = true): void {
  if (currentTransparentBackgroundMode === mode) {
    return;
  }

  currentTransparentBackgroundMode = mode;
  rebuildApplicationMenu();
  if (notifyRenderer) {
    sendMenuAction({ type: 'transparent-background', mode });
  }
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

  const candidate = value as { id?: unknown; color?: unknown; caption?: unknown; locked?: unknown };
  return (
    isPaletteEntryId(candidate.id) &&
    typeof candidate.color === 'string' &&
    typeof candidate.caption === 'string' &&
    typeof candidate.locked === 'boolean'
  );
}

function isEditorSlice(value: unknown): value is EditorSlice {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as {
    id?: unknown;
    name?: unknown;
    x?: unknown;
    y?: unknown;
    w?: unknown;
    h?: unknown;
    exportSettings?: unknown;
  };
  return (
    isEditorSliceId(candidate.id) &&
    typeof candidate.name === 'string' &&
    isFiniteNumber(candidate.x) &&
    isFiniteNumber(candidate.y) &&
    isFiniteNumber(candidate.w) &&
    isFiniteNumber(candidate.h) &&
    (candidate.exportSettings === undefined || isRecord(candidate.exportSettings))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isTool(value: unknown): value is EditorMeta['dlaPixy']['editor']['lastTool'] {
  return value === 'pencil' || value === 'eraser' || value === 'fill' || value === 'select' || value === 'slice';
}

function parseEditorMeta(rawText: string): EditorMeta | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  if (!isRecord(parsed.dlaPixy)) {
    return null;
  }

  const candidate = parsed.dlaPixy;
  if (candidate.schemaVersion !== SIDECAR_SCHEMA_VERSION) {
    return null;
  }
  if (!isRecord(candidate.document) || !isRecord(candidate.editor)) {
    return null;
  }

  const candidateDocument = candidate.document;
  const candidateEditor = candidate.editor;
  if (!isRecord(candidateDocument.palette) || !Array.isArray(candidateDocument.palette.entries)) {
    return null;
  }
  if (!candidateDocument.palette.entries.every(isPaletteEntry)) {
    return null;
  }
  const candidateSlices = Array.isArray(candidateDocument.slices) ? candidateDocument.slices : [];
  if (!candidateSlices.every(isEditorSlice)) {
    return null;
  }
  if (
    !isFiniteNumber(candidateEditor.gridSpacing) ||
    !isTransparentBackgroundMode(candidateEditor.transparentBackgroundMode) ||
    !isFiniteNumber(candidateEditor.zoom) ||
    !isTool(candidateEditor.lastTool)
  ) {
    return null;
  }
  if (!isRecord(candidateEditor.viewport)) {
    return null;
  }
  if (!isFiniteNumber(candidateEditor.viewport.scrollLeft) || !isFiniteNumber(candidateEditor.viewport.scrollTop)) {
    return null;
  }

  return {
    dlaPixy: {
      schemaVersion: SIDECAR_SCHEMA_VERSION,
      document: {
        palette: {
          entries: candidateDocument.palette.entries
        },
        slices: candidateSlices
      },
      editor: {
        floatingCompositeMode: isFloatingCompositeMode(candidateEditor.floatingCompositeMode)
          ? candidateEditor.floatingCompositeMode
          : DEFAULT_FLOATING_COMPOSITE_MODE,
        floatingScaleMode: isFloatingScaleMode(candidateEditor.floatingScaleMode)
          ? candidateEditor.floatingScaleMode
          : DEFAULT_FLOATING_SCALE_MODE,
        gridSpacing: candidateEditor.gridSpacing,
        transparentBackgroundMode: candidateEditor.transparentBackgroundMode,
        zoom: candidateEditor.zoom,
        viewport: {
          scrollLeft: candidateEditor.viewport.scrollLeft,
          scrollTop: candidateEditor.viewport.scrollTop
        },
        lastTool: candidateEditor.lastTool
      }
    }
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

ipcMain.handle('editor:set-transparent-background-mode', async (_, mode: unknown) => {
  if (!isTransparentBackgroundMode(mode)) {
    return { ok: false };
  }

  setTransparentBackgroundMode(mode, false);
  return { ok: true };
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

ipcMain.handle(
  'slice:export-files',
  async (_, args: SliceExportWriteRequest) => {
    if (!args || !Array.isArray(args.files)) {
      return {
        canceled: false,
        error: 'invalid-args' as const,
        message: '書き出しファイル情報が不正です'
      };
    }

    const initialDir = await resolveInitialDirectory();
    const result = await dialog.showOpenDialog({
      defaultPath: initialDir,
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const rootDirectory = result.filePaths[0];
    const normalizedRoot = path.resolve(rootDirectory);
    const seenPaths = new Set<string>();
    const plannedWrites: Array<{ outputPath: string; data: Buffer }> = [];
    const rollbackEntries: Array<{ outputPath: string; previousContent: Buffer | null }> = [];

    try {
      for (const file of args.files) {
        if (!isValidSliceExportWriteFile(file)) {
          return {
            canceled: false,
            error: 'invalid-args' as const,
            message: '書き出しファイル情報が不正です'
          };
        }

        const outputPath = path.resolve(normalizedRoot, file.relativePath);
        const relativeFromRoot = path.relative(normalizedRoot, outputPath);
        if (
          relativeFromRoot.startsWith('..') ||
          path.isAbsolute(relativeFromRoot) ||
          relativeFromRoot.length === 0
        ) {
          return {
            canceled: false,
            error: 'invalid-path' as const,
            message: `書き出し先パスが不正です: ${file.relativePath}`
          };
        }

        const dedupeKey = process.platform === 'win32' ? outputPath.toLowerCase() : outputPath;
        if (seenPaths.has(dedupeKey)) {
          return {
            canceled: false,
            error: 'duplicate-path' as const,
            message: `書き出し先パスが重複しています: ${file.relativePath}`
          };
        }
        seenPaths.add(dedupeKey);

        try {
          plannedWrites.push({
            outputPath,
            data: isSliceExportWriteBundleFile(file)
              ? await buildSliceExportBundleBuffer(file)
              : Buffer.from(file.base64Png, 'base64')
          });
        } catch (error) {
          return {
            canceled: false,
            error: 'bundle-build-failed' as const,
            message: error instanceof Error ? error.message : 'アイコン bundle の生成に失敗しました'
          };
        }
      }

      for (const plannedWrite of plannedWrites) {
        rollbackEntries.push({
          outputPath: plannedWrite.outputPath,
          previousContent: await readFileIfExists(plannedWrite.outputPath)
        });
        await fs.mkdir(path.dirname(plannedWrite.outputPath), { recursive: true });
        await fs.writeFile(plannedWrite.outputPath, plannedWrite.data);
      }

      preferences.lastDirectory = rootDirectory;
      void savePreferences();
      return {
        canceled: false,
        directoryPath: rootDirectory,
        fileCount: plannedWrites.length
      };
    } catch (error) {
      for (const rollbackEntry of rollbackEntries.reverse()) {
        try {
          if (rollbackEntry.previousContent) {
            await fs.mkdir(path.dirname(rollbackEntry.outputPath), { recursive: true });
            await fs.writeFile(rollbackEntry.outputPath, rollbackEntry.previousContent);
          } else {
            await fs.rm(rollbackEntry.outputPath, { force: true });
          }
        } catch {
          // ignore rollback failure and return the original error to renderer
        }
      }

      return {
        canceled: false,
        error: 'write-failed' as const,
        directoryPath: rootDirectory,
        message: error instanceof Error ? error.message : 'スライスの書き出しに失敗しました'
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

ipcMain.handle('clipboard:writeImageDataUrl', async (_, args: { dataUrl: string; markerToken?: string }) => {
  // OS clipboard write must run in Electron main process.
  const image = nativeImage.createFromDataURL(args.dataUrl);
  clipboard.writeImage(image);
  clipboard.writeBuffer(CLIPBOARD_MARKER_FORMAT, Buffer.from(args.markerToken ?? '', 'utf8'));
  return { ok: true };
});

ipcMain.handle('clipboard:readImageDataUrl', async () => {
  const image = clipboard.readImage();
  const markerToken = clipboard.readBuffer(CLIPBOARD_MARKER_FORMAT).toString('utf8') || undefined;
  if (image.isEmpty()) {
    return { ok: true, hasImage: false, markerToken };
  }

  return {
    ok: true,
    hasImage: true,
    dataUrl: image.toDataURL(),
    markerToken
  };
});
