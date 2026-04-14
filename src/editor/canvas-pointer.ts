/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

export type DrawState = {
  active: boolean;
  selectionStart: { x: number; y: number } | null;
  selectionMoved: boolean;
  clearSelectionOnMouseUp: boolean;
  startedFromVisibleMargin: boolean;
  pendingMovePoint: { x: number; y: number } | null;
  pendingMoveOrigin: { x: number; y: number } | null;
  pendingLiftSelection: boolean;
  lastDrawCell: { x: number; y: number } | null;
  moveStartPoint: { x: number; y: number } | null;
  moveStartOrigin: { x: number; y: number } | null;
};
