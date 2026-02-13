# DEVELOP.md

## 1. Project Summary
- Project: `PixelEditor` (Electron desktop app)
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
  - After paste: pasted block is draggable immediately (with Select tool)
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

## 6. PNG Metadata Contract
Stored in PNG `tEXt` chunk keyword: `pixel-editor-meta`.

Current metadata shape:
```ts
{
  version: number,
  canvasSize?: number,
  gridSpacing?: number,
  grid?: number, // legacy compatibility
  palette: string[],
  lastTool: 'pencil' | 'eraser' | 'fill' | 'select'
}
```

## 7. Key File Map
- `src/App.tsx`
  - Main editor state and behavior
  - Canvas render, tools, selection, copy/paste, shortcuts, right toolbar
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
- Paste finalize/cancel UX can be improved:
  - e.g. `Enter` to finalize, `Esc` to cancel.
- Clipboard integration is hybrid:
  - Internal pixel clipboard for precise paste behavior
  - OS image clipboard write is also performed

## 10. Notes for Next Codex Session
1. Read this file first, then inspect `src/App.tsx`.
2. Avoid rewriting full editor flow; prefer small, isolated diffs.
3. Preserve metadata backward compatibility (`grid` legacy field).
4. Keep UI consistency with right-side vertical toolbar and FontAwesome icon language.

## 11. Local Workspace Note
- There is a stray root file named `+` in workspace (`/Users/abatan/Develop/PixelEditor/+`).
  - It is not used by app runtime.
  - Remove only if user confirms.
