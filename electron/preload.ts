import { contextBridge, ipcRenderer } from 'electron';

type EditorMeta = {
  version: number;
  canvasSize?: number;
  gridSpacing?: number;
  palette: string[];
  lastTool: 'pencil' | 'eraser' | 'fill' | 'select';
};

type FileMenuAction =
  | { type: 'open' }
  | { type: 'save' }
  | { type: 'save-as' }
  | { type: 'open-recent'; filePath: string };

contextBridge.exposeInMainWorld('pixelApi', {
  // Narrow bridge: expose only required IPC APIs to renderer.
  savePng: (args: { base64Png: string; metadata: EditorMeta; filePath?: string; saveAs?: boolean }) =>
    ipcRenderer.invoke('png:save', args),
  openPng: (args?: { filePath?: string }) => ipcRenderer.invoke('png:open', args),
  copyImageDataUrl: (dataUrl: string) => ipcRenderer.invoke('clipboard:writeImageDataUrl', dataUrl),
  confirmOpenWithUnsaved: () => ipcRenderer.invoke('dialog:confirmOpenWithUnsaved'),
  onMenuFileAction: (handler: (action: FileMenuAction) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: FileMenuAction) => {
      handler(action);
    };
    ipcRenderer.on('menu:file-action', listener);
    return () => {
      ipcRenderer.removeListener('menu:file-action', listener);
    };
  }
});
