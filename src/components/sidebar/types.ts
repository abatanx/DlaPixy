/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import type { AnimationFrame, PaletteEntry, Selection, TilePreviewLayer } from '../../editor/types';
import type { PaletteUsageEntry } from '../../editor/palette-sync';
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
  paletteUsageByColor: Record<string, PaletteUsageEntry>;
  setHoveredPaletteColor: (value: { hex: string; index: number } | null) => void;
  addPaletteColor: (value: PaletteEntry) => void;
  removeSelectedColorFromPalette: () => void;
  jumpToPaletteUsage: (color: string) => boolean;
  paletteMergeSelection: string[];
  paletteMergeDestinationColor: string | null;
  togglePaletteMergeColor: (color: string) => void;
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
  | 'paletteUsageByColor'
  | 'setHoveredPaletteColor'
  | 'addPaletteColor'
  | 'removeSelectedColorFromPalette'
  | 'jumpToPaletteUsage'
  | 'paletteMergeSelection'
  | 'paletteMergeDestinationColor'
  | 'togglePaletteMergeColor'
  | 'clearPaletteMergeSelection'
  | 'paletteColorModalRequest'
>;
