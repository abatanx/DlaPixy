# DEVELOP.md

## 1. Project Summary
- Project: `DlaPixy` (Electron desktop app)
- Goal: PNG pixel editor for macOS/Windows with palette, grid, selection, undo, save/load, and sidecar-based editor metadata.
- Current status: Core editor functions are implemented and runnable.

## 2. Stack / Runtime
- Electron + React + TypeScript + Vite
- UI: Bootstrap 5.3
- Icons: FontAwesome Free (`@fortawesome/fontawesome-free`)
- PNG metadata: `png-chunks-extract`, `png-chunks-encode`, `png-chunk-text`

## 3. Run / Build Commands
```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run dist
```

- `npm run dev` runs `build:electron` first, then starts:
  - Vite dev server
  - `tsc -w` for `electron/**` and `shared/**`
  - Electron auto-restart when `dist-electron/**` changes

## 4. Implemented Features
- Color conversion helpers:
  - `rgbaToHsva` (`RGBA 0-255` -> `HSVA H:0-360, S/V:0-100, A:0-1`)
  - `hsvaToRgba` (`HSVA` -> `RGBA 0-255`)
- Hovered pixel color details in a single line below canvas:
  - Displays `x,y`, `RGBA`, `#RRGGBBAA`, `HSVA`, optional palette index, and matching palette caption
  - Clears display when pointer leaves canvas
- Reference color line below hover info:
  - Press `F` while hovering canvas pixel or left palette color to append reference
  - If the hovered color already exists in the palette, `F` also selects that palette color
  - Reference lines also keep and display the matching palette caption when available
  - Reference line color/caption/index stay synced with current canvas/palette state when the source color is edited later
  - Double-clicking a reference swatch opens the palette color modal (edit if registered, create if not)
  - Repeated `F` at same coordinate ignores if same color, overwrites if color changed
  - Reference lines are reorderable with drag-and-drop
  - Lines are auto-numbered from top (`1..9`), and lines after 9 show `-`
  - `1..9` (top row/numpad) select the color of corresponding numbered reference line
  - Layout is constrained to viewport height; as reference lines increase, canvas stage shrinks vertically
  - Each data field in every reference line has its own small copy button
- `setStatusText` messages are shown as toast notifications:
  - Auto-hide after ~3 seconds
  - Type-aware border color (`success`/`warning`/`error`/`info`)
  - Sidebar fixed status row removed
- Canvas size is independent from grid:
  - Canvas: default `256x256` (change from native `Canvas` menu modal)
  - Grid overlay spacing: numeric input `0..canvasSize` (`0` = none)
- Initial palette uses the 216 Web Safe Colors
- Palette entries can store a caption (up to 100 characters), shown under each swatch
  - Double-clicking an existing palette swatch selects it and opens the color edit modal
- Palette entries now also carry a `locked` flag
  - Lock / unlock is controlled from the palette color modal
  - GPL import defaults imported entries to unlocked
- Swatch panel usage overlay
  - While `Ctrl/Cmd` is held, each swatch shows current canvas usage count as an overlaid summarized label
  - The selected swatch has a dedicated jump button that scrolls the canvas to the first matching pixel (`for y` then `for x`) and sets a `1x1` selection there
  - Removing a swatch that is still used opens a confirmation modal; confirming clears all matching canvas pixels to transparent before removing the swatch
- Palette colors can be merged inline from the swatch panel
  - `Cmd/Ctrl + click` toggles multi-selection on palette swatches
  - If one swatch is already selected normally, the first `Cmd/Ctrl + click` seeds the merge selection with both that selected swatch and the clicked swatch
  - When 2 or more swatches are selected, a Bootstrap-style merge bar appears above the workspace canvas column without pushing the swatch grid down
  - If merge selection falls back below 2 swatches, the inline merge state is cleared and the palette returns to normal single-selection behavior
  - The merge bar lets the user choose which selected swatch remains as the destination color
  - The current destination swatch is also marked with a `残` badge inside the workspace merge bar
  - Each selected swatch chip in the workspace merge bar has its own `×` button to remove it from merge selection
  - The merge bar also has a `Delete` action that removes all selected swatches with the same clear-if-used behavior as the palette trash button
  - Adding another merge source swatch does not move the current destination; the destination changes only when the user explicitly picks another one in the merge bar
  - Applying the merge replaces matching canvas pixels and removes the other selected swatches in one undoable operation
  - Selected swatches that are `locked` stay in the palette even if their usage becomes `0px` after merge
- Palette sync behavior is now driven by shared helper logic
  - K-Means sync uses reusable `removeUnusedColors` / `addUsedColors` options
  - PNG load merges metadata palette entries with actually used canvas colors
- GPL palette import/export
  - Native `Palette` menu includes `Import (GPL / Replace All)`, `Import (GPL / Append)`, `Export (Standard GPL)`, and `Export (Aseprite RGBA GPL)`
  - Imports `.gpl` via Electron native dialog and applies palette as replace/append
  - `Export (Standard GPL)` writes 3-channel GPL and rejects palettes that contain alpha
  - `Export (Aseprite RGBA GPL)` always writes Aseprite-compatible `Channels: RGBA` GPL
  - GPL color names map to DlaPixy captions; `Untitled` is treated as empty caption on import
- Selection-only K-Means quantization
  - Native `Palette -> K-Meansで減色する...` opens a renderer modal
  - Quantization targets only the current rectangular selection
  - Modal previews before/after and accepts target color count
  - Before/after previews share the same zoom level and synchronized scroll position
  - The preview panes keep scrollbars visible instead of auto-hiding
  - Uses Lab-distance K-Means while preserving original alpha
  - After apply, palette swatches are synchronized to actual canvas usage in the same undo step
- Tools:
  - Select is the initial active tool on startup
  - Select is placed at the top of the right toolbar, separated from drawing tools
  - The animation-frame add button is also separated from drawing tools with its own toolbar separator
  - Zoom controls are placed at the bottom of the right toolbar
  - Pencil
  - Eraser
  - Fill (flood fill)
  - Rectangular selection
- Stroke interpolation:
  - Fast mouse drag does not skip pixels for Pencil/Eraser
- Selection operations:
  - Copy selection
  - Delete selection
  - Paste DlaPixy internal copied selection or OS clipboard image
  - `Y` or the right toolbar button opens a selection rotation modal for the active selection
  - Inside the rotation modal, arrow keys rotate-scroll the preview by `1px` with wraparound
  - The rotation modal also has `90° left / 90° right` buttons, enabled only for square selections
  - The rotation modal also has horizontal / vertical flip buttons, available for rectangular selections too
  - The canvas is updated only when `OK` is pressed; `Cancel` / `Esc` discards the preview changes
  - With Select tool active, clicking empty space in `canvas-stage` clears the current selection
  - Click (without drag) with Select tool chooses one tile aligned to current grid spacing
  - Selection is cleared only when clicking outside the selected area with Select tool; other tool operations keep selection
  - When selection is active, Pencil/Eraser/Fill are constrained to selected pixels only
  - After paste: pasted block is draggable immediately (with Select tool)
  - Floating paste shows 8 resize handles (`TL / TC / TR / ML / MR / BL / BC / BR`)
  - Floating paste resize uses nearest-neighbor scaling and keeps aspect ratio fixed
  - Floating paste/move controls: `Enter` to finalize, `Esc` to cancel and restore pre-paste state
  - Floating paste can also be nudged by keyboard with arrow keys (`1px` per press)
  - Floating paste can be moved slightly outside the canvas while previewing, but at least `1px` remains visible
  - Out-of-canvas floating preview is visually clipped; only the in-canvas portion is shown
  - Finalize clips pasted pixels to the canvas bounds; only the visible in-canvas area is applied
  - Selection overlay shows compact numeric labels outside the rectangle (`w` on top/bottom, `h` on left/right, `x,y` at top-left)
  - Selection overlay UI (frame / handles / labels) can overflow into the stage padding and is not clipped by the canvas surface
  - While floating state is active, the selection overlay shows a segmented `Replace / Blend` toggle below the bottom width label
  - The same floating composite mode applies to internal paste, external clipboard paste, and direct selection move
  - Changing the floating composite mode recomposites the preview immediately without finalizing the floating state
  - Selection frame uses a lightweight animated marching-ants style
  - Finalizing floating paste adds missing palette swatches for pasted colors and does not remove existing swatches
  - Selected pixels are draggable directly (same behavior as pasted floating block)
- Undo
- Save/Load PNG
  - File operations are now centered in native File menu (`New / Open / Save / Save As / Recent Files`)
  - Last-used directory is persisted and reused as dialog initial directory (fallback: home directory)
  - Recent files are capped, deduplicated, and missing paths are removed on selection
  - Editor metadata is stored in a sidecar JSON next to the PNG (`<filename>.dla-pixy.json`)
  - Opening `foo.png` auto-loads `foo.dla-pixy.json` if present; if missing, the PNG is opened standalone
  - If the sidecar JSON exists but is invalid, a warning dialog is shown and the PNG is opened standalone
  - PNG-embedded metadata (including `dla-pixy-meta`) is ignored on load
  - Sidecar JSON keeps palette data plus editor UI state (`floatingCompositeMode`, `gridSpacing`, `transparentBackgroundMode`, `zoom`, viewport scroll, `lastTool`)
  - Saving writes/updates the sidecar JSON and keeps existing PNG metadata chunks intact
- Native Canvas menu
  - `Canvas -> Change Canvas Size...` opens modal dialog in renderer
  - `Cmd/Ctrl + I` also opens the canvas size modal
  - The canvas size modal supports `Esc` to cancel
  - `Canvas -> Change Grid Spacing...` opens modal dialog in renderer
  - `Cmd/Ctrl + G` also opens the grid spacing modal
  - `Canvas -> 透過バックグラウンド` switches the transparent preview background mode
  - Modes: `White Check`, `Black Check`, `White`, `Black`, `Magenta`
  - The chosen mode is mirrored to the native menu from renderer state and is also stored in sidecar editor metadata
  - Sidebar no longer shows persistent canvas size / grid spacing inputs
- Footer status row
  - `Canvas`, `Grid`, `Zoom`, and `Current File` status are shown in the bottom footer instead of the sidebar
  - Tapping/clicking `Canvas`, `Grid`, or `Zoom` in the footer opens the existing change modal
  - The `Canvas` footer label shows the shortcut with the macOS-style `⌘I` notation
  - The `Grid` footer label shows the shortcut with the macOS-style `⌘G` notation
  - The `Zoom` footer label shows the shortcut with the macOS-style `⌘R` notation
- Zoom modal
  - `Cmd/Ctrl + R` opens a renderer modal for explicit zoom input
  - Modal range is `1..12`, with `Enter` to apply and `Esc` to cancel
- Zoom behavior
  - Zoom-in / zoom-out keeps the pixel under the current canvas cursor fixed whenever the pointer is on the canvas
  - If the cursor is outside the canvas, zoom falls back to keeping the current viewport center fixed
  - `Space + wheel` zooms in/out without disabling the existing `Space + drag` pan behavior
  - `Space + wheel` uses accumulated wheel delta with a threshold so high-resolution inputs (Magic Mouse / trackpad) do not jump too many zoom steps
  - While `Space` is held, native stage scrolling is suppressed so Magic Mouse wheel input does not scroll and zoom at the same time
- 1x PNG preview panel
  - Large previews stay scrollable instead of shrinking to fit
- Selection 3x3 tile preview panel (under 1x preview)
  - Uses current selection, or keeps showing last selection when selection is cleared
  - Real-time updates while editing pixels
  - Auto-fit to parent width (responsive scale)
  - Preview area is displayed in a square (`1:1`) viewport
  - `G` registers the current selection as a preview-only stack entry
  - The first registered stack entry defines the base tile size for the preview stack
  - Registered stack entries keep referencing their original canvas rectangles, so pixel edits update the stacked preview in real time
  - While preview stack entries exist, the current selection is shown as an uncommitted top candidate until it is added with `G`
  - Additional selections are clipped or transparent-padded to the first stack size before being composited
  - Tile Preview supports clearing all registered preview stack entries without affecting canvas pixels or undo history
  - Registered preview stack entries are listed under Tile Preview with mini previews, drag-and-drop reorder, and per-entry remove controls
- Animation preview panel (under Tiling)
  - `T` or the right toolbar button adds the current selection as an animation frame
  - When a frame is added, the sidebar automatically switches to the `Animation Preview` tab
  - Sidebar preview supports play/stop, FPS, loop toggle, clear all, delete, and up/down reorder
  - Animation controls are compact, icon-first Bootstrap buttons
  - `Preview / Tiling / Animation Preview` are grouped as Bootstrap-style tabs with short FontAwesome-based labels
  - Preview area is displayed in a square (`1:1`) viewport
- Left sidebar layout
  - `SidebarPreviewSection` and `SidebarPaletteSection` are rendered as separate cards for clearer visual separation
  - The preview card keeps Bootstrap tabs but removes nested card-like chrome inside the section for a flatter look
- Zoom controls
- Space + drag pan behavior (Photoshop-like hand tool)
- Page-level scroll disabled (only stage/internal scroll)
- Right-side vertical toolbar with FontAwesome icons
- TypeScript/ImageData compatibility fix:
  - Use `slice()` before `new ImageData(...)` to avoid `ArrayBufferLike` overload mismatch (`TS2769`)

## 5. Shortcuts (Current)
- Tool switch:
  - `Q`: Select
  - `W`: Pencil
  - `E`: Eraser
  - `P`: Fill
- Zoom:
  - `+D` (`Equal`, `NumpadAdd`, `KeyD`, `BracketRight`, `Period`): Zoom in
  - `-A` (`Minus`, `NumpadSubtract`, `KeyA`, `BracketLeft`, `Comma`): Zoom out
  - `Space + wheel up/down`: Zoom in/out around the current cursor position on canvas
- Edit:
  - `Cmd/Ctrl + Z`: Undo
  - `Cmd/Ctrl + A`: Select entire canvas
  - `Cmd/Ctrl + C`: Copy selection
  - `Cmd/Ctrl + V`: Paste selection
  - `Delete` / `Backspace`: Delete current selection (silently ignored when no selection)
  - `Cmd/Ctrl + I`: Open canvas size modal
  - `Cmd/Ctrl + G`: Open grid spacing modal
  - `Cmd/Ctrl + R`: Open zoom modal
  - `G`: Add the current selection to the Tile Preview layer stack
  - `T`: Add current selection to animation preview frames
  - `Y`: Open selection rotation modal for the current selection
  - `F`: Add/update hovered pixel in reference line, and select matching palette color if present
  - `S`: Center the hovered pixel in the canvas viewport
  - `1..9`: Select color from numbered reference line
  - `Enter`: Finalize floating paste/move
  - `Esc`: Cancel floating paste/move (if active), otherwise clear current selection

## 6. Sidecar JSON Contract
Stored next to the PNG as `<filename>.dla-pixy.json`.

Current metadata shape:
```ts
{
  dlaPixy: {
    schemaVersion: number,
    document: {
      palette: {
        entries: Array<{ color: string, caption: string, locked: boolean }>
      }
    },
    editor: {
      floatingCompositeMode: 'replace' | 'blend',
      gridSpacing: number,
      transparentBackgroundMode: 'white-check' | 'black-check' | 'white' | 'black' | 'magenta',
      zoom: number,
      viewport: {
        scrollLeft: number,
        scrollTop: number
      },
      lastTool: 'pencil' | 'eraser' | 'fill' | 'select'
    }
  }
}
```

- `foo.png` pairs with `foo.dla-pixy.json`
- Only the new `dlaPixy` structure is read; older sidecar formats are treated as invalid
- If the sidecar is missing, the PNG is treated as a plain standalone image
- If the sidecar is invalid, DlaPixy shows a warning dialog and falls back to plain PNG load
- Existing PNG metadata chunks are preserved on save, but are not used as DlaPixy editor state

## 7. Key File Map
- `src/App.tsx`
  - Main editor state and high-level orchestration
  - Wires sidebar, canvas workspace, shell chrome components, and editor domain callbacks
- `src/components/EditorCanvasWorkspace.tsx`
  - Main canvas card UI including canvas surface, selection overlay, hover info, reference lines, and right toolbar
  - Keeps the central editor layout readable without moving core editing logic out of `App.tsx`
- `src/components/EditorSidebar.tsx`
  - Left sidebar container that composes preview and palette sections
- `src/components/EditorModalLayer.tsx`
  - Toast plus renderer modal cluster for canvas/grid/zoom, K-Means, rotation, and palette-removal confirmation
  - Keeps shell-level modal JSX out of `App.tsx` while preserving existing modal wiring
- `src/components/EditorStatusFooter.tsx`
  - Footer status bar for canvas/grid/zoom/file status actions
  - Keeps footer JSX and footer-specific labels out of `App.tsx`
- `src/hooks/useDocumentFileActions.ts`
  - Save / Save As / Open document flow for PNG + sidecar metadata
  - Owns unsaved-confirmation handling and renderer-side PNG decode/apply steps
- `src/hooks/useEditorShortcuts.ts`
  - Global keyboard shortcuts and native menu action wiring
  - Keeps shortcut side effects out of the root JSX/orchestration file
- `src/hooks/useCanvasViewport.ts`
  - Space-key pan, wheel zoom, zoom-anchor restore, and viewport restore hook for the canvas stage
  - Owns viewport-side effects so document load/save and canvas interactions no longer wire them directly in `App.tsx`
- `src/hooks/useCanvasSettings.ts`
  - Canvas size/grid/zoom modal open-close and canvas/grid apply actions
  - Owns canvas-setting side effects so `App.tsx` no longer carries that settings callback cluster
- `src/hooks/useUndoHistory.ts`
  - Undo stack snapshots and undo-apply flow
  - Owns undo history mutation so `App.tsx` no longer carries push/pop snapshot logic directly
- `src/hooks/useCanvasEditingCore.ts`
  - Canvas render sync, floating preview sync, coordinate resolution, stroke, and flood fill primitives
  - Owns low-level canvas editing logic so `App.tsx` no longer carries that render/draw callback cluster
- `src/hooks/useEditorShellUi.ts`
  - Status toast state, toast auto-hide, document title sync, and transparent-background sync
  - Owns root UI side effects so `App.tsx` no longer carries those shell-level UI effects directly
- `src/hooks/useSelectionOverlay.ts`
  - Selection overlay visibility and overlay style calculation
  - Owns overlay presentation math so `App.tsx` no longer carries those layout/style computations directly
- `src/hooks/useFloatingSelectionState.ts`
  - Floating selection refs, clipboard ref, and floating-clear helper
  - Owns floating selection state holders so `App.tsx` no longer carries those bridge refs directly
- `src/hooks/useCanvasPointerInteractions.ts`
  - Pointer event hook for draw/select/fill interactions on the canvas and stage
  - Owns `onMouseDown` / `onMouseMove` / `onMouseUp` orchestration while delegating floating move/resize to dedicated hook
- `src/hooks/useEditorPreviews.ts`
  - Sidebar preview state hook for 1x preview, tile preview, and animation preview
  - Owns preview-derived Data URLs, tile/animation collections, and sidebar preview callbacks outside `App.tsx`
- `src/hooks/usePaletteManagement.ts`
  - Palette edit/remove flow plus GPL import/export handling
  - Owns palette CRUD side effects and removal-confirmation state so `App.tsx` no longer carries that callback cluster
- `src/hooks/useSelectionOperations.ts`
  - Selection delete/select-all/clear plus K-Means and rotation modal request handling
  - Owns selection-oriented editing side effects so `App.tsx` no longer carries that modal/request callback cluster
- `src/hooks/usePixelReferences.ts`
  - Hovered pixel state, reference-line state, palette-hover freeze (`F`), and related drag/copy actions
  - Keeps canvas inspector/reference behavior together so `App.tsx` no longer owns that callback cluster
- `src/hooks/useFloatingPaste.ts`
  - Clipboard-driven paste lifecycle for copy/paste/finalize/cancel/nudge plus lifting a committed selection into floating state
  - Keeps floating-paste side effects and selection-to-floating conversion together outside `App.tsx`
- `src/hooks/useFloatingInteraction.ts`
  - Pointer-driven floating selection move/resize interaction hook
  - Owns resize-handle hit testing and floating overlay drag behavior while reusing `App.tsx` refs/state
- `src/components/sidebar/SidebarPreviewSection.tsx`
  - Preview section for 1x preview, tiling preview, and animation preview
  - These three preview blocks are switched by Bootstrap-style tabs
  - Tile Preview owns the preview-layer add / clear controls, layer list, and summary text
- `src/editor/preview.ts`
  - Generates the 1x / tile preview images
  - Normalizes Tile Preview layers to the first registered size, composites them, then repeats the result in `3x3`
- `src/editor/app-utils.ts`
  - Small shared helpers extracted from `App.tsx` for file-name handling and selected-color resolution
- `src/editor/canvas-pointer.ts`
  - Shared pointer-interaction state type used by canvas pointer hooks and root orchestration
- `src/editor/floating-paste.ts`
  - Shared floating-paste and internal clipboard types used by `App.tsx` and floating-paste hook
- `src/editor/floating-interaction.ts`
  - Shared floating selection resize/move geometry, handle metadata, and overlay styles
- `src/editor/transparent-background.ts`
  - Maps transparent background mode to reusable renderer surface classes
- `src/components/sidebar/SidebarPaletteSection.tsx`
  - Palette section for color selector trigger and palette grid; memoized to reduce rerenders during canvas edits
  - Palette grid is compact + independently scrollable so large palettes (hundreds of colors) stay usable
- `src/components/sidebar/types.ts`
  - Shared prop types for sidebar sections
- `src/components/EditorToolbar.tsx`
  - Right toolbar UI (tool switch, animation frame add, zoom, undo, copy/paste/delete)
- `src/components/modals/CanvasSizeModal.tsx`
  - Canvas size modal UI and validation/apply trigger
- `src/components/modals/GridSpacingModal.tsx`
  - Grid spacing modal UI with single numeric input (`0` = none, `Enter` to apply, `Esc` to cancel)
- `src/components/modals/ZoomModal.tsx`
  - Zoom modal UI with single numeric input (`1..12`, `Enter` to apply, `Esc` to cancel)
- `src/components/modals/KMeansQuantizeModal.tsx`
  - Selection-only K-Means quantize modal with target color count input and before/after previews
- `src/components/modals/SelectionRotateModal.tsx`
  - Selection rotation modal with preview, arrow-key rotation, and `OK` / `Cancel`
- `src/components/modals/PaletteColorModal.tsx`
  - Selected color editor modal with `#RRGGBB` + separate `AA` hex input, plus RGBA + HSV controls
- `src/components/modals/useBootstrapModal.ts`
  - Shared Bootstrap modal lifecycle hook for renderer modals
- `src/editor/constants.ts`
  - Editor constants (grid/canvas/zoom limits, default palette)
- `src/editor/kmeans-quantize.ts`
  - Selection extraction + Lab-distance K-Means quantization helpers
- `src/editor/selection-rotate.ts`
  - Selection block extraction, wraparound rotation, and apply helpers for the rotation modal
- `src/editor/palette-sync.ts`
  - Shared palette usage analysis + swatch synchronization helpers
  - Owns summarized usage labels and first-match jump target selection data
- `src/editor/palette-merge.ts`
  - Pure helper for collapsing multiple palette colors into one destination color across both palette entries and canvas pixels
- `src/editor/preview.ts`
  - Renderer preview helpers for region/block PNG Data URLs
- `src/editor/types.ts`
  - Shared editor types (`Tool`, `Selection`, `EditorMeta`)
- `src/editor/utils.ts`
  - Pixel/selection utility functions used by `App.tsx`
- `shared/palette.ts`
  - Cross-runtime palette type + normalization helpers
- `shared/palette-gpl.ts`
  - GPL parser/serializer shared by Electron main process and renderer expectations
- `shared/transparent-background.ts`
  - Shared transparent background mode/label definitions for Electron menu + renderer
- `src/styles.css`
  - Layout, non-page-scroll, canvas stage, toolbar styling
- `src/main.tsx`
  - Bootstrap + FontAwesome CSS import
- `electron/main.ts`
  - Electron window, IPC, PNG save/load, sidecar JSON read/write
  - Preserves existing PNG metadata chunks while keeping DlaPixy editor state in the sidecar file
  - Native GPL palette import/export dialogs and file I/O
- `electron/menu.ts`
  - Native File/Canvas/Palette menu construction and menu action wiring
- `electron/preload.ts`
  - `window.pixelApi` bridge
  - Exposes GPL palette import/export IPC to renderer
- `electron/types.d.ts`
  - Renderer typings for `window.pixelApi`

## 8. Important Implementation Notes
- Grid is **overlay spacing**, not canvas resolution.
- TypeScript config is split by runtime:
  - `tsconfig.app.json`: renderer (`src/**`)
  - `tsconfig.node.json`: Vite config (`vite.config.ts`)
  - `tsconfig.electron.json`: Electron main/preload (`electron/**`)
  - Root `tsconfig.json` is a solution-style reference entry for IDE project discovery.
- Shared cross-runtime types live in `shared/**/*.ts`.
  - Current examples: `shared/ipc.ts` for `MenuAction`, `shared/palette.ts`, `shared/palette-gpl.ts`
- Canvas size change is opened from native `Canvas` menu and edited in renderer modal.
- Canvas size change preserves existing pixels with a top-left anchor:
  - expand: keep pixels, fill new area with transparency
  - shrink: crop pixels outside the new bounds
  - selection / floating paste are cleared on resize
- Grid spacing change is also opened from native `Canvas` menu; values are allowed in range `0..canvasSize` (`0` = none).
- Transparent background mode is also selected from native `Canvas` menu, persisted in app preferences, and mirrored into renderer state through IPC.
- Transparent background mode applies to the main editor canvas, sidebar `Preview / Tile / Animation Preview`, and renderer modal previews.
- Transparent background mode is not stored in PNG metadata.
- Palette import/export is opened from native `Palette` menu and uses Electron main-process dialogs.
- Selection quantization is triggered from native `Palette -> K-Meansで減色する...`, but the input UI lives in a renderer modal.
- Palette color selection is edited in a renderer modal instead of the native browser color picker.
- The palette color modal preview shows both the original color and the current editing color side by side, with a nearby `Delta HSV` diff.
- Palette entries are stored as `{ color, caption }[]`.
- Palette entries are now stored as `{ color, caption, locked }[]`.
- Palette caption max length is managed by `PALETTE_CAPTION_MAX_LENGTH` in `shared/palette.ts`.
- `src/editor/palette-sync.ts` is the canonical home for:
  - per-color pixel usage scanning
  - swatch sync options (`removeUnusedColors`, `addUsedColors`)
  - summarized usage labels for the palette overlay
- Selected drawing color and palette entries can carry alpha (`#RRGGBBAA`), while legacy `#RRGGBB` values are normalized on load.
- K-Means quantization currently uses RGB->Lab distance for clustering and keeps each pixel's original alpha unchanged.
- PNG load now merges metadata palette entries with used colors detected from the loaded canvas pixels.
- GPL import accepts standard RGB lines and Aseprite-style `Channels: RGBA` lines.
- GPL export is split into explicit menu actions:
  - `Export (Standard GPL)`: 3-channel GPL only; rejects palettes that contain alpha
  - `Export (Aseprite RGBA GPL)`: always writes Aseprite-compatible `Channels: RGBA`
- Editing an existing palette color also replaces matching pixels on the canvas with the new color in one undoable operation.
- While editing an existing palette color, Apply is disabled if the adjusted color already exists elsewhere in the palette.
- The last cell in the palette grid is a `+` action that opens the same modal in create mode and adds a new unique palette color.
- Renderer modals are split into per-modal component files under `src/components/modals/**`.
- Paste uses an internal clipboard (`selectionClipboardRef`) and floating pasted state (`floatingPasteRef`) for immediate drag-reposition.
- Floating paste preview is rendered directly on the main canvas from current composited `pixels`.
  - Selection overlay only provides floating chrome (border, handles, labels, composite toggle)
  - The overlay can extend slightly outside the canvas for interaction, while the actual pixels remain clipped by the canvas surface
- Selection drag-move also reuses `floatingPasteRef` flow:
  - On drag start from selection, selected pixels are captured as floating block and moved with same path as paste.
- Floating pasted state is cleared on destructive/reset flows:
  - canvas resize, delete selection, load, undo.
- Undo snapshots include at least `canvasSize`, `pixels`, `selection`, `palette`, and `selectedColor`.
- Tile preview keeps last valid selection (`lastTilePreviewSelection`) so preview does not disappear when selection is cleared.
- Fill tool uses flood-fill over contiguous same-color pixels (4-neighbor).

## 9. Known UX/Tech Debt (Next Candidates)
- Clipboard integration is hybrid:
  - Internal pixel clipboard for precise paste behavior
  - OS image clipboard write is also performed

## 10. Notes for Next Codex Session
1. Read this file first, then inspect `src/App.tsx`.
2. If touching UI blocks, check `src/components/EditorSidebar.tsx` and `src/components/EditorToolbar.tsx` first.
3. Avoid rewriting full editor flow; prefer small, isolated diffs.
4. Keep metadata schema aligned with current `EditorMeta` definition.
5. Keep UI consistency with right-side vertical toolbar and FontAwesome icon language.
6. Keep the common copyright header at the top of repository-managed `.ts` / `.tsx` / `.css` source files.

## 11. Local Workspace Note
- There is a stray root file named `+` in workspace (`/Users/abatan/Develop/DlaPixy/+`).
  - It is not used by app runtime.
  - Remove only if user confirms.

## 12. GitHub Backlog (Created 2026-02-16)
- Label policy:
  - Use Japanese labels for GitHub issues in this repository.
  - Preferred examples: `機能追加`, `仕様変更`, `高`, `中`, `低`.
- #2 `feat: Paste finalize/cancel operations (Enter/Esc)`
  - https://github.com/abatanx/DlaPixy/issues/2
- #3 `refactor: Clipboard integration responsibility split`
  - https://github.com/abatanx/DlaPixy/issues/3
- #33 `fix: Edited image disappears when changing canvas size`
  - https://github.com/abatanx/DlaPixy/issues/33
- #38 `spec: Unity / iOS / Android 向けスライス機能を整理する`
  - https://github.com/abatanx/DlaPixy/issues/38
- #42 `refactor: スウォッチ整理処理を共通化する`
  - https://github.com/abatanx/DlaPixy/issues/42
- #46 `feat: パレットの並び順モードを追加する（手動並び替え / 自動ソート）`
  - https://github.com/abatanx/DlaPixy/issues/46
- #47 `feat: パレットで複数スウォッチを選択して1色へ統合するUIを追加する`
  - https://github.com/abatanx/DlaPixy/issues/47
- #48 `release: App Store 登録とサブスク関連ロジックを整備する`
  - https://github.com/abatanx/DlaPixy/issues/48
- #49 `feat: OSSライセンス表示画面を追加する`
  - https://github.com/abatanx/DlaPixy/issues/49
- #50 `feat: 貼り付け時に拡大縮小して配置できるようにする`
  - https://github.com/abatanx/DlaPixy/issues/50
- #51 `update: PNGメタ保存から外部JSON管理へ移行し、保存/互換仕様を整理する`
  - https://github.com/abatanx/DlaPixy/issues/51
- #52 `spec: canvas-selection-overlay 上で合成モード（置換 / ブレンド）を切り替え、editor メタへ保存できるようにする`
  - https://github.com/abatanx/DlaPixy/issues/52
- #56 `refactor: パレットスウォッチに安定IDを導入する`
  - https://github.com/abatanx/DlaPixy/issues/56

## 13. Issue #42 Draft Notes (2026-03-24)
- Goal:
  - Extract palette/swatch sync logic from `src/App.tsx` so it can be reused after K-Means, PNG load, and future image transforms.
- Current implementation anchors:
  - `collectUsedColorsFromPixels(pixels)` in `src/App.tsx` collects unique non-transparent `#RRGGBBAA` colors in first-seen order.
  - `buildPaletteFromCanvasPixels(pixels, currentPalette)` in `src/App.tsx` keeps used existing colors, appends newly used colors, preserves captions for surviving entries, and gives new entries empty captions.
  - K-Means apply flow already uses `buildPaletteFromCanvasPixels(...)`.
  - PNG load currently does **not** use the same sync path:
    - if metadata palette exists, it is loaded as-is
    - otherwise detected colors (up to 64) are converted with `createPaletteEntries(...)`
- Drafted behavior to preserve during refactor:
  - Transparent pixels are ignored when building/syncing palette entries.
  - On PNG load, if metadata palette exists, merge the metadata palette with the actual palette derived from canvas pixels.
  - Palette swatches should gain a lock flag.
  - Lock / unlock is controlled from the palette color modal.
  - Each swatch should also expose how many canvas pixels currently use that color.
  - The swatch panel should show that usage count only while `Ctrl/Cmd` is held, as a text overlay on the swatch.
  - The currently selected swatch should expose a dedicated jump action that auto-moves the canvas viewport to the center of a pixel using that swatch color and sets a `1x1` rectangular selection there.
  - If multiple pixels use the same swatch color, the jump target should be the first pixel found by scanning in `for y in 0..` then `for x in 0..` order.
  - The usage count display should be summarized as:
    - `0..999`: show the exact number as-is
    - `1000+`: show an approximate integer value prefixed with `~` and suffixed with `K` / `M` / `G` / `T`
    - Do not use decimal points in summarized labels
    - Examples: `0`, `42`, `999`, `~1K`, `~12K`, `~3M`
  - Surviving existing colors keep their captions and lock state.
  - Newly added colors start with empty caption `''` and unlocked state.
  - Palette order follows current behavior:
    - keep surviving existing entries in their current order
    - append newly detected used colors in canvas first-seen order
  - Whether unused colors are removed and whether newly used colors are added should both follow caller options.
  - Whether unused colors are removed should be configurable by the caller (`remove` / `keep`).
  - When the caller chooses to remove unused colors, a swatch is removed only when both conditions are met:
    - the swatch is not locked
    - the swatch has no caption
  - When the caller chooses not to remove unused colors, unused swatches remain regardless of lock/caption state.
- Backward compatibility for metadata is not required at this time.
- Selected color fallback should stay consistent with current K-Means path:
  - keep current selection if still present
  - otherwise fall back to first palette color when available

## 14. Issue #52 Spec Notes (2026-03-28)
- Goal:
  - Add a `replace / blend` segmented toggle on the floating selection overlay.
  - Apply the same composite mode to all floating operations, including paste and selection move.
  - Persist the chosen floating composite mode in sidecar `editor` metadata.
- Current implementation anchors:
  - `src/hooks/useFloatingPaste.ts`
    - `beginFloatingPaste(...)` starts floating paste from internal/external clipboard.
    - `liftSelectionToFloatingPaste()` reuses the same floating state for direct selection drag/move.
    - `applyFloatingPasteBlock(...)` re-renders the preview via `blitBlockOnCanvas(...)`.
  - `src/editor/utils.ts`
    - `blitBlockOnCanvas(...)` is currently hard-coded replace behavior.
  - `src/components/EditorCanvasWorkspace.tsx`
    - `.canvas-selection-overlay` already renders floating handles and size labels.
  - `shared/sidecar.ts`, `src/hooks/useDocumentFileActions.ts`, `electron/main.ts`
    - editor metadata currently saves/restores `gridSpacing`, `transparentBackgroundMode`, `zoom`, `viewport`, `lastTool`.
- Decisions to keep implementation stable:
  - Introduce `FloatingCompositeMode = 'replace' | 'blend'`.
  - Store `editor.floatingCompositeMode` in sidecar metadata.
  - Default to `replace` when sidecar metadata is missing or invalid.
  - Keep floating preview updates allocation-light:
    - moving without resize should reuse the current resized floating block
    - main canvas draw should reuse a persistent offscreen raster buffer instead of recreating temp canvas / image data each frame
  - Keep `SIDECAR_SCHEMA_VERSION = 1`.
    - Existing sidecars should continue to load by defaulting missing `floatingCompositeMode` to `replace`.
    - Do not force a schema bump for this field addition.
  - Apply the same composite mode to all floating operations:
    - DlaPixy internal copy/paste
    - external image paste from OS clipboard
    - direct selection drag/move via floating state
  - The overlay toggle is visible whenever floating state exists.
  - Floating origin/kind discrimination is not required for this feature.
    - It can still exist for other reasons, but the composite logic should not depend on it.
  - Changing the mode during active floating paste must recomposite immediately from:
    - current `basePixels`
    - current floating rect (`x / y / width / height`)
    - resized `sourcePixels`
  - `Enter` finalize should simply confirm the already-previewed result.
  - `Esc`, move, resize, and undo behavior must stay unchanged.
- Blend rule:
  - `replace`
    - write source RGBA directly to destination
  - `blend`
    - use source-over compositing against destination pixels
    - source alpha `0` leaves destination unchanged
    - source alpha `255` becomes full replacement
- UI / interaction notes:
  - Place the segmented button below the bottom width label on `.canvas-selection-overlay`.
  - Overlay remains overflow-visible and must fit inside current stage padding policy.
  - Button mouse/pointer interaction must not start floating move/resize.
    - Stop propagation/prevent default on the control itself before overlay drag logic sees it.
- Palette sync:
  - Keep using the existing shared sync path on finalize.
  - Required behavior remains:
    - `removeUnusedColors: false`
    - `addUsedColors: true`
  - Newly used colors are added.
  - Existing unused swatches are not removed.
- Suggested implementation split:
  1. Add `FloatingCompositeMode` type and sidecar save/load support.
  2. Replace `blitBlockOnCanvas(...)` with a shared composite helper that accepts mode.
  3. Keep the current floating state flow and thread the active composite mode through it.
  4. Add overlay segmented button and dedicated event guard for control clicks.
  5. Recompute preview immediately when mode changes.
- Verification checklist:
  - Internal clipboard paste previews correctly in both `replace` and `blend`.
  - External clipboard image paste previews correctly in both `replace` and `blend`.
  - Direct selection move previews correctly in both `replace` and `blend`.
  - `alpha = 0` keeps destination pixels unchanged in `blend`.
  - `alpha = 255` matches replace result in `blend`.
  - Clicking the toggle does not start move or resize.
  - Finalized result matches the last previewed mode.
  - Saving writes `editor.floatingCompositeMode` to sidecar and loading restores it.

## 15. Issue #46 Spec Notes (2026-04-06)
- Goal:
  - Add two palette order modes:
    - manual reorder mode that persists through sidecar save/load
    - automatic sort mode used only for on-screen display
  - Let the user switch these modes from a new palette-side tab.
- Prerequisite:
  - Complete `#56 refactor: パレットスウォッチに安定IDを導入する` first.
  - The palette order mode work should assume stable swatch identity is already available.
- Current implementation anchors:
  - `src/components/sidebar/SidebarPaletteSection.tsx`
    - currently renders the palette grid and owns select / edit / add / remove interactions
  - `src/hooks/usePaletteManagement.ts`
    - owns add / edit / remove / merge flows plus undo / dirty / toast updates
  - `shared/sidecar.ts`, `src/hooks/useDocumentFileActions.ts`
    - currently persist `document.palette.entries` and existing editor UI state
  - Existing drag-and-drop examples:
    - `src/hooks/usePixelReferences.ts`
    - `src/components/sidebar/SidebarPreviewSection.tsx`
- Decisions to keep implementation stable:
  - Treat `palette` state as the canonical manual order at all times.
  - Saving always writes the canonical manual order to `document.palette.entries`.
  - Loading restores that manual order.
  - Automatic sort is a derived display-only view and is not saved in sidecar metadata.
  - After `New` / `Open`, the palette order mode returns to manual.
  - The existing palette `+` add button stays fixed and out of manual reorder scope.
  - Manual reorder changes only palette order.
    - Do not change canvas pixels, `caption`, `locked`, or usage values.
  - Keep `selectedColor` selected even when its swatch moves or the display mode changes.
  - Manual reorder is one undoable action and marks the document dirty.
  - View-only mode switches and auto-sort-key changes do not enter undo history.
  - Keep current delete flows:
    - unused colors can be removed immediately
    - used colors require confirmation and clear matching pixels to transparent
    - merge UI keeps its current multi-delete path
  - Disable manual drag-and-drop while palette merge UI is active.
- Display model:
  - Manual mode:
    - `displayPalette === palette`
  - Auto mode:
    - `displayPalette = sortPaletteEntries(palette, autoSortKey)`
  - Existing write paths (add / edit / delete / merge / PNG load / K-Means sync) keep mutating the canonical `palette`.
  - Auto mode only recomputes the displayed order from that canonical palette.
- Identity / index handling:
  - Use `PaletteEntry.id` as the stable swatch identity after `#56`.
  - Avoid treating raw array index as a durable identifier across order modes.
  - Hover / reference UI that needs a palette index should resolve it from the current `displayPalette`, while tracking the swatch itself by `id`.
- Auto-sort keys for the first version:
  - `Hue①`
    - `hue -> saturation -> value`
    - achromatic colors are grouped first
  - `Hue②`
    - `hue -> value -> saturation`
    - achromatic colors are grouped first
  - `Saturation①`
    - `saturation -> value -> hue`
    - achromatic colors are grouped first
  - `Saturation②`
    - `saturation -> hue -> value`
    - achromatic colors are grouped first
  - `Value①`
    - `value -> saturation -> hue`
    - achromatic colors are grouped first
  - `Value②`
    - `value -> hue -> saturation`
    - achromatic colors are grouped first
  - Shared alpha rule for all six auto tabs:
    - fully transparent (`alpha = 0`) swatches are pinned to the top
    - among `alpha > 0` swatches, alpha descending is used as the last sort key
  - Do not add `Red` / `Green` / `Blue` in the first version.
    - `Hue` already covers the main “color family” browsing use case
    - keeping only HSV-based keys keeps the UI smaller and the first release sharper
  - Final tie-breaker after alpha should be the canonical manual order to keep display stable.
- UI direction:
  - Replace the palette card tabs with a Bootstrap dropdown order picker:
    - `Palette`
    - `Hue①`
    - `Hue②`
    - `Saturation①`
    - `Saturation②`
    - `Value①`
    - `Value②`
  - The palette grid stays visible while the dropdown only changes the active order mode.
  - Conceptually:
    - `Palette` == manual mode
    - every other tab == auto mode with the matching sort key
  - In manual mode, enable drag-and-drop reorder on the palette grid.
  - In auto mode, disable drag-and-drop and redraw the grid from the derived sort result.
- Suggested implementation split:
  1. Add non-persistent palette order UI state (`paletteOrderMode`, `paletteAutoSortKey`).
  2. Add a shared `sortPaletteEntries(...)` helper in `src/editor/`.
  3. Update `SidebarPaletteSection` to render tabs and use `displayPalette`.
  4. Add manual DnD reorder handlers for the palette tab.
  5. Replace index-based assumptions in hover / reference palette lookups with `id`-based identity plus display-index resolution.
  6. Verify sidecar round-trip, mode reset on load, and undo scope.
- Verification checklist:
  - Manual drag-and-drop changes palette order and persists through save / reopen.
  - Auto mode rearranges the visible swatches without changing saved order.
  - Saving while auto mode is active still restores manual order after reopen.
  - Switching back to manual shows the last canonical manual order.
  - `selectedColor` survives mode switches and reorder.
  - Hover / reference palette index output matches the current display order.
  - Existing delete behavior remains unchanged.
  - Manual reorder is undoable; mode/key switches are not.
- 2026-04-06 implementation memo:
  - Added `src/editor/palette-order.ts` for HSV-based display sorting (`Hue①` / `Hue②` / `Saturation①` / `Saturation②` / `Value①` / `Value②`).
  - Added `src/hooks/usePaletteOrdering.ts` to own non-persistent UI state:
    - `paletteOrderMode`
    - `paletteAutoSortKey`
    - derived `displayPalette`
  - `SidebarPaletteSection` now uses a Bootstrap dropdown order picker.
    - `Palette` shows the manual order and enables drag-and-drop
    - `Hue①` / `Hue②` / `Saturation①` / `Saturation②` / `Value①` / `Value②` switch to auto mode with the matching sort key
    - the toggle is initialized with `bootstrap/js/dist/dropdown`
    - a `fa-house` button to the right returns directly to `Palette` and stays disabled while `Palette` is active
    - auto preview mode shows an `Apply` button that writes the current `displayPalette` order back into canonical `palette`
    - the palette grid stays visible while the dropdown only changes the active order
    - swatches with `alpha < 255` render a compact `透` badge on the swatch
  - `usePixelReferences.ts` now resolves palette identity by `PaletteEntry.id` but always computes `paletteIndex` from `displayPalette`.
  - `useDocumentFileActions.ts` resets the palette order view mode to manual after `Open`.
  - `EditorPaletteMergeBar` now receives `displayPalette` so merge candidates follow the current visible order.

## 16. Issue #56 Spec Notes (2026-04-06)
- Goal:
  - Introduce stable swatch identity before palette order modes land in `#46`.
- Current implementation anchors:
  - `shared/palette.ts`
    - `PaletteEntry` currently has only `color`, `caption`, `locked`
    - normalization currently deduplicates by `color`
  - `src/components/sidebar/SidebarPaletteSection.tsx`
    - palette interactions still lean on `color` and display index
  - `src/hooks/usePixelReferences.ts`
    - hovered palette state currently stores color plus index
  - `src/hooks/useDocumentFileActions.ts`, `shared/sidecar.ts`
    - sidecar persists palette entries directly
- Decisions to keep implementation stable:
  - Add `id: string` to `PaletteEntry`.
  - `id` is a hyphenated UUID-format string that identifies the swatch entity.
  - Generate it with `crypto.randomUUID()` and avoid adding an extra dependency for ID generation.
  - Validation does not need to enforce UUID version / variant bits strictly.
  - `color` keeps its meaning for pixels / usage / replacement.
  - Generate `id` for every new palette entry source:
    - initial palette
    - manual add
    - palette sync add
    - GPL import
    - PNG / sidecar load construction for the new schema only
  - Backward compatibility for older sidecars is not required.
  - Treat this as a palette-metadata breaking change.
  - It is acceptable to bump `SIDECAR_SCHEMA_VERSION`.
  - If an older sidecar is opened, warning + PNG-only fallback is sufficient.
  - Keep `id` stable across color edits for the same swatch.
  - Keep the current no-duplicate-color assumption.
  - Move UI identity-sensitive flows toward `id`:
    - selection target
    - hover target
    - drag-and-drop target
    - merge selection target
  - Keep color-semantic flows on `color`:
    - usage counts
    - pixel replacement
    - jump to first usage
- Suggested implementation split:
  1. Expand `PaletteEntry` and normalization / clone helpers to include `id`.
  2. Add palette entry ID generation helpers for all creation paths.
  3. Update sidecar read/write to require the new shape.
  4. Replace index-based UI assumptions with `id` plus display-index lookup where needed.
  5. Verify #46 can build on stable swatch identity without extra migration work.
- Verification checklist:
  - Every palette entry in memory has a UUID-format `id`.
  - Saving writes `id` values into sidecar palette entries.
  - Editing a swatch color does not change its `id`.
  - Palette UI flows no longer depend on raw index as durable identity.
- Implementation memo:
  - `SIDECAR_SCHEMA_VERSION` was bumped to `2`, and sidecar palette entries now require UUID-format `id`.
  - Palette hover / reference lines and merge-selection UI now track swatches by `id`, resolving display index only when needed.
  - Color-semantic operations such as usage counts, pixel replacement, delete, and merge execution still resolve through `color`.

## 17. Issue #38 Spec Notes (2026-04-07)
- Goal:
  - Reframe slices in a Fireworks-like way for DlaPixy:
    - not as temporary selection
    - but as persistent rectangular metadata for Unity / iOS / Android asset export
- Proposed meaning split:
  - `selection`
    - temporary editing target
  - `slice`
    - saved rectangular asset definition / export unit
- Proposed first version:
  - support `user slice` only
  - add a dedicated `slice` button to the right toolbar
  - create one slice by dragging directly on the canvas
  - generate multiple slices from a fixed grid over `Canvas`
  - show slices as both canvas overlay and a persistent list
  - render slice overlays as semi-transparent green rectangles
  - allow add / select / move / resize / delete interactions while slice mode is active
  - support slice multi-selection:
    - `Cmd/Ctrl + A` selects all slices
    - `Cmd/Ctrl + click` toggles individual slices into the selection
    - `Cmd/Ctrl + D` duplicates the selected slices
    - `Cmd/Ctrl + C` copies the selected slices
    - `Cmd/Ctrl + V` pastes copied slices
  - clicking a slice can push its rectangle into current selection
  - while slice mode is active, replace the normal left `Preview` / `Palette` cards with a dedicated slice info panel
  - save slices in sidecar metadata from the first version
- Explicitly defer from the first version:
  - auto slices
  - per-slice export settings
  - atlas / spritesheet auto layout
  - Fireworks-style HTML / URL / alt metadata
  - selection-driven slice creation
- Proposed minimal shape:
  - `EditorSlice = { id, name, x, y, w, h }`
- Design direction:
  - treat fixed-grid split as a slice-generation helper, not as the slice model itself
  - store every slice as a `1x` logical base rect
  - keep density / naming expansion in future export profiles
  - target export compatibility such as:
    - generic `name.png`, `name@2x.png`, `name@4x.png`
    - Apple-style `name.png`, `name@2x.png`, `name@3x.png`
    - Android drawable directory variants
  - use a toolbar-driven `slice mode` for canvas interactions
  - switch the left sidebar to a slice-only info panel during slice mode
  - keep modal-based bulk generation for grid creation
  - resize should be direct-manipulation via 8 always-visible handles (`TL / TC / TR / ML / MR / BL / BC / BR`) on the active slice
  - treat slice selection as:
    - `selectedSliceIds` for the full set
    - `activeSliceId` for the last-focused slice
  - allow group move / group delete for multi-selection
  - allow group duplicate / group copy / group paste for multi-selection
  - treat slice copy as metadata copy into an internal slice clipboard
  - pasted slices must receive new `id` values
  - keep resize available only for single selection
  - completely disable `selection`, `Tile Preview`, and `Animation Preview` while slice mode is active
