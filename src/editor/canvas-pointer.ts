export type DrawState = {
  active: boolean;
  selectionStart: { x: number; y: number } | null;
  selectionMoved: boolean;
  clearSelectionOnMouseUp: boolean;
  lastDrawCell: { x: number; y: number } | null;
  moveStartPoint: { x: number; y: number } | null;
  moveStartOrigin: { x: number; y: number } | null;
};
