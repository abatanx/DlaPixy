import { contextBridge, ipcRenderer } from 'electron';

type EditorMeta = {
  version: number;
  canvasSize?: number;
  gridSpacing?: number;
  grid?: number;
  palette: string[];
  lastTool: 'pencil' | 'eraser' | 'fill' | 'select';
};

contextBridge.exposeInMainWorld('pixelApi', {
  // Narrow bridge: expose only required IPC APIs to renderer.
  savePng: (args: { base64Png: string; metadata: EditorMeta; filePath?: string }) => ipcRenderer.invoke('png:save', args),
  openPng: () => ipcRenderer.invoke('png:open'),
  copyImageDataUrl: (dataUrl: string) => ipcRenderer.invoke('clipboard:writeImageDataUrl', dataUrl)
});
