import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import extractChunks from 'png-chunks-extract';
import encodeChunks from 'png-chunks-encode';
import * as pngText from 'png-chunk-text';

type EditorMeta = {
  version: number;
  canvasSize?: number;
  gridSpacing?: number;
  grid?: number;
  palette: string[];
  lastTool: 'pencil' | 'eraser' | 'fill' | 'select';
};

const META_KEYWORD = 'pixel-editor-meta';

function createWindow(): void {
  const win = new BrowserWindow({
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
    win.loadURL(devServerUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function attachMetadataToPng(buffer: Buffer, metadata: EditorMeta): Buffer {
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

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('png:save', async (_, args: { base64Png: string; metadata: EditorMeta; filePath?: string }) => {
  const rawBuffer = Buffer.from(args.base64Png, 'base64');
  const bufferWithMetadata = attachMetadataToPng(rawBuffer, args.metadata);

  let outputPath = args.filePath;
  if (!outputPath) {
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
      defaultPath: 'pixel-art.png'
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    outputPath = result.filePath;
  }

  await fs.writeFile(outputPath, bufferWithMetadata);
  return { canceled: false, filePath: outputPath };
});

ipcMain.handle('png:open', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PNG Image', extensions: ['png'] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  const fileBuffer = await fs.readFile(filePath);
  const metadata = parseMetadataFromPng(fileBuffer);

  return {
    canceled: false,
    filePath,
    base64Png: fileBuffer.toString('base64'),
    metadata
  };
});

ipcMain.handle('clipboard:writeImageDataUrl', async (_, dataUrl: string) => {
  const image = nativeImage.createFromDataURL(dataUrl);
  clipboard.writeImage(image);
  return { ok: true };
});
