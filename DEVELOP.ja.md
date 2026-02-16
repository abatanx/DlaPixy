# DEVELOP.ja.md

## 1. プロジェクト概要
- プロジェクト: `PixelEditor`（Electronデスクトップアプリ）
- 目的: macOS/Windows向けのPNGピクセルエディター（パレット、グリッド、選択、Undo、保存/読込、メタ情報埋め込み）
- 現在の状態: コア機能は実装済みで実行可能

## 2. 技術スタック
- Electron + React + TypeScript + Vite
- UI: Bootstrap 5.3
- アイコン: FontAwesome Free（`@fortawesome/fontawesome-free`）
- PNGメタ情報: `png-chunks-extract`, `png-chunks-encode`, `png-chunk-text`

## 3. 実行 / ビルドコマンド
```bash
npm install
npm run dev
npm run build
npm run dist
```

## 4. 実装済み機能
- キャンバスサイズとグリッドを分離
  - キャンバス: 初期 `256x256`（変更可）
  - グリッド線間隔: `8 / 16 / 32`
- ツール
  - 描画（Pencil）
  - 消しゴム（Eraser）
  - 塗りつぶし（Fill）
  - 矩形選択（Select）
- 補間描画
  - 高速ドラッグでも描画/消しゴムが欠けない
- 選択範囲操作
  - コピー
  - 削除
  - 貼り付け
  - Selectツールでドラッグせずクリックした場合、現在のグリッド間隔に沿った1タイルを選択
  - 貼り付け直後のドラッグ移動（Selectツール）
  - 浮動貼り付け/移動の操作: `Enter` で確定、`Esc` でキャンセルして貼り付け前状態に復元
  - 矩形選択したピクセルのドラッグ移動（貼り付け移動と同じ挙動）
- Undo
- PNG保存/読込
- 1x PNGプレビュー
- 選択範囲 3x3 タイルプレビュー（1xプレビュー下）
  - 現在の選択範囲を表示
  - 選択解除後も最終選択範囲を保持して表示継続
  - 編集内容をリアルタイム反映
  - 親ノード幅いっぱいに自動拡大/縮小
- 拡大/縮小
- Space押下中のパン（手ツール挙動）
- 画面全体スクロール禁止（編集領域のみスクロール）
- 右端縦ツールバー（FontAwesome）
- TypeScript/ImageData 互換修正
  - `new ImageData(...)` 前に `slice()` を使い `TS2769` を回避

## 5. ショートカット（現状）
- ツール切替
  - `B`: 描画
  - `E`: 消しゴム
  - `G`: 塗りつぶし
  - `V`: 矩形選択
- ズーム
  - `+`（`Equal`, `NumpadAdd`）: 拡大
  - `-`（`Minus`, `NumpadSubtract`）: 縮小
- 編集
  - `Cmd/Ctrl + Z`: Undo
  - `Cmd/Ctrl + C`: 選択範囲コピー
  - `Cmd/Ctrl + V`: 貼り付け
  - `Enter`: 浮動貼り付け/移動を確定
  - `Esc`: 浮動貼り付け/移動をキャンセルして元に戻す

## 6. PNGメタ情報仕様
PNGの `tEXt` チャンクに、キーワード `pixel-editor-meta` で保存。

```ts
{
  version: number,
  canvasSize?: number,
  gridSpacing?: number,
  grid?: number, // 旧データ互換
  palette: string[],
  lastTool: 'pencil' | 'eraser' | 'fill' | 'select'
}
```

## 7. 主要ファイル
- `src/App.tsx`
  - エディター本体（状態管理、描画、ツール、選択、コピー/貼り付け、ショートカット、右ツールバー）
- `src/styles.css`
  - レイアウト、スクロール制御、ツールバー見た目
- `src/main.tsx`
  - Bootstrap / FontAwesomeのCSS読込
- `electron/main.ts`
  - Electronウィンドウ、IPC、PNG保存/読込、メタ埋め込み
- `electron/preload.ts`
  - `window.pixelApi` ブリッジ
- `electron/types.d.ts`
  - Renderer側 `window.pixelApi` 型定義

## 8. 実装上の重要ポイント
- グリッドは「線間隔」であり、キャンバス解像度ではない。
- 貼り付けは内部クリップボード（`selectionClipboardRef`）を使う。
- 貼り付け直後の移動は `floatingPasteRef` により実現。
- 選択範囲のドラッグ移動も `floatingPasteRef` の同じ経路を再利用
  - 選択範囲ドラッグ開始時に、選択ピクセルを浮動ブロック化して移動
- 浮動貼り付け状態は以下で解除される。
  - キャンバスサイズ変更
  - クリア
  - 選択削除
  - PNG読込
  - Undo
- タイルプレビューは `lastTilePreviewSelection` を保持して、選択解除後も表示可能。
- 塗りつぶしは4近傍の連結同色領域に対して実行。

## 9. 既知の改善候補
- クリップボード連携はハイブリッド
  - 内部ピクセルクリップボード + OS画像クリップボード

## 10. 次セッションの推奨手順
1. まず `DEVELOP.md` と `DEVELOP.ja.md` を読む
2. 次に `src/App.tsx` を読む
3. 大規模改修より、小さい差分で機能追加/修正する
4. メタ情報の互換（`grid` 旧フィールド）を壊さない
5. 右端縦ツールバー + FontAwesome のUIルールを維持する

## 11. ワークスペースメモ
- ルートに `+` という未使用ファイルが存在（`/Users/abatan/Develop/PixelEditor/+`）
  - 実行には不要
  - 削除する場合はユーザー確認を取ること

## 12. GitHubバックログ（2026-02-16作成）
- ラベル運用ルール:
  - このリポジトリのIssueラベルは日本語で統一する
  - 推奨例: `機能追加`, `仕様変更`, `高`, `中`, `低`
- #2 `feat: 貼り付け移動の確定/キャンセル操作を追加（Enter/Esc）`
  - https://github.com/abatanx/DlaPixy/issues/2
- #3 `refactor: クリップボード連携を整理（内部ピクセルとOSクリップボードの責務分離）`
  - https://github.com/abatanx/DlaPixy/issues/3
