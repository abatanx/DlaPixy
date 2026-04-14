# DEVELOP.ja.md

`DlaPixy` の現行仕様メモだよ。詳細な変更履歴は `git log` / PR diff に任せて、このファイルは短く保つ。

詳細版アーカイブ:
- [docs/history/README.ja.md](docs/history/README.ja.md)

## 1. プロダクト概要
- プロジェクト: `DlaPixy`
- 種別: macOS / Windows 向け Electron デスクトップアプリ
- 目的: PNG ピクセルアートを、パレット連携・選択範囲操作・プレビュー・Undo・sidecar メタ情報付きで編集する
- 状態: コア編集フローは実装済みで起動できる

## 2. 技術スタック
- Electron + React + TypeScript + Vite
- UI: Bootstrap 5.3 + FontAwesome Free
- 実行環境共有コード: `shared/**`
- PNG 補助ライブラリ: `png-chunks-extract`, `png-chunks-encode`, `png-chunk-text`

## 3. 実行コマンド
```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run dist
```

メモ:
- `npm run dev` は Electron のビルド後に、Vite・`electron/**` / `shared/**` の watch・Electron 自動再起動をまとめて起動する。
- 変更後の最短確認は `npm run typecheck` が基本。

## 4. 機能サマリ

### 4.1 キャンバス編集
- ツール: Select / Pencil / Eraser / Fill
- 既定キャンバスサイズ: `256x256`
- グリッドはキャンバス解像度ではなくオーバーレイ間隔 (`0..canvasSize`, `0` はなし)
- 高速ドラッグでも補間して描画欠けを防ぐ
- Undo 対応
- `Space + ドラッグ` でパン、`Space + ホイール` でズーム
- 表示倍率モーダルは `1..12`

### 4.2 選択範囲 / Floating 操作
- 矩形選択、全選択、コピー、削除、貼り付け
- キャンバス周辺の見えている stage 余白でも、端セルへ clamp した Select のドラッグ開始とクリック解除を扱える
- OS クリップボード画像の貼り付けに対応
- floating 貼り付け / 移動では以下を扱える
  - ドラッグ移動
  - 8 ハンドルでリサイズ
  - nearest-neighbor 拡大縮小
  - `置換 / ブレンド` のプレビュー切替
  - `Enter` で確定、`Esc` でキャンセル
- 選択済みピクセルをそのまま floating として移動できる
- 回転モーダルでは循環移動、正方形限定の `90deg` 回転、水平 / 垂直フリップが使える
- 描画系ツールは選択範囲内だけに制限される

### 4.3 パレット / 色操作
- 初期パレットは Web Safe Color 216 色
- パレット項目は `{ color, caption, locked }`
- 既存スウォッチはダブルクリックで編集できる
- `Cmd/Ctrl` 押下中だけ使用数オーバーレイを表示
- 選択中スウォッチから、最初の一致ピクセルへジャンプできる
- 使用中スウォッチ削除時は確認し、一致ピクセルを透明化してから削除する
- 複数スウォッチのインライン統合に対応
- `locked` スウォッチは使用数 `0` でも自動整理で消さない
- GPL の import / export に対応
  - 全置換
  - 追加
  - 標準 GPL 出力
  - Aseprite RGBA GPL 出力
- ネイティブ `Palette` メニューから、選択範囲専用 K-Means 減色を起動できる

### 4.4 インスペクタ / プレビュー
- ホバー行で `座標 / RGBA / #RRGGBBAA / HSVA / パレット一致` を表示
- `F` でホバー中色を参照ラインへ追加できる
- 参照ラインは並び替えでき、元色変更にも追従する
- `1..9` で番号付き参照ラインの色を選択できる
- サイドバーのプレビューは以下の 3 つ
  - 1x Preview
  - Tile Preview（正規化した重ねを `3x3` 反復）
  - Animation Preview（フレーム一覧、FPS、ループ、並び替え、削除、全消去）
- 1x Preview は grab / grabbing カーソルでドラッグスクロールできる
- Preview タブ群の操作ボタンは Palette コントロールと同系統の淡いアクセント表現でそろえる
- プレビュー枠は角丸をやめ、ピクセル表示が見切れない直角フレームにそろえている
- Tile Preview への登録はサイドバー追加ボタンまたは `G`
- Animation Preview への登録は `T`

### 4.5 ファイル / シェル連携
- ネイティブ `File` メニューで New / Open / Save / Save As / Recent Files を扱う
- 最終利用ディレクトリを保持する
- 編集状態は PNG の隣に sidecar JSON として保存する
- PNG 保存時は既存メタ情報チャンクを保持するが、DlaPixy の復元は sidecar JSON のみを見る
- sidecar が壊れていると警告して、PNG 単体読込へフォールバックする
- ネイティブ `Canvas` メニューからキャンバスサイズ / グリッド間隔 / 表示倍率系を開く
- OSS ライセンスダイアログは app/help メニューから開き、生成済み JSON マニフェストを表示元にする
- Slice の export target は、有効 variant があるときだけタブ・一覧中央・canvas 上のラベル下にプラットフォームマークを出す
- Slice export のサイズ行には出力倍率も表示し、`100%` 超の拡大は赤で強調する
- Slice export の `File(s)` プレビューは、アクティブなタブだけでなく全ターゲット分の想定出力をまとめて表示する
- 透過背景モードは編集キャンバス、各種プレビュー、モーダルプレビューで共通利用する
- 状態表示は toast ベースで、常設の sidebar 状態欄はない
- footer に canvas / grid / zoom / current file を表示する

## 5. 主要ショートカット
- ツール切替: `Q` Select, `W` Pencil, `E` Eraser, `P` Fill
- ズーム: `+` / `D` / `]` / `.` で拡大、`-` / `A` / `[` / `,` で縮小
- `Cmd/Ctrl + Z`: Undo
- `Cmd/Ctrl + A`: 全選択
- `Cmd/Ctrl + C`: 選択範囲コピー
- `Cmd/Ctrl + V`: 貼り付け
- `Delete` / `Backspace`: 選択範囲削除
- `Cmd/Ctrl + I`: キャンバスサイズ変更モーダル
- `Cmd/Ctrl + G`: グリッド間隔変更モーダル
- `Cmd/Ctrl + R`: 表示倍率モーダル
- `G`: 現在の選択範囲を Tile Preview に追加
- `T`: 現在の選択範囲を Animation Preview に追加
- `Y`: 選択範囲回転モーダル
- `F`: ホバー中色を参照ラインへ追加 / 更新
- `S`: ホバー中ピクセルを画面中央へ寄せる
- `1..9`: 参照ラインの色を選択
- `Enter`: floating 貼り付け / 移動を確定
- `Esc`: floating をキャンセル、そうでなければ選択解除

## 6. Sidecar 仕様
PNG の隣に `<filename>.dla-pixy.json` として保存する。

```ts
{
  dlaPixy: {
    schemaVersion: number,
    document: {
      palette: {
        entries: Array<{ color: string; caption: string; locked: boolean }>
      }
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
      lastTool: 'pencil' | 'eraser' | 'fill' | 'select'
    }
  }
}
```

ルール:
- `foo.png` に対する sidecar は `foo.dla-pixy.json`
- 読み込むのは `dlaPixy` 構造のみ
- sidecar が無ければ PNG 単体として開く
- sidecar が壊れていれば警告後に PNG 単体として開く

## 7. 主要ファイル
- `src/App.tsx`
  - エディタ本体のオーケストレーションと top-level state
- `src/components/`
  - shell UI、ワークスペース、ツールバー、footer、sidebar、renderer modal 群
- `src/components/sidebar/SidebarPreviewSection.tsx`
  - 1x / Tile / Animation Preview の UI
- `src/components/sidebar/SidebarPaletteSection.tsx`
  - パレット UI、コンパクトスウォッチ一覧、色編集導線
- `src/hooks/`
  - document actions、shortcuts、viewport、canvas settings、undo、palette、preview、floating interaction
- `src/editor/`
  - 減色、パレット同期、プレビュー生成、回転、各種 pure helper
- `shared/palette.ts`
  - パレット型、正規化、caption 長制約
- `shared/palette-gpl.ts`
  - GPL parser / serializer の共有実装
- `shared/transparent-background.ts`
  - メニューと renderer 共通の透過背景モード定義
- `electron/main.ts`
  - Electron ウィンドウ、IPC、PNG + sidecar I/O、ネイティブダイアログ
- `electron/menu.ts`
  - ネイティブ File / Canvas / Palette メニュー配線
- `scripts/generate-oss-licenses.cjs`
  - ライセンスダイアログ用の OSS マニフェスト JSON を生成する
- `electron/preload.ts`
  - renderer 向け `window.pixelApi` ブリッジ

## 8. 実装メモ
- グリッドは「線間隔」であって、キャンバス解像度ではない。
- キャンバスサイズ変更は左上基準で既存ピクセルを保持する。
- サイズ変更時は選択状態と floating 状態を解除する。
- 新規 slice / 自動 slice の export variant は全未選択で始まるが、`baseVariant` 自体は export サイズ計算の基準として持つ。
- `variants` を持たない古い sidecar を読むときは、従来挙動維持のため resolved 後の `baseVariant` を有効扱いにする。
- 透過背景モードはアプリ UI 状態であり、PNG メタ情報ではない。
- パレット caption 最大長は `shared/palette.ts` で管理する。
- TypeScript 設定は実行環境ごとに分割している。
  - `tsconfig.app.json`: renderer
  - `tsconfig.electron.json`: Electron main / preload
  - `tsconfig.node.json`: Vite config
- 実行環境をまたぐ契約は `shared/**` に置く。

## 9. 確認コマンド
```bash
npm run typecheck
npm run build
```

手動スモークチェック:
- PNG を開く
- ピクセル編集とパレット編集を行う
- 保存して閉じる
- 再読込して、パレットと UI 状態が sidecar から戻ることを確認する
