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
npm run build
npm run dist
```

## 4. Implemented Features
- Color conversion helpers:
  - `rgbaToHsva` (`RGBA 0-255` -> `HSVA H:0-360, S/V:0-100, A:0-1`)
  - `hsvaToRgba` (`HSVA` -> `RGBA 0-255`)
- Hovered pixel color details in a single line below canvas:
  - Displays `x,y`, `RGBA`, `#RRGGBBAA`, `HSVA`, and optional palette index
  - Clears display when pointer leaves canvas
- Reference color line below hover info:
  - Press `F` while hovering canvas pixel or left palette color to append reference
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
  - Canvas: default `256x256` (user can change)
  - Grid overlay spacing: `8 / 16 / 32`
- Tools:
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
  - Click (without drag) with Select tool chooses one tile aligned to current grid spacing
  - Selection is cleared only when clicking outside the selected area with Select tool; other tool operations keep selection
  - When selection is active, Pencil/Eraser/Fill/Clear are constrained to selected pixels only
  - After paste: pasted block is draggable immediately (with Select tool)
  - Floating paste/move controls: `Enter` to finalize, `Esc` to cancel and restore pre-paste state
  - Selected pixels are draggable directly (same behavior as pasted floating block)
- Undo
- Save/Load PNG
- 1x PNG preview panel
- Selection 3x3 tile preview panel (under 1x preview)
  - Uses current selection, or keeps showing last selection when selection is cleared
  - Real-time updates while editing pixels
  - Auto-fit to parent width (responsive scale)
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
  - `Cmd/Ctrl + C`: Copy selection
  - `Cmd/Ctrl + V`: Paste selection
  - `F`: Add/update hovered pixel in reference line
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
  palette: string[],
  lastTool: 'pencil' | 'eraser' | 'fill' | 'select'
}
```

## 7. Key File Map
- `src/App.tsx`
  - Main editor state and behavior orchestration
  - Canvas interaction handlers and keyboard shortcuts
- `src/components/EditorSidebar.tsx`
  - Left panel UI (preview, canvas/grid settings, palette, save/load, status)
- `src/components/EditorToolbar.tsx`
  - Right toolbar UI (tool switch, zoom, undo, copy/paste/delete/clear)
- `src/editor/constants.ts`
  - Editor constants (grid/canvas/zoom limits, default palette)
- `src/editor/types.ts`
  - Shared editor types (`Tool`, `Selection`, `EditorMeta`)
- `src/editor/utils.ts`
  - Pixel/selection utility functions used by `App.tsx`
- `src/styles.css`
  - Layout, non-page-scroll, canvas stage, toolbar styling
- `src/main.tsx`
  - Bootstrap + FontAwesome CSS import
- `electron/main.ts`
  - Electron window, IPC, PNG save/load, metadata embedding
- `electron/preload.ts`
  - `window.pixelApi` bridge
- `electron/types.d.ts`
  - Renderer typings for `window.pixelApi`

## 8. Important Implementation Notes
- Grid is **overlay spacing**, not canvas resolution.
- Paste uses an internal clipboard (`selectionClipboardRef`) and floating pasted state (`floatingPasteRef`) for immediate drag-reposition.
- Selection drag-move also reuses `floatingPasteRef` flow:
  - On drag start from selection, selected pixels are captured as floating block and moved with same path as paste.
- Floating pasted state is cleared on destructive/reset flows:
  - canvas resize, clear, delete selection, load, undo.
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
