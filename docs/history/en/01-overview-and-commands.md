# Overview and Commands

## Product Snapshot
- Project: `DlaPixy` (Electron desktop app)
- Goal: PNG pixel editor for macOS / Windows with palette-aware editing, selection tools, previews, undo, and sidecar-based editor metadata
- Status: core editor flow is implemented and runnable

## Stack / Runtime
- Electron + React + TypeScript + Vite
- UI: Bootstrap 5.3
- Icons: FontAwesome Free (`@fortawesome/fontawesome-free`)
- PNG metadata helpers: `png-chunks-extract`, `png-chunks-encode`, `png-chunk-text`
- Cross-runtime contracts live in `shared/**`

## Commands
```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run dist
```

Notes:
- `npm run dev` runs `build:electron` first.
- Dev mode starts Vite, TypeScript watch for `electron/**` and `shared/**`, and Electron auto-reload.
- `npm run typecheck` is the quickest post-change safety check.

## Shortcut Reference
- Tool switch:
  - `Q`: Select
  - `W`: Pencil
  - `E`: Eraser
  - `P`: Fill
  - `slice` is also a supported editor tool in current sidecar / runtime contracts
- Zoom:
  - `+D` (`Equal`, `NumpadAdd`, `KeyD`, `BracketRight`, `Period`): zoom in
  - `-A` (`Minus`, `NumpadSubtract`, `KeyA`, `BracketLeft`, `Comma`): zoom out
  - `Space + wheel`: zoom around current canvas cursor when possible
- Edit:
  - `Cmd/Ctrl + Z`: Undo
  - `Cmd/Ctrl + A`: Select entire canvas
  - `Cmd/Ctrl + C`: Copy selection
  - `Cmd/Ctrl + V`: Paste selection
  - `Delete` / `Backspace`: Delete current selection
  - `Cmd/Ctrl + I`: Open canvas size modal
  - `Cmd/Ctrl + G`: Open grid spacing modal
  - `Cmd/Ctrl + R`: Open zoom modal
  - `G`: Add current selection to Tile Preview
  - `T`: Add current selection to Animation Preview
  - `Y`: Open selection rotation modal
  - `F`: Add / update hovered color reference
  - `S`: Center hovered pixel in viewport
  - `1..9`: Select numbered reference-line colors
  - `Enter`: Finalize floating paste / move
  - `Esc`: Cancel floating paste / move, otherwise clear selection
