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
    };
  }
}
