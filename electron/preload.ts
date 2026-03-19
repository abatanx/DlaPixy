import { contextBridge, ipcRenderer } from 'electron';
import type { MenuAction } from '../shared/ipc';

type PaletteEntry = {
  color: string;
  caption: string;
};

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
