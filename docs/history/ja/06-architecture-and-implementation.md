# アーキテクチャと実装メモ

## Runtime 分割
- `tsconfig.app.json`: renderer（`src/**`）
- `tsconfig.electron.json`: Electron main / preload（`electron/**`）
- `tsconfig.node.json`: Vite config
- ルート `tsconfig.json`: IDE 向けの solution-style reference
- 実行環境共通の契約は `shared/**` に置く

## 主要ファイル
- `src/App.tsx`
  - エディタ全体の state と高レベル orchestration
- `src/components/EditorCanvasWorkspace.tsx`
  - キャンバス surface、selection overlay、hover 情報、参照ライン、右ツールバー
- `src/components/EditorSidebar.tsx`
  - 左 sidebar の組み立て
- `src/components/EditorModalLayer.tsx`
  - toast と renderer modal 群
- `src/components/EditorStatusFooter.tsx`
  - footer status actions
- `src/components/sidebar/SidebarPreviewSection.tsx`
  - 1x / Tile / Animation Preview
- `src/components/sidebar/SidebarPaletteSection.tsx`
  - パレット grid、並び順、色編集導線
- `src/components/EditorToolbar.tsx`
  - 右ツールバー UI
- `src/components/modals/**`
  - モーダルごとの renderer component と Bootstrap lifecycle hook

## 主な Hooks
- `src/hooks/useDocumentFileActions.ts`
  - open / save / save as、sidecar 往復、dirty 確認
- `src/hooks/useEditorShortcuts.ts`
  - グローバルショートカットとネイティブメニュー配線
- `src/hooks/useCanvasViewport.ts`
  - pan、wheel zoom、zoom anchor、viewport restore
- `src/hooks/useCanvasSettings.ts`
  - canvas / grid / zoom モーダル state と apply
- `src/hooks/useUndoHistory.ts`
  - snapshot と undo フロー
- `src/hooks/useCanvasEditingCore.ts`
  - draw、flood fill、render sync の低レベル処理
- `src/hooks/useSelectionOverlay.ts`
  - overlay 表示判定と style 計算
- `src/hooks/useFloatingPaste.ts`
  - 内部クリップボード貼り付け lifecycle
- `src/hooks/useFloatingInteraction.ts`
  - floating selection の move / resize interaction
- `src/hooks/usePaletteManagement.ts`
  - パレット CRUD、merge、GPL
- `src/hooks/usePaletteOrdering.ts`
  - 表示専用の並び順 state と `displayPalette`
- `src/hooks/useEditorPreviews.ts`
  - 1x / tile / animation preview state
- `src/hooks/usePixelReferences.ts`
  - hover inspector と参照ライン state

## Pure / Shared Helper
- `src/editor/palette-sync.ts`
  - 使用数集計、スウォッチ同期、要約ラベル、ジャンプ先情報
- `src/editor/palette-merge.ts`
  - パレット項目と pixels の pure merge helper
- `src/editor/palette-order.ts`
  - HSV ベースの表示ソート
- `src/editor/kmeans-quantize.ts`
  - 選択範囲抽出と Lab 距離 K-Means helper
- `src/editor/selection-rotate.ts`
  - 選択範囲 block の rotate / flip helper
- `src/editor/preview.ts`
  - 1x / Tile Preview 生成
- `shared/palette.ts`
  - パレット型、正規化、caption 制約、ID 生成
- `shared/sidecar.ts`
  - sidecar schema と editor 契約
- `shared/slice.ts`
  - slice 型、export settings、正規化 helper
- `shared/floating-composite.ts`
  - floating composite mode 契約
- `shared/transparent-background.ts`
  - メニューと renderer で共有する透過背景定義

## 技術メモ
- グリッドは画像解像度ではなく overlay 間隔。
- キャンバスサイズ変更は左上基準。
- パレット import / export のダイアログは Electron main process 側で扱う。
- パレット色選択はブラウザ標準 color picker ではなく renderer モーダルを使う。
- 内部貼り付けは `selectionClipboardRef`、直後のドラッグ移動は `floatingPasteRef` を使う。
- 選択範囲ドラッグ移動も同じ floating paste 経路を再利用する。
- floating preview の画素はメインキャンバスへ描き、overlay はハンドル / ラベル / 制御だけを持つ。
- `new ImageData(...)` 前に `slice()` を使って `TS2769` を避ける。
