# Architecture and Implementation

## Runtime Split
- `tsconfig.app.json`: renderer (`src/**`)
- `tsconfig.electron.json`: Electron main / preload (`electron/**`)
- `tsconfig.node.json`: Vite config
- Root `tsconfig.json`: solution-style reference for IDE discovery
- Shared contracts live in `shared/**`

## Key Files
- `src/App.tsx`
  - main editor state and high-level orchestration
- `src/components/EditorCanvasWorkspace.tsx`
  - canvas surface, selection overlay, hover info, reference lines, right toolbar
- `src/components/EditorSidebar.tsx`
  - left sidebar composition
- `src/components/EditorModalLayer.tsx`
  - toast and renderer modal cluster
- `src/components/EditorStatusFooter.tsx`
  - footer status actions
- `src/components/sidebar/SidebarPreviewSection.tsx`
  - 1x / Tile / Animation Preview UI
- `src/components/sidebar/SidebarPaletteSection.tsx`
  - palette grid, ordering, color-entry access
- `src/components/EditorToolbar.tsx`
  - right toolbar UI
- `src/components/modals/**`
  - per-modal renderer components and shared Bootstrap modal lifecycle hook

## Major Hooks
- `src/hooks/useDocumentFileActions.ts`
  - open / save / save as, sidecar round-trip, dirty confirmation
- `src/hooks/useEditorShortcuts.ts`
  - global keyboard shortcuts and native menu wiring
- `src/hooks/useCanvasViewport.ts`
  - pan, wheel zoom, zoom anchor, viewport restore
- `src/hooks/useCanvasSettings.ts`
  - canvas / grid / zoom modal state and apply actions
- `src/hooks/useUndoHistory.ts`
  - snapshot and undo flow
- `src/hooks/useCanvasEditingCore.ts`
  - low-level draw, flood fill, render sync
- `src/hooks/useSelectionOverlay.ts`
  - overlay visibility and style calculation
- `src/hooks/useFloatingPaste.ts`
  - internal clipboard paste lifecycle
- `src/hooks/useFloatingInteraction.ts`
  - move / resize interaction for floating selection
- `src/hooks/usePaletteManagement.ts`
  - palette CRUD, merge, GPL flow
- `src/hooks/usePaletteOrdering.ts`
  - display-only palette order state and derived `displayPalette`
- `src/hooks/useEditorPreviews.ts`
  - 1x / tile / animation preview state
- `src/hooks/usePixelReferences.ts`
  - hover inspector and reference-line state

## Pure / Shared Helpers
- `src/editor/palette-sync.ts`
  - usage scan, swatch sync, summarized labels, jump target data
- `src/editor/palette-merge.ts`
  - pure merge helper for palette entries and pixels
- `src/editor/palette-order.ts`
  - HSV-based palette display sorting
- `src/editor/kmeans-quantize.ts`
  - selection extraction and Lab-distance K-Means helpers
- `src/editor/selection-rotate.ts`
  - rotate / flip helpers for selected blocks
- `src/editor/preview.ts`
  - 1x and Tile Preview image generation
- `shared/palette.ts`
  - palette types, normalization, caption limits, ID generation
- `shared/sidecar.ts`
  - sidecar schema and editor contract
- `shared/slice.ts`
  - slice types, export settings, normalization helpers
- `shared/floating-composite.ts`
  - floating composite mode contract
- `shared/transparent-background.ts`
  - transparent background definitions shared by menu and renderer

## Technical Notes
- Grid is overlay spacing, not image resolution.
- Canvas resize is top-left anchored.
- Palette import / export uses Electron main-process dialogs.
- Palette color selection intentionally uses renderer modals instead of the browser color picker.
- Internal paste uses `selectionClipboardRef`; immediate drag-reposition uses `floatingPasteRef`.
- Direct selection drag-move reuses the same floating-paste path.
- Floating preview pixels are rendered on the main canvas; overlay chrome only provides handles / labels / controls.
- `slice()` is used before `new ImageData(...)` to avoid `ArrayBufferLike` overload mismatch (`TS2769`).
