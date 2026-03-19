import type { PaletteEntry, Selection } from '../../editor/types';

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
  selectedColor: string;
  setSelectedColor: (value: string) => void;
  applySelectedColorChange: (value: PaletteEntry) => void;
  palette: PaletteEntry[];
  setHoveredPaletteColor: (value: { hex: string; index: number } | null) => void;
  addPaletteColor: (value: PaletteEntry) => void;
  removeSelectedColorFromPalette: () => void;
  paletteColorModalRequest: PaletteColorModalRequest;
};

export type SidebarPreviewSectionProps = Pick<
  EditorSidebarProps,
  'canvasSize' | 'previewDataUrl' | 'selectionTilePreviewDataUrl' | 'tilePreviewSelection' | 'selection'
>;

export type SidebarPaletteSectionProps = Pick<
  EditorSidebarProps,
  | 'selectedColor'
  | 'setSelectedColor'
  | 'applySelectedColorChange'
  | 'palette'
  | 'setHoveredPaletteColor'
  | 'addPaletteColor'
  | 'removeSelectedColorFromPalette'
  | 'paletteColorModalRequest'
>;
