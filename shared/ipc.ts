export type MenuAction =
  | { type: 'open' }
  | { type: 'save' }
  | { type: 'save-as' }
  | { type: 'open-recent'; filePath: string }
  | { type: 'canvas-size' }
  | { type: 'grid-spacing' }
  | { type: 'palette-import-replace' }
  | { type: 'palette-import-append' }
  | { type: 'palette-export' };
