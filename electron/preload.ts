import { contextBridge, ipcRenderer } from 'electron';
import type { MenuAction } from '../shared/ipc';
import type { GplExportFormat } from '../shared/palette-gpl';
import type { PaletteEntry } from '../shared/palette';
import type { EditorSidecar } from '../shared/sidecar';
import type { TransparentBackgroundMode } from '../shared/transparent-background';

contextBridge.exposeInMainWorld('pixelApi', {
  // Narrow bridge: expose only required IPC APIs to renderer.
  savePng: (args: { base64Png: string; metadata: EditorSidecar; filePath?: string; saveAs?: boolean }) =>
    ipcRenderer.invoke('png:save', args),
  openPng: (args?: { filePath?: string }) => ipcRenderer.invoke('png:open', args),
  importGplPalette: (args?: { mode?: 'replace' | 'append' }) => ipcRenderer.invoke('palette:import-gpl', args),
  exportGplPalette: (args: {
    palette: PaletteEntry[];
    format: GplExportFormat;
    suggestedFileName?: string;
    paletteName?: string;
  }) =>
    ipcRenderer.invoke('palette:export-gpl', args),
  setTransparentBackgroundMode: (mode: TransparentBackgroundMode) =>
    ipcRenderer.invoke('editor:set-transparent-background-mode', mode) as Promise<{ ok: boolean }>,
  copyImageDataUrl: (args: { dataUrl: string; markerToken?: string }) =>
    ipcRenderer.invoke('clipboard:writeImageDataUrl', args),
  readClipboardImageDataUrl: () =>
    ipcRenderer.invoke('clipboard:readImageDataUrl') as Promise<{
      ok: boolean;
      hasImage: boolean;
      dataUrl?: string;
      markerToken?: string;
    }>,
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
