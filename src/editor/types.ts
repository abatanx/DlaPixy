export type Tool = 'pencil' | 'eraser' | 'fill' | 'select';

export type Selection = { x: number; y: number; w: number; h: number } | null;

export type EditorMeta = {
  version: number;
  canvasSize?: number;
  gridSpacing?: number;
  // legacy: older saves used `grid` for canvas size
  grid?: number;
  palette: string[];
  lastTool: Tool;
};
