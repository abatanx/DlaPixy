# Slice and Export

## Current Slice Model
- `selection` remains the temporary editing target.
- `slice` is persistent rectangular metadata intended for asset export workflows.
- Current base shape:
  - `EditorSlice = { id, name, x, y, w, h, exportSettings? }`
- `slice` is part of sidecar document metadata.
- `lastTool` supports `slice` in the current sidecar contract.

## Current Scope
- Slice mode exists as a dedicated editor tool.
- Slice overlays are meant to behave as persistent canvas metadata rather than temporary selection.
- Slice export settings are persisted in sidecar metadata.
- `Canvas > Slice > Auto Slice...`
  - opens a renderer modal with `slice name / W / H`
  - replaces the current slice set with a fixed grid
  - ignores right / bottom remainder areas that do not fit
  - generates names as `{sliceName}-{index}` with minimum fixed zero-padding
  - clears `selectedSliceIds` and keeps the first generated slice active
- `Canvas > Slice > Save...`
  - chooses an output directory
  - exports selected slices when any are selected, otherwise all slices
  - crops each slice rect from the renderer canvas
  - scales with nearest-neighbor
  - sends PNG payloads to Electron main for directory export

## Export Settings
- `exportSettings` are stored per slice, not as a global profile library.
- Current target groups:
  - `generic`
  - `apple`
  - `android`
- Generic / Apple variants are fixed to:
  - `1x`
  - `@2x`
  - `@3x`
  - `@4x`
- Android variants are fixed to:
  - `ldpi`
  - `mdpi`
  - `hdpi`
  - `xhdpi`
  - `xxhdpi`
  - `xxxhdpi`
- Android directory templates may use `{density}` placeholders such as `drawable-{density}`.
- If base export size is still mirroring the slice axis size, resizing the slice keeps that base size synchronized.

## Export Validation
- Reject empty slice names.
- Reject duplicate slice names within the export scope (case-insensitive).
- Reject forbidden filename characters in `slice.name`.
- Reject exports when a slice has no checked variants.
- Reject duplicate resolved relative output paths.
- Reject invalid relative paths such as absolute paths or `.` / `..` traversal in export directories.

## Design Notes and Deferred Scope (`#38`)
- Intended direction:
  - Unity / iOS / Android asset export support
  - persistent slice list plus canvas overlay
  - multi-selection, duplicate, copy / paste, nudging, and resize handles
  - slice-specific export settings without a global preset library
- Explicitly deferred from the original first-version proposal:
  - auto slices as a separate slice type
  - atlas / spritesheet auto layout
  - Fireworks-style HTML / URL / alt metadata
  - selection-driven slice creation as the core model

## Implementation Memo (2026-04-13)
- `EditorSlice` now optionally carries `exportSettings`.
- Sidecar save / load persists `document.slices[*].exportSettings`.
- Existing sidecars without export settings still load by normalizing missing values to defaults.
- Slice sidebar export controls now edit slice state directly instead of keeping renderer-only temporary state.
- As a result, undo / save / load / duplicate / paste preserve export settings.
