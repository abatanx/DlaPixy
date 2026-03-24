import type { AnimationFrame, PaletteEntry, Selection } from '../../editor/types';
import type { PaletteUsageEntry } from '../../editor/palette-sync';

export type PaletteColorModalRequest = {
  mode: 'edit' | 'create';
  entry: PaletteEntry;
} | null;

export type EditorSidebarProps = {
  canvasSize: number;
  previewDataUrl: string;
  selectionTilePreviewDataUrl: string;
  tilePreviewSelection: Selection;
  selection: Selection;
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
  paletteColorModalRequest: PaletteColorModalRequest;
};

export type SidebarPreviewSectionProps = Pick<
  EditorSidebarProps,
  | 'canvasSize'
  | 'previewDataUrl'
  | 'selectionTilePreviewDataUrl'
  | 'tilePreviewSelection'
  | 'selection'
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
  | 'selectedColor'
  | 'setSelectedColor'
  | 'applySelectedColorChange'
  | 'palette'
  | 'paletteUsageByColor'
  | 'setHoveredPaletteColor'
  | 'addPaletteColor'
  | 'removeSelectedColorFromPalette'
  | 'jumpToPaletteUsage'
  | 'paletteColorModalRequest'
>;
