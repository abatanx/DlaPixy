/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import type { MenuAction } from '../shared/ipc';
import type { GplExportFormat } from '../shared/palette-gpl';
import type { PaletteEntry } from '../shared/palette';
import type { EditorSidecar } from '../shared/sidecar';
import type { TransparentBackgroundMode } from '../shared/transparent-background';
export {};

declare global {
  interface Window {
    pixelApi: {
      savePng: (args: {
        base64Png: string;
        metadata: EditorSidecar;
        filePath?: string;
        saveAs?: boolean;
      }) => Promise<{ canceled: boolean; filePath?: string }>;
      openPng: (args?: { filePath?: string }) => Promise<{
        canceled: boolean;
        filePath?: string;
        base64Png?: string;
        error?: 'not-found' | 'read-failed';
        metadata?: EditorSidecar | null;
      }>;
      importGplPalette: (args?: { mode?: 'replace' | 'append' }) => Promise<{
        canceled: boolean;
        filePath?: string;
        mode?: 'replace' | 'append';
        error?: 'not-found' | 'read-failed' | 'parse-failed';
        message?: string;
        palette?: PaletteEntry[];
      }>;
      exportGplPalette: (args: {
        palette: PaletteEntry[];
        format: GplExportFormat;
        suggestedFileName?: string;
        paletteName?: string;
      }) => Promise<{
        canceled: boolean;
        filePath?: string;
        error?: 'serialize-failed' | 'write-failed';
        message?: string;
      }>;
      setTransparentBackgroundMode: (mode: TransparentBackgroundMode) => Promise<{ ok: boolean }>;
      copyImageDataUrl: (args: { dataUrl: string; markerToken?: string }) => Promise<{ ok: boolean }>;
      readClipboardImageDataUrl: () => Promise<{
        ok: boolean;
        hasImage: boolean;
        dataUrl?: string;
        markerToken?: string;
      }>;
      confirmOpenWithUnsaved: () => Promise<{ action: 'save-open' | 'discard-open' | 'cancel' }>;
      onMenuAction: (handler: (action: MenuAction) => void) => () => void;
    };
  }
}
