# File I/O, Sidecar, and Shell

## File Workflow
- Native `File` menu owns:
  - New
  - Open
  - Save
  - Save As
  - Recent Files
- Last-used directory is persisted and reused as the initial dialog directory.
- Recent files are capped, deduplicated, and missing paths are removed when selected.
- Opening `foo.png` attempts to load `foo.dla-pixy.json` from the same directory.
- Missing sidecar loads the PNG as a plain standalone image.
- Invalid sidecar shows a warning and falls back to plain PNG load.
- Existing PNG metadata chunks are preserved on save.
- DlaPixy editor state is restored only from sidecar JSON, not from PNG chunks.

## Sidecar Contract
Stored next to the PNG as `<filename>.dla-pixy.json`.

Current shape:
```ts
{
  dlaPixy: {
    schemaVersion: 2,
    document: {
      palette: {
        entries: PaletteEntry[]
      },
      slices: EditorSlice[]
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
      lastTool: 'pencil' | 'eraser' | 'fill' | 'select' | 'slice'
    }
  }
}
```

Rules:
- `PaletteEntry` now requires stable UUID-format `id`.
- `EditorSlice` stores persistent slice rectangles and optional export settings.
- Older sidecar formats are treated as invalid.

## Menu and Renderer Responsibilities
- Native `Canvas` menu handles canvas size, grid spacing, transparent background, zoom, slice commands, and slice export entry points.
- Native `Palette` menu handles GPL import / export and K-Means entry points.
- Renderer modals own the actual input UI for canvas, grid, zoom, K-Means, palette editing, and slice flows.

## Transparent Background and Shell UI
- Transparent background modes:
  - `white-check`
  - `black-check`
  - `white`
  - `black`
  - `magenta`
- The chosen mode is mirrored between native menu and renderer state.
- The mode affects:
  - main editor canvas
  - sidebar previews
  - renderer modal previews
- It is part of sidecar editor metadata, but not part of PNG metadata itself.
- Status messages use toast notifications instead of a permanent sidebar status row.
- Footer status row replaces the old sidebar status area.
