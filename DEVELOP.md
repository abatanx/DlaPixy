# DEVELOP.md

Current-state memo for DlaPixy. Keep this file compact; use `git log` / PR diff for detailed history.

Detailed archive by feature:
- [docs/history/README.md](docs/history/README.md)

## 1. Product Snapshot
- Project: `DlaPixy`
- Type: Electron desktop app for macOS / Windows
- Goal: edit PNG pixel art with palette-aware workflows, selection tools, previews, undo, and sidecar-based editor metadata
- Status: core editor flow is implemented and runnable

## 2. Stack
- Electron + React + TypeScript + Vite
- UI: Bootstrap 5.3 + FontAwesome Free
- Shared runtime code: `shared/**`
- PNG helpers: `png-chunks-extract`, `png-chunks-encode`, `png-chunk-text`

## 3. Commands
```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run dist
```

Notes:
- `npm run dev` builds Electron first, then starts Vite, TypeScript watch for `electron/**` and `shared/**`, and Electron auto-reload.
- Use `npm run typecheck` as the fastest safety check after code changes.

## 4. Feature Snapshot

### 4.1 Canvas Editing
- Tools: Select, Pencil, Eraser, Fill
- Default canvas size: `256x256`
- Grid is independent overlay spacing (`0..canvasSize`, `0` = off)
- Stroke interpolation prevents gaps during fast drag
- Undo supported
- Space-drag pans the stage; Space-wheel zooms around cursor when possible
- Zoom modal supports `1..12`

### 4.2 Selection / Floating Operations
- Rectangular selection, select-all, copy, delete, paste
- The visible stage margin around the canvas also accepts Select drag-start and clear-click behavior via edge-cell clamping
- OS clipboard image paste is supported
- Floating paste / move supports:
  - drag move
  - 8 resize handles
  - nearest-neighbor scaling with fixed aspect ratio
  - `Replace` / `Blend` preview mode
  - `Enter` to commit, `Esc` to cancel
- Selected pixels can be lifted and moved as floating content
- Rotation modal supports wraparound pixel shifting, `90deg` rotate for square selections, and horizontal / vertical flip
- Editing tools respect active selection bounds

### 4.3 Palette / Color Workflows
- Default palette is the 216 web-safe colors
- Palette entries are `{ color, caption, locked }`
- Existing swatches can be edited by double-click
- Usage overlay appears while `Cmd/Ctrl` is held
- Selected swatch can jump to first matching pixel on canvas
- Removing an in-use swatch requires confirmation and clears matching pixels to transparent
- Multi-select merge is supported with inline destination selection
- Locked swatches survive cleanup even when their usage becomes `0`
- GPL import/export:
  - replace all
  - append
  - standard GPL export
  - Aseprite RGBA GPL export
- Selection-only K-Means quantization is available from the native `Palette` menu

### 4.4 Inspector / Preview
- Hover line shows pixel position and color details (`RGBA`, `#RRGGBBAA`, `HSVA`, palette match)
- `F` stores hovered colors into reorderable reference lines
- Reference lines keep palette linkage when source colors later change
- `1..9` selects colors from numbered reference lines
- Sidebar preview area includes:
  - 1x preview
  - Tile Preview (`3x3` repeat of normalized layers)
  - Animation Preview with frame list, FPS, loop, reorder, delete, clear
- 1x preview supports drag-scroll with grab / grabbing cursor
- Preview tab action buttons use the same soft accent-button language as Palette controls
- Preview frames use square corners so pixel content is not clipped by rounded chrome
- Tile Preview layers are registered with the sidebar add button or `G`
- Animation frames are registered with `T`

### 4.5 File / Shell Integration
- Native `File` menu handles New / Open / Save / Save As / Recent Files
- Last-used directory is persisted
- Editor state is stored in sidecar JSON next to the PNG
- Existing PNG metadata chunks are preserved on save, but DlaPixy state is restored only from sidecar JSON
- Invalid sidecar shows warning and falls back to plain PNG load
- Native `Canvas` menu opens canvas-size, grid-spacing, and zoom flows
- Transparent background mode is shared across editor canvas, previews, and modal previews
- Status messages are toast-based; persistent sidebar status row is removed
- Footer shows canvas, grid, zoom, and current file status

## 5. Primary Shortcuts
- Tool switch: `Q` Select, `W` Pencil, `E` Eraser, `P` Fill
- Zoom: `+` / `D` / `]` / `.` to zoom in, `-` / `A` / `[` / `,` to zoom out
- `Cmd/Ctrl + Z`: Undo
- `Cmd/Ctrl + A`: Select all
- `Cmd/Ctrl + C`: Copy selection
- `Cmd/Ctrl + V`: Paste
- `Delete` / `Backspace`: Delete selection
- `Cmd/Ctrl + I`: Canvas size modal
- `Cmd/Ctrl + G`: Grid spacing modal
- `Cmd/Ctrl + R`: Zoom modal
- `G`: Add current selection to Tile Preview
- `T`: Add current selection to Animation Preview
- `Y`: Open selection rotation modal
- `F`: Add / update hovered color reference
- `S`: Center hovered pixel in viewport
- `1..9`: Select reference-line colors
- `Enter`: Commit floating paste / move
- `Esc`: Cancel floating paste / move, otherwise clear selection

## 6. Sidecar Contract
Stored as `<filename>.dla-pixy.json` next to the PNG.

```ts
{
  dlaPixy: {
    schemaVersion: number,
    document: {
      palette: {
        entries: Array<{ color: string; caption: string; locked: boolean }>
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

Rules:
- `foo.png` pairs with `foo.dla-pixy.json`
- only the `dlaPixy` structure is accepted
- missing sidecar => load PNG as standalone image
- invalid sidecar => warning, then standalone PNG load

## 7. Key Files
- `src/App.tsx`
  - root editor orchestration and top-level state wiring
- `src/components/`
  - shell UI, workspace, toolbar, footer, sidebar, renderer modals
- `src/components/sidebar/SidebarPreviewSection.tsx`
  - 1x / Tile / Animation preview UI
- `src/components/sidebar/SidebarPaletteSection.tsx`
  - palette UI, compact swatch list, color-entry access
- `src/hooks/`
  - document actions, shortcuts, viewport, canvas settings, undo, palette flow, previews, floating interactions
- `src/editor/`
  - pure editor-domain helpers such as quantization, palette sync, preview generation, rotate, utilities
- `shared/palette.ts`
  - palette type, normalization, caption-length constraint
- `shared/palette-gpl.ts`
  - GPL parse / serialize shared across runtimes
- `shared/transparent-background.ts`
  - transparent background mode definitions shared by menu and renderer
- `electron/main.ts`
  - Electron window, IPC, PNG + sidecar I/O, native dialogs
- `electron/menu.ts`
  - native File / Canvas / Palette menu wiring
- `electron/preload.ts`
  - `window.pixelApi` bridge for renderer

## 8. Implementation Notes
- Grid means overlay spacing, not canvas resolution.
- Canvas resize keeps existing pixels anchored to top-left.
- Resize clears current selection and floating state.
- New slices and auto slices start with all export variants unchecked; `baseVariant` still defines export size calculations.
- When loading older sidecars that omit `variants`, the resolved `baseVariant` is treated as enabled to preserve legacy export behavior.
- Transparent background mode is app-level UI state, not PNG document metadata.
- Palette caption max length is managed in `shared/palette.ts`.
- TypeScript config is split by runtime:
  - `tsconfig.app.json` for renderer
  - `tsconfig.electron.json` for Electron main / preload
  - `tsconfig.node.json` for Vite config
- Use `shared/**` for cross-runtime types and contracts.

## 9. Quick Verification
```bash
npm run typecheck
npm run build
```

Manual smoke check:
- open a PNG
- edit pixels and palette
- save, close, reopen
- confirm sidecar state restores palette and editor UI state
