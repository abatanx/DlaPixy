/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import type { AnimationFrame, PaletteEntry, Selection, TilePreviewLayer } from '../../editor/types';
import type { PaletteUsageEntry } from '../../editor/palette-sync';
import type { PaletteAutoSortKey, PaletteOrderMode } from '../../editor/palette-order';
import type { TransparentBackgroundMode } from '../../../shared/transparent-background';

export type PaletteColorModalRequest = {
  mode: 'edit' | 'create';
  entry: PaletteEntry;
} | null;

export type TilePreviewLayerSummary = Pick<TilePreviewLayer, 'id' | 'width' | 'height'> & {
  previewDataUrl: string;
};

export type EditorSidebarProps = {
  canvasSize: number;
  transparentBackgroundMode: TransparentBackgroundMode;
  previewDataUrl: string;
  tilePreviewDataUrl: string;
  tilePreviewSelection: Selection;
  selection: Selection;
  tilePreviewLayerCount: number;
  tilePreviewLayers: TilePreviewLayerSummary[];
  tilePreviewBaseSize: { width: number; height: number } | null;
  hasTilePreviewCandidate: boolean;
  clearTilePreviewLayers: () => void;
  reorderTilePreviewLayers: (topFirstLayerIds: string[]) => void;
  removeTilePreviewLayer: (layerId: string) => void;
  tilePreviewFocusSequence: number;
  animationPreviewDataUrl: string;
  animationFrames: AnimationFrame[];
  animationPreviewIndex: number;
  animationPreviewFps: number;
  isAnimationPreviewPlaying: boolean;
  isAnimationPreviewLoop: boolean;
  addAnimationFrame: () => void;
  clearAnimationFrames: () => void;
  selectAnimationFrame: (index: number) => void;
  moveAnimationFrame: (frameId: string, direction: 'up' | 'down') => void;
  removeAnimationFrame: (frameId: string) => void;
  toggleAnimationPreviewPlayback: () => void;
  setAnimationPreviewFps: (fps: number) => void;
  setAnimationPreviewLoop: (value: boolean) => void;
  selectedColor: string;
  setSelectedColor: (value: string) => void;
  applySelectedColorChange: (value: PaletteEntry) => void;
  palette: PaletteEntry[];
  displayPalette: PaletteEntry[];
  paletteUsageByColor: Record<string, PaletteUsageEntry>;
  setHoveredPaletteColor: (value: { id: string } | null) => void;
  addPaletteColor: (value: PaletteEntry) => void;
  removeSelectedColorFromPalette: () => void;
  jumpToPaletteUsage: (color: string) => boolean;
  paletteOrderMode: PaletteOrderMode;
  setPaletteOrderMode: (mode: PaletteOrderMode) => void;
  paletteAutoSortKey: PaletteAutoSortKey;
  setPaletteAutoSortKey: (key: PaletteAutoSortKey) => void;
  canManualPaletteReorder: boolean;
  canApplyDisplayPaletteOrder: boolean;
  reorderPaletteEntries: (sourceId: string, targetId: string, insertAfter: boolean) => boolean;
  applyDisplayPaletteOrder: () => boolean;
  paletteMergeSelection: string[];
  paletteMergeDestinationId: string | null;
  togglePaletteMergeColor: (entry: PaletteEntry) => void;
  clearPaletteMergeSelection: () => void;
  paletteColorModalRequest: PaletteColorModalRequest;
};

export type SidebarPreviewSectionProps = Pick<
  EditorSidebarProps,
  | 'canvasSize'
  | 'transparentBackgroundMode'
  | 'previewDataUrl'
  | 'tilePreviewDataUrl'
  | 'tilePreviewSelection'
  | 'selection'
  | 'tilePreviewLayerCount'
  | 'tilePreviewLayers'
  | 'tilePreviewBaseSize'
  | 'hasTilePreviewCandidate'
  | 'clearTilePreviewLayers'
  | 'reorderTilePreviewLayers'
  | 'removeTilePreviewLayer'
  | 'tilePreviewFocusSequence'
  | 'animationPreviewDataUrl'
  | 'animationFrames'
  | 'animationPreviewIndex'
  | 'animationPreviewFps'
  | 'isAnimationPreviewPlaying'
  | 'isAnimationPreviewLoop'
  | 'addAnimationFrame'
  | 'clearAnimationFrames'
  | 'selectAnimationFrame'
  | 'moveAnimationFrame'
  | 'removeAnimationFrame'
  | 'toggleAnimationPreviewPlayback'
  | 'setAnimationPreviewFps'
  | 'setAnimationPreviewLoop'
>;

export type SidebarPaletteSectionProps = Pick<
  EditorSidebarProps,
  | 'transparentBackgroundMode'
  | 'selectedColor'
  | 'setSelectedColor'
  | 'applySelectedColorChange'
  | 'palette'
  | 'displayPalette'
  | 'paletteUsageByColor'
  | 'setHoveredPaletteColor'
  | 'addPaletteColor'
  | 'removeSelectedColorFromPalette'
  | 'jumpToPaletteUsage'
  | 'paletteOrderMode'
  | 'setPaletteOrderMode'
  | 'paletteAutoSortKey'
  | 'setPaletteAutoSortKey'
  | 'canManualPaletteReorder'
  | 'canApplyDisplayPaletteOrder'
  | 'reorderPaletteEntries'
  | 'applyDisplayPaletteOrder'
  | 'paletteMergeSelection'
  | 'paletteMergeDestinationId'
  | 'togglePaletteMergeColor'
  | 'clearPaletteMergeSelection'
  | 'paletteColorModalRequest'
>;
