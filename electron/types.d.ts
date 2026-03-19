import type { MenuAction } from '../shared/ipc';
export {};

type PaletteEntry = {
  color: string;
  caption: string;
};

declare global {
  interface Window {
    pixelApi: {
      savePng: (args: {
        base64Png: string;
        metadata: {
          version: number;
          canvasSize?: number;
          gridSpacing?: number;
          palette: PaletteEntry[];
          lastTool: 'pencil' | 'eraser' | 'fill' | 'select';
        };
        filePath?: string;
        saveAs?: boolean;
      }) => Promise<{ canceled: boolean; filePath?: string }>;
      openPng: (args?: { filePath?: string }) => Promise<{
        canceled: boolean;
        filePath?: string;
        base64Png?: string;
        error?: 'not-found' | 'read-failed';
        metadata?: {
          version: number;
          canvasSize?: number;
          gridSpacing?: number;
          palette: PaletteEntry[];
          lastTool: 'pencil' | 'eraser' | 'fill' | 'select';
        } | null;
      }>;
      copyImageDataUrl: (dataUrl: string) => Promise<{ ok: boolean }>;
      confirmOpenWithUnsaved: () => Promise<{ action: 'save-open' | 'discard-open' | 'cancel' }>;
      onMenuAction: (handler: (action: MenuAction) => void) => () => void;
    };
  }
}
