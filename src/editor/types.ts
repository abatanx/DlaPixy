export type Tool = 'pencil' | 'eraser' | 'fill' | 'select';

export type Selection = { x: number; y: number; w: number; h: number } | null;

export type EditorMeta = {
  version: number;
  canvasSize?: number;
  gridSpacing?: number;
  palette: string[];
  lastTool: Tool;
};
