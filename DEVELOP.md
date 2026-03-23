# DEVELOP.md

## 1. Project Summary
- Project: `DlaPixy` (Electron desktop app)
- Goal: PNG pixel editor for macOS/Windows with palette, grid, selection, undo, save/load, metadata embedding.
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
- Palette entries can store a short caption (up to 4 characters), shown under each swatch
  - Double-clicking an existing palette swatch selects it and opens the color edit modal
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
  - Paste selection
  - With Select tool active, clicking empty space in `canvas-stage` clears the current selection
  - Click (without drag) with Select tool chooses one tile aligned to current grid spacing
  - Selection is cleared only when clicking outside the selected area with Select tool; other tool operations keep selection
  - When selection is active, Pencil/Eraser/Fill/Clear are constrained to selected pixels only
  - After paste: pasted block is draggable immediately (with Select tool)
  - Floating paste/move controls: `Enter` to finalize, `Esc` to cancel and restore pre-paste state
  - Selected pixels are draggable directly (same behavior as pasted floating block)
- Undo
- Save/Load PNG
  - File operations are now centered in native File menu (`New / Open / Save / Save As / Recent Files`)
  - Last-used directory is persisted and reused as dialog initial directory (fallback: home directory)
  - Recent files are capped, deduplicated, and missing paths are removed on selection
- Native Canvas menu
  - `Canvas -> Change Canvas Size...` opens modal dialog in renderer
  - `Cmd/Ctrl + I` also opens the canvas size modal
  - The canvas size modal supports `Esc` to cancel
  - `Canvas -> Change Grid Spacing...` opens modal dialog in renderer
  - `Cmd/Ctrl + G` also opens the grid spacing modal
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
- 1x PNG preview panel
  - Large previews stay scrollable instead of shrinking to fit
- Selection 3x3 tile preview panel (under 1x preview)
  - Uses current selection, or keeps showing last selection when selection is cleared
  - Real-time updates while editing pixels
  - Auto-fit to parent width (responsive scale)
  - Preview area is displayed in a square (`1:1`) viewport
- Animation preview panel (under Tiling)
  - `A` or the right toolbar button adds the current selection as an animation frame
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
  - `B`: Pencil
  - `E`: Eraser
  - `G`: Fill
  - `V`: Select
- Zoom:
  - `+` (`Equal`, `NumpadAdd`): Zoom in
  - `-` (`Minus`, `NumpadSubtract`): Zoom out
- Edit:
  - `Cmd/Ctrl + Z`: Undo
  - `Cmd/Ctrl + A`: Select entire canvas
  - `Cmd/Ctrl + C`: Copy selection
  - `Cmd/Ctrl + V`: Paste selection
  - `Cmd/Ctrl + I`: Open canvas size modal
  - `Cmd/Ctrl + G`: Open grid spacing modal
  - `Cmd/Ctrl + R`: Open zoom modal
  - `A`: Add current selection to animation preview frames
  - `F`: Add/update hovered pixel in reference line, and select matching palette color if present
  - `1..9`: Select color from numbered reference line
  - `Enter`: Finalize floating paste/move
  - `Esc`: Cancel floating paste/move (if active), otherwise clear current selection

## 6. PNG Metadata Contract
Stored in PNG `tEXt` chunk keyword: `dla-pixy-meta`.

Current metadata shape:
```ts
{
  version: number,
  canvasSize?: number,
  gridSpacing?: number,
  palette: Array<{ color: string, caption: string }>,
  lastTool: 'pencil' | 'eraser' | 'fill' | 'select'
}
```

## 7. Key File Map
- `src/App.tsx`
  - Main editor state and behavior orchestration
  - Canvas interaction handlers and keyboard shortcuts
  - Handles native `Palette` menu actions and applies GPL palette import/export results
- `src/components/EditorSidebar.tsx`
  - Left sidebar container that composes preview and palette sections
- `src/components/sidebar/SidebarPreviewSection.tsx`
  - Preview section for 1x preview, tiling preview, and animation preview
  - These three preview blocks are switched by Bootstrap-style tabs
- `src/components/sidebar/SidebarPaletteSection.tsx`
  - Palette section for color selector trigger and palette grid; memoized to reduce rerenders during canvas edits
  - Palette grid is compact + independently scrollable so large palettes (hundreds of colors) stay usable
- `src/components/sidebar/types.ts`
  - Shared prop types for sidebar sections
- `src/components/EditorToolbar.tsx`
  - Right toolbar UI (tool switch, animation frame add, zoom, undo, copy/paste/delete/clear)
- `src/components/modals/CanvasSizeModal.tsx`
  - Canvas size modal UI and validation/apply trigger
- `src/components/modals/GridSpacingModal.tsx`
  - Grid spacing modal UI with single numeric input (`0` = none, `Enter` to apply, `Esc` to cancel)
- `src/components/modals/ZoomModal.tsx`
  - Zoom modal UI with single numeric input (`1..12`, `Enter` to apply, `Esc` to cancel)
- `src/components/modals/KMeansQuantizeModal.tsx`
  - Selection-only K-Means quantize modal with target color count input and before/after previews
- `src/components/modals/PaletteColorModal.tsx`
  - Selected color editor modal with `#RRGGBB` + separate `AA` hex input, plus RGBA + HSV controls
- `src/components/modals/useBootstrapModal.ts`
  - Shared Bootstrap modal lifecycle hook for renderer modals
- `src/editor/constants.ts`
  - Editor constants (grid/canvas/zoom limits, default palette)
- `src/editor/kmeans-quantize.ts`
  - Selection extraction + Lab-distance K-Means quantization helpers
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
- `src/styles.css`
  - Layout, non-page-scroll, canvas stage, toolbar styling
- `src/main.tsx`
  - Bootstrap + FontAwesome CSS import
- `electron/main.ts`
  - Electron window, IPC, PNG save/load, metadata embedding
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
- Palette import/export is opened from native `Palette` menu and uses Electron main-process dialogs.
- Selection quantization is triggered from native `Palette -> K-Meansで減色する...`, but the input UI lives in a renderer modal.
- Palette color selection is edited in a renderer modal instead of the native browser color picker.
- The palette color modal preview shows both the original color and the current editing color side by side, with a nearby `Delta HSV` diff.
- Palette entries are stored as `{ color, caption }[]`.
- Palette caption max length is managed by `PALETTE_CAPTION_MAX_LENGTH` in `src/editor/constants.ts`.
- Selected drawing color and palette entries can carry alpha (`#RRGGBBAA`), while legacy `#RRGGBB` values are normalized on load.
- K-Means quantization currently uses RGB->Lab distance for clustering and keeps each pixel's original alpha unchanged.
- GPL import accepts standard RGB lines and Aseprite-style `Channels: RGBA` lines.
- GPL export is split into explicit menu actions:
  - `Export (Standard GPL)`: 3-channel GPL only; rejects palettes that contain alpha
  - `Export (Aseprite RGBA GPL)`: always writes Aseprite-compatible `Channels: RGBA`
- Editing an existing palette color also replaces matching pixels on the canvas with the new color in one undoable operation.
- While editing an existing palette color, Apply is disabled if the adjusted color already exists elsewhere in the palette.
- The last cell in the palette grid is a `+` action that opens the same modal in create mode and adds a new unique palette color.
- Renderer modals are split into per-modal component files under `src/components/modals/**`.
- Paste uses an internal clipboard (`selectionClipboardRef`) and floating pasted state (`floatingPasteRef`) for immediate drag-reposition.
- Selection drag-move also reuses `floatingPasteRef` flow:
  - On drag start from selection, selected pixels are captured as floating block and moved with same path as paste.
- Floating pasted state is cleared on destructive/reset flows:
  - canvas resize, clear, delete selection, load, undo.
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
