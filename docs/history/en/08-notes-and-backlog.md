# Notes and Backlog

## Known UX / Tech Debt
- Clipboard integration is still hybrid:
  - internal pixel clipboard for precise paste behavior
  - OS image clipboard write is also performed

## Notes for Next Codex Session
1. Read `DEVELOP.md` and `DEVELOP.ja.md` first.
2. Inspect `src/App.tsx` early; if touching UI blocks, also check `src/components/EditorSidebar.tsx` and `src/components/EditorToolbar.tsx`.
3. Prefer small isolated diffs over full editor-flow rewrites.
4. Keep metadata schema aligned with current `EditorMeta` / sidecar definitions.
5. Preserve the right-side vertical toolbar and FontAwesome UI language.
6. Keep the common copyright header on repository-managed `.ts`, `.tsx`, and `.css` files.

## Local Workspace Note
- There is a stray root file named `+` in the workspace.
  - path: `/Users/abatan/Develop/DlaPixy/+`
  - not used by app runtime
  - remove only with explicit user confirmation

## GitHub Backlog Snapshot
- Label policy:
  - use Japanese labels for GitHub issues in this repository
  - preferred examples: `機能追加`, `仕様変更`, `高`, `中`, `低`
- Open design / implementation notes recorded here:
  - `#2` paste finalize / cancel operations
  - `#3` clipboard responsibility split
  - `#33` canvas resize image disappearance
  - `#38` slices and export
  - `#42` palette sync commonization
  - `#46` palette order modes
  - `#47` multi-swatch merge UI
  - `#48` App Store / subscription work
  - `#49` OSS license screen
  - `#50` scalable paste placement
  - `#51` move metadata from PNG chunks to sidecar JSON
  - `#52` floating composite mode
  - `#56` stable palette entry IDs
