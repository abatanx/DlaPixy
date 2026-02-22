# DEVELOP.ja.md

## 1. プロジェクト概要
- プロジェクト: `DlaPixy`（Electronデスクトップアプリ）
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
- 色変換ヘルパーを追加
  - `rgbaToHsva`（`RGBA 0-255` -> `HSVA H:0-360, S/V:0-100, A:0-1`）
  - `hsvaToRgba`（`HSVA` -> `RGBA 0-255`）
- キャンバス下にホバー中ドットの色情報を1行表示で追加
  - `x,y`, `RGBA`, `#RRGGBBAA`, `HSVA`, （可能なら）パレットIndexを表示
  - キャンバス外へマウスが出たら表示クリア
- ホバー情報の下に参照ラインを追加
  - キャンバス上のピクセル、または左パレット色にホバー中に `F` で参照追加
  - 同一座標で `F` 連打時は、同色なら無視・色が変わっていれば上書き
  - 参照ラインはドラッグ&ドロップで並び替え可能
  - 表示順で上から `1..9` を自動付番し、10行目以降は `-` 表示
  - `1..9`（メインキー/テンキー）で対応する参照ラインの色を選択可能
  - ビューポート高内にレイアウトを収め、参照行が増えるほどキャンバス表示領域が縦に縮む
  - 参照ラインも各項目ごとに小さなコピーボタンでコピー可能
- `setStatusText` メッセージ表示をToast化
  - 約3秒で自動消去
  - 種別（`success`/`warning`/`error`/`info`）で見た目を区別
  - 左サイドの固定「状態」表示は廃止
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
  - 矩形選択の解除は、Selectツールで選択範囲外をクリックした場合のみ（他ツール操作では選択維持）
  - 選択範囲があるとき、描画/消しゴム/塗りつぶし/クリアは選択範囲内ピクセルのみを処理
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
  - `F`: ホバー中ピクセルを参照ラインへ追加/更新
  - `1..9`: 番号付き参照ラインの色を選択
  - `Enter`: 浮動貼り付け/移動を確定
  - `Esc`: 浮動貼り付け/移動中はキャンセル、それ以外は選択範囲を解除

## 6. PNGメタ情報仕様
PNGの `tEXt` チャンクに、キーワード `dla-pixy-meta` で保存。

```ts
{
  version: number,
  canvasSize?: number,
  gridSpacing?: number,
  palette: string[],
  lastTool: 'pencil' | 'eraser' | 'fill' | 'select'
}
```

## 7. 主要ファイル
- `src/App.tsx`
  - エディター本体の状態管理と処理オーケストレーション
  - キャンバス操作ハンドラとキーボードショートカット
- `src/components/EditorSidebar.tsx`
  - 左サイドパネルUI（プレビュー、設定、パレット、保存/読込、状態表示）
- `src/components/EditorToolbar.tsx`
  - 右ツールバーUI（ツール切替、ズーム、Undo、コピー/貼り付け/削除/クリア）
- `src/editor/constants.ts`
  - グリッド/キャンバス/ズーム制約、デフォルトパレットなど定数
- `src/editor/types.ts`
  - 共通型定義（`Tool` / `Selection` / `EditorMeta`）
- `src/editor/utils.ts`
  - ピクセル処理・選択処理のユーティリティ
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
2. 次に `src/App.tsx`、UI変更時は `src/components/EditorSidebar.tsx` と `src/components/EditorToolbar.tsx` を読む
3. 大規模改修より、小さい差分で機能追加/修正する
4. メタ情報のスキーマは `EditorMeta` 定義に合わせる
5. 右端縦ツールバー + FontAwesome のUIルールを維持する

## 11. ワークスペースメモ
- ルートに `+` という未使用ファイルが存在（`/Users/abatan/Develop/DlaPixy/+`）
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
