# Canvas, Selection, and Viewport

## Current Canvas Behavior
- Default canvas size is `256x256`.
- Grid is independent overlay spacing, not canvas resolution.
- Grid spacing is allowed in range `0..canvasSize`; `0` means no grid.
- Select is the initial active tool.
- Right toolbar layout keeps:
  - Select above drawing tools
  - animation-frame add separated from drawing tools
  - zoom controls at the bottom
- Stroke interpolation prevents skipped pixels during fast Pencil / Eraser drag.
- Fill uses flood-fill over 4-neighbor contiguous same-color pixels.
- Page-level scrolling is disabled; only stage / internal scroll areas move.

## Selection and Floating Operations
- Rectangular selection supports copy, delete, paste, and direct drag-move.
- Clicking empty stage space with Select clears the selection.
- The visible canvas margin also behaves as a clamped edge-cell interaction zone for Select drag-start, drag-extend, and clear-click flows.
- Click without drag in Select picks one tile aligned to current grid spacing.
- Drawing tools respect the current selection bounds.
- Paste accepts both DlaPixy internal clipboard data and OS clipboard images.
- Floating paste / move supports:
  - immediate drag after paste
  - 8 resize handles (`TL / TC / TR / ML / MR / BL / BC / BR`)
  - nearest-neighbor resizing with fixed aspect ratio
  - arrow-key nudge (`1px`)
  - limited out-of-canvas movement while keeping at least `1px` visible
  - clipped preview outside canvas bounds
  - `Enter` finalize and `Esc` cancel
- Finalize clips to canvas bounds and adds missing palette swatches for pasted colors.

## Selection Overlay
- The overlay shows compact labels:
  - width on top / bottom
  - height on left / right
  - `x,y` at top-left
- Overlay chrome may extend into stage padding and is not clipped by the canvas surface.
- The selection frame uses a lightweight marching-ants style.
- While floating state is active, the overlay also shows a `Replace / Blend` segmented toggle below the bottom label.

## Viewport and Zoom
- Zoom-in / zoom-out keeps the pixel under the cursor fixed when the pointer is on canvas.
- If the cursor is outside canvas, zoom keeps the viewport center fixed.
- `Space + drag` gives Photoshop-like hand-pan behavior.
- `Space + wheel` zoom uses accumulated wheel delta so Magic Mouse / trackpad input does not jump too far.
- While `Space` is held, native stage scrolling is suppressed to avoid simultaneous scroll + zoom behavior.
- Zoom modal accepts `1..12` and supports `Enter` / `Esc`.

## Canvas UI Integration
- Native `Canvas` menu opens renderer modals for:
  - canvas size
  - grid spacing
  - zoom
- Footer status row shows `Canvas`, `Grid`, `Zoom`, and `Current File`.
- Clicking footer labels opens the same existing modals.
- macOS-style shortcut notation is shown in footer labels (`⌘I`, `⌘G`, `⌘R`).
- The visible stage margin around the canvas is also the slice-create hotzone in slice mode.
- Floating interaction padding is kept as a separate responsibility from the visible stage margin.

## Important Behavior Notes
- Canvas resize preserves existing pixels with a top-left anchor.
  - expand: keep pixels, fill new area with transparency
  - shrink: crop pixels outside new bounds
- Resize clears current selection and floating state.
- Floating pasted state is also cleared on delete selection, load, and undo.
- Undo snapshots include at least `canvasSize`, `pixels`, `selection`, `palette`, and `selectedColor`.

## Floating Composite History (`#52`)
- Goal:
  - add `replace / blend` switching on the floating overlay
  - apply the same composite mode to internal paste, external clipboard paste, and direct selection move
  - persist the mode in sidecar editor metadata
- Stable decisions:
  - `FloatingCompositeMode = 'replace' | 'blend'`
  - default missing / invalid metadata to `replace`
  - keep `Enter`, `Esc`, move, resize, and undo behavior unchanged
  - recomposite immediately when mode changes
- Blend rule:
  - `replace`: write source RGBA directly
  - `blend`: use source-over compositing, `alpha = 0` leaves destination unchanged, `alpha = 255` becomes full replacement
- Current result:
  - floating mode is stored in sidecar editor metadata
  - overlay toggle is visible whenever floating state exists
  - preview recomposites immediately from the current base pixels and floating block
