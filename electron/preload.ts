import { contextBridge, ipcRenderer } from 'electron';
import type { MenuAction } from '../shared/ipc';
import type { PaletteEntry } from '../shared/palette';

type EditorMeta = {
  version: number;
  canvasSize?: number;
  gridSpacing?: number;
  palette: PaletteEntry[];
  lastTool: 'pencil' | 'eraser' | 'fill' | 'select';
};

contextBridge.exposeInMainWorld('pixelApi', {
  // Narrow bridge: expose only required IPC APIs to renderer.
  savePng: (args: { base64Png: string; metadata: EditorMeta; filePath?: string; saveAs?: boolean }) =>
    ipcRenderer.invoke('png:save', args),
  openPng: (args?: { filePath?: string }) => ipcRenderer.invoke('png:open', args),
  importGplPalette: (args?: { mode?: 'replace' | 'append' }) => ipcRenderer.invoke('palette:import-gpl', args),
  exportGplPalette: (args: { palette: PaletteEntry[]; suggestedFileName?: string; paletteName?: string }) =>
    ipcRenderer.invoke('palette:export-gpl', args),
  copyImageDataUrl: (dataUrl: string) => ipcRenderer.invoke('clipboard:writeImageDataUrl', dataUrl),
  confirmOpenWithUnsaved: () => ipcRenderer.invoke('dialog:confirmOpenWithUnsaved'),
  onMenuAction: (handler: (action: MenuAction) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: MenuAction) => {
      handler(action);
    };
    ipcRenderer.on('menu:file-action', listener);
    return () => {
      ipcRenderer.removeListener('menu:file-action', listener);
    };
  }
});
