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
npm run typecheck
npm run build
npm run dist
```

## 4. 実装済み機能
- 色変換ヘルパーを追加
  - `rgbaToHsva`（`RGBA 0-255` -> `HSVA H:0-360, S/V:0-100, A:0-1`）
  - `hsvaToRgba`（`HSVA` -> `RGBA 0-255`）
- キャンバス下にホバー中ドットの色情報を1行表示で追加
  - `x,y`, `RGBA`, `#RRGGBBAA`, `HSVA`, （可能なら）パレットIndexと対応するキャプションを表示
  - キャンバス外へマウスが出たら表示クリア
- ホバー情報の下に参照ラインを追加
  - キャンバス上のピクセル、または左パレット色にホバー中に `F` で参照追加
  - ホバー中色がパレット登録済みなら、`F` でそのパレット色も選択する
  - 参照ラインも、対応するパレットキャプションがあれば保持して表示する
  - 後から元色を編集した場合も、参照ラインの色 / キャプション / Index は現在のキャンバス / パレット状態へ追従更新する
  - 参照ラインの色スウォッチをダブルクリックすると、色モーダルを開く（登録済みなら編集、未登録なら新規追加）
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
  - キャンバス: 初期 `256x256`（変更はネイティブ `Canvas` メニューのモーダルから）
  - グリッド線間隔: `なし / 8 / 16 / 32 / カスタム`
- 初期パレットは Web Safe Color 216 色を使う
- パレット項目は短いキャプション（最大4文字）を持てて、各スウォッチの下に小さく表示する
  - 既存スウォッチをダブルクリックすると、その色を選択しつつ色編集モーダルを開く
- GPL パレットのインポート / エクスポート
  - ネイティブ `Palette` メニューに `インポート（置換）` / `インポート（追加）` / `エクスポート` を追加
  - `.gpl` を Electron の native dialog 経由で読み込み、置換または追加で適用できる
  - すべて不透明色なら標準 GPL として書き出す
  - alpha を含む場合は Aseprite 互換の `Channels: RGBA` 付き GPL として書き出す
  - GPL の色名は DlaPixy の caption に対応づけ、`Untitled` は import 時に空 caption 扱いにする
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
  - ファイル操作はOS標準の File メニュー中心（新規/開く/保存/別名保存/最近使ったファイル）
  - ダイアログ初期ディレクトリは最終利用ディレクトリを永続利用（無効時はホーム）
  - Recent Files は上限管理・重複排除・存在しないパスの自動除外に対応
- ネイティブ Canvas メニュー
  - `Canvas -> キャンバスサイズ変更...` でモーダルを開く
  - `Canvas -> グリッド線間隔変更...` でモーダルを開く
  - サイドバーの常設キャンバスサイズ / グリッド設定UIは廃止
- フッターステータス表示
  - `キャンバス`, `グリッド線`, `表示倍率`, `現在ファイル` は sidebar ではなく画面下部 footer に表示
  - footer の `キャンバス` / `グリッド線` を押すと既存の変更モーダルを開く
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
  - `F`: ホバー中ピクセルを参照ラインへ追加/更新し、パレット登録色ならその色を選択
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
  palette: Array<{ color: string, caption: string }>,
  lastTool: 'pencil' | 'eraser' | 'fill' | 'select'
}
```

## 7. 主要ファイル
- `src/App.tsx`
  - エディター本体の状態管理と処理オーケストレーション
  - キャンバス操作ハンドラとキーボードショートカット
  - ネイティブ `Palette` メニューの action を受けて GPL パレット import/export を適用する
- `src/components/EditorSidebar.tsx`
  - 左サイドバーのコンテナ。プレビュー部とパレット部を組み立てる
- `src/components/sidebar/SidebarPreviewSection.tsx`
  - 1xプレビューとタイルプレビューを担当するプレビューセクション
- `src/components/sidebar/SidebarPaletteSection.tsx`
  - 色セレクタ起点とパレット一覧を担当するパレットセクション。memo 化して再描画を減らしている
  - パレット一覧はコンパクト表示 + 独立スクロールにして、大量色でも使いやすくしている
- `src/components/sidebar/types.ts`
  - サイドバー各セクションで共有する props 型
- `src/components/EditorToolbar.tsx`
  - 右ツールバーUI（ツール切替、ズーム、Undo、コピー/貼り付け/削除/クリア）
- `src/components/modals/CanvasSizeModal.tsx`
  - キャンバスサイズ変更モーダルのUIと入力検証/適用トリガー
- `src/components/modals/GridSpacingModal.tsx`
  - グリッド線間隔変更モーダルのUI、プリセット/カスタム入力処理
- `src/components/modals/PaletteColorModal.tsx`
  - `#RRGGBB` と別枠 `AA` の HEX入力、および RGBA / HSV で選択色を編集する renderer モーダル
- `src/components/modals/useBootstrapModal.ts`
  - renderer モーダル共通の Bootstrap ライフサイクル hook
- `src/editor/constants.ts`
  - グリッド/キャンバス/ズーム制約、デフォルトパレットなど定数
- `src/editor/types.ts`
  - 共通型定義（`Tool` / `Selection` / `EditorMeta`）
- `src/editor/utils.ts`
  - ピクセル処理・選択処理のユーティリティ
- `shared/palette.ts`
  - 実行環境共通のパレット型と正規化 helper
- `shared/palette-gpl.ts`
  - Electron main process と renderer の前提で共有する GPL parser / serializer
- `src/styles.css`
  - レイアウト、スクロール制御、ツールバー見た目
- `src/main.tsx`
  - Bootstrap / FontAwesomeのCSS読込
- `electron/main.ts`
  - Electronウィンドウ、IPC、PNG保存/読込、メタ埋め込み
  - GPL パレット import/export の native dialog とファイルI/O
- `electron/menu.ts`
  - ネイティブ File/Canvas/Palette メニュー構築とメニューアクション配線
- `electron/preload.ts`
  - `window.pixelApi` ブリッジ
  - GPL パレット import/export IPC を renderer に公開
- `electron/types.d.ts`
  - Renderer側 `window.pixelApi` 型定義

## 8. 実装上の重要ポイント
- グリッドは「線間隔」であり、キャンバス解像度ではない。
- TypeScript の設定は実行環境ごとに分割している。
  - `tsconfig.app.json`: renderer（`src/**`）
  - `tsconfig.node.json`: Vite設定（`vite.config.ts`）
  - `tsconfig.electron.json`: Electron main/preload（`electron/**`）
  - ルート `tsconfig.json` は IDE が project を認識しやすくするための参照用
- 実行環境をまたぐ共通型は `shared/**/*.ts` に置く。
  - 現状の例: `shared/ipc.ts` の `MenuAction`、`shared/palette.ts`、`shared/palette-gpl.ts`
- キャンバスサイズ変更はネイティブ `Canvas` メニューから開く renderer モーダルで行う。
- キャンバスサイズ変更は左上基準で既存ピクセルを保持する。
  - 拡大時: 既存ピクセルを保持し、追加領域は透明で埋める
  - 縮小時: 新しい範囲外のピクセルを切り捨てる
  - サイズ変更時は選択状態 / 浮動貼り付け状態を解除する
- グリッド線間隔変更もネイティブ `Canvas` メニューから開き、カスタム値は `1..canvasSize` の範囲で扱う。
- パレット import/export はネイティブ `Palette` メニューから開き、ダイアログは Electron main process 側で扱う。
- パレット色選択はブラウザ標準の color picker ではなく renderer モーダルで行う。
- パレット色モーダルのプレビューは、変更前の色と現在編集中の色を横並びで表示し、近くに `Delta HSV` 差分を出す。
- パレット項目は `{ color, caption }[]` で保持する。
- パレットキャプションの最大文字数は `src/editor/constants.ts` の `PALETTE_CAPTION_MAX_LENGTH` で管理する。
- 描画色とパレット色は alpha 付き `#RRGGBBAA` も扱え、従来の `#RRGGBB` は読込時に正規化する。
- GPL import は標準 RGB 行と Aseprite 互換の `Channels: RGBA` を受け付ける。
- GPL export は可能なら標準 RGB を使い、alpha があるときだけ Aseprite 互換 RGBA GPL へ切り替える。
- 既存パレット色を編集したときは、キャンバス上の一致ピクセルも新しい色へ置換し、Undo 1 回で戻せる。
- 既存パレット色の編集中に、調整後の色が別のパレット色と重複する場合は `適用` できない。
- パレットグリッド末尾の `+` セルから同じモーダルを追加モードで開き、重複しない新規パレット色を追加できる。
- renderer モーダルは `src/components/modals/**` 配下で、モーダル単位のファイルに分割している。
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
- Undo スナップショットは少なくとも `canvasSize`, `pixels`, `selection`, `palette`, `selectedColor` を保持する。
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
- #33 `fix: キャンバスサイズ変更で編集中の画像が消える`
  - https://github.com/abatanx/DlaPixy/issues/33
