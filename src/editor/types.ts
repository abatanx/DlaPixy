export type Tool = 'pencil' | 'eraser' | 'fill' | 'select';

export type Selection = { x: number; y: number; w: number; h: number } | null;

export type PaletteEntry = {
  color: string;
  caption: string;
};

export type HoveredPixelInfo = {
  x: number;
  y: number;
  rgba: { r: number; g: number; b: number; a: number };
  hex8: string;
  hsva: { h: number; s: number; v: number; a: number };
  paletteIndex: number | null;
  paletteCaption: string | null;
} | null;

export type EditorMeta = {
  version: number;
  canvasSize?: number;
  gridSpacing?: number;
  palette: PaletteEntry[];
  lastTool: Tool;
};
