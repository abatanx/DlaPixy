# Preview, Reference, and Animation

## Hover Inspector
- A single line below the canvas shows hovered pixel details:
  - `x,y`
  - `RGBA`
  - `#RRGGBBAA`
  - `HSVA`
  - optional palette index and matching caption
- The hover line clears when the pointer leaves the canvas.

## Reference Lines
- Press `F` while hovering a canvas pixel or palette swatch to append a reference line.
- If the hovered color already exists in the palette, `F` also selects that palette color.
- Reference lines keep palette linkage and update when the source color later changes.
- Repeating `F` at the same coordinate:
  - ignores if the color is unchanged
  - overwrites if the color changed
- Lines are reorderable with drag-and-drop.
- Numbering rules:
  - top-to-bottom `1..9`
  - lines after 9 show `-`
- `1..9` on main row or numpad selects the matching reference color.
- Double-clicking a reference swatch opens the palette modal.
- Each data field has a small copy button.
- Layout stays within viewport height; the canvas stage shrinks vertically as needed.

## 1x Preview
- Large previews stay scrollable instead of shrinking to fit.
- Preview frames use square corners so the visible pixel area is not clipped by rounded borders.

## Tile Preview
- Lives below the 1x preview.
- Uses current selection, or keeps the last valid selection after selection is cleared.
- Updates in real time while pixels change.
- Auto-fits to parent width and renders in a square viewport.
- The sidebar exposes an add button with visible `G` shortcut guidance.
- `G` registers the current selection as a preview-only stack entry.
- The first registered entry defines the base size for the stack.
- Later entries are clipped or transparent-padded to that base size before compositing.
- Registered entries:
  - stay linked to original canvas rectangles
  - update live as pixels change
  - can be reordered by drag-and-drop
  - can be individually removed
  - can all be cleared without touching canvas pixels or undo history
- Output is shown as a `3x3` repeated composite preview.

## Animation Preview
- Lives under Tile Preview.
- `T` or the right toolbar button adds the current selection as a frame.
- Adding a frame switches the sidebar to the `Animation Preview` tab.
- Controls include:
  - play / stop
  - FPS
  - loop toggle
  - clear all
  - delete
  - move up / down
- Controls use compact icon-first Bootstrap buttons.
- The preview viewport is square (`1:1`).

## Sidebar Layout
- `SidebarPreviewSection` and `SidebarPaletteSection` render as separate cards.
- Preview content uses Bootstrap-style tabs for:
  - Preview
  - Tiling
  - Animation Preview
- Nested card-like chrome inside preview content is intentionally flattened.
