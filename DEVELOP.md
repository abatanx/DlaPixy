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
- Palette entries can store a short caption (up to 4 characters), shown under each swatch
  - Double-clicking an existing palette swatch selects it and opens the color edit modal
- Palette entries now also carry a `locked` flag
  - Lock / unlock is controlled from the palette color modal
  - GPL import defaults imported entries to unlocked
- Swatch panel usage overlay
  - While `Ctrl/Cmd` is held, each swatch shows current canvas usage count as an overlaid summarized label
  - Clicking a swatch during that overlay mode scrolls the canvas to the first matching pixel (`for y` then `for x`) and sets a `1x1` selection there
  - Removing a swatch that is still used opens a confirmation modal; confirming clears all matching canvas pixels to transparent before removing the swatch
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
  - Sidecar JSON keeps palette data plus editor UI state (`gridSpacing`, `transparentBackgroundMode`, `zoom`, viewport scroll, `lastTool`)
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
  - Wires sidebar, canvas workspace, modal state, and editor domain callbacks
- `src/components/EditorCanvasWorkspace.tsx`
  - Main canvas card UI including canvas surface, selection overlay, hover info, reference lines, and right toolbar
  - Keeps the central editor layout readable without moving core editing logic out of `App.tsx`
- `src/components/EditorSidebar.tsx`
  - Left sidebar container that composes preview and palette sections
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
- Palette caption max length is managed by `PALETTE_CAPTION_MAX_LENGTH` in `src/editor/constants.ts`.
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
- Floating paste preview is rendered on a stage overlay:
  - The overlay can extend slightly outside the canvas for interaction, but the visible preview is clipped by the canvas surface
  - The committed pixel write still goes through clipped `blitBlockOnCanvas` compositing
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
- #42 `refactor: スウォッチ整理処理を共通化する`
  - https://github.com/abatanx/DlaPixy/issues/42
- #46 `feat: パレットの並び替えと削除を追加する`
  - https://github.com/abatanx/DlaPixy/issues/46
- #47 `feat: パレット色統合機能を追加する`
  - https://github.com/abatanx/DlaPixy/issues/47
- #48 `release: App Store 登録とサブスク関連ロジックを整備する`
  - https://github.com/abatanx/DlaPixy/issues/48
- #49 `feat: OSSライセンス表示画面を追加する`
  - https://github.com/abatanx/DlaPixy/issues/49
- #50 `feat: 貼り付け時に拡大縮小して配置できるようにする`
  - https://github.com/abatanx/DlaPixy/issues/50
- #51 `feat: アルファ付き画像貼り付け時のブレンド仕様を追加する`
  - https://github.com/abatanx/DlaPixy/issues/51
- #52 `update: PNGメタ保存から外部JSON管理へ移行する`
  - https://github.com/abatanx/DlaPixy/issues/52

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
  - Clicking a swatch while the usage-count overlay is visible should auto-move the canvas viewport to the center of a pixel using that swatch color and set a `1x1` rectangular selection there.
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
