export {};

declare global {
  interface Window {
    pixelApi: {
      savePng: (args: {
        base64Png: string;
        metadata: {
          version: number;
          canvasSize?: number;
          gridSpacing?: number;
          palette: string[];
          lastTool: 'pencil' | 'eraser' | 'fill' | 'select';
        };
        filePath?: string;
        saveAs?: boolean;
      }) => Promise<{ canceled: boolean; filePath?: string }>;
      openPng: () => Promise<{
        canceled: boolean;
        filePath?: string;
        base64Png?: string;
        metadata?: {
          version: number;
          canvasSize?: number;
          gridSpacing?: number;
          palette: string[];
          lastTool: 'pencil' | 'eraser' | 'fill' | 'select';
        } | null;
      }>;
      copyImageDataUrl: (dataUrl: string) => Promise<{ ok: boolean }>;
      confirmOpenWithUnsaved: () => Promise<{ action: 'save-open' | 'discard-open' | 'cancel' }>;
    };
  }
}
