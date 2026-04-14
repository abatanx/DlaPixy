# 概要とコマンド

## プロダクト概要
- プロジェクト: `DlaPixy`（Electron デスクトップアプリ）
- 目的: PNG ピクセルエディタを、パレット連携・選択範囲操作・プレビュー・Undo・sidecar メタ情報付きで扱う
- 状態: コア編集フローは実装済みで起動できる

## 技術スタック
- Electron + React + TypeScript + Vite
- UI: Bootstrap 5.3
- アイコン: FontAwesome Free（`@fortawesome/fontawesome-free`）
- PNG 補助: `png-chunks-extract`, `png-chunks-encode`, `png-chunk-text`
- 実行環境をまたぐ契約は `shared/**` に置く

## 実行コマンド
```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run dist
```

メモ:
- `npm run dev` は最初に `build:electron` を走らせる。
- dev では Vite、`electron/**` / `shared/**` の TypeScript watch、Electron 自動再起動が立ち上がる。
- 変更後の最短確認は `npm run typecheck` が基本。

## ショートカット
- ツール切替:
  - `Q`: Select
  - `W`: Pencil
  - `E`: Eraser
  - `P`: Fill
  - 現行の sidecar / runtime 契約では `slice` も editor tool に含まれる
- ズーム:
  - `+D`（`Equal`, `NumpadAdd`, `KeyD`, `BracketRight`, `Period`）: 拡大
  - `-A`（`Minus`, `NumpadSubtract`, `KeyA`, `BracketLeft`, `Comma`）: 縮小
  - `Space + ホイール`: 可能なら現在のカーソル位置基準でズーム
- 編集:
  - `Cmd/Ctrl + Z`: Undo
  - `Cmd/Ctrl + A`: キャンバス全体選択
  - `Cmd/Ctrl + C`: 選択範囲コピー
  - `Cmd/Ctrl + V`: 貼り付け
  - `Delete` / `Backspace`: 選択範囲削除
  - `Cmd/Ctrl + I`: キャンバスサイズ変更モーダル
  - `Cmd/Ctrl + G`: グリッド線間隔変更モーダル
  - `Cmd/Ctrl + R`: 表示倍率モーダル
  - `G`: 現在の選択範囲を Tile Preview に追加
  - `T`: 現在の選択範囲を Animation Preview に追加
  - `Y`: 選択範囲回転モーダル
  - `F`: ホバー中色の参照を追加 / 更新
  - `S`: ホバー中ピクセルを viewport 中央へ寄せる
  - `1..9`: 番号付き参照ラインの色を選択
  - `Enter`: floating 貼り付け / 移動を確定
  - `Esc`: floating 貼り付け / 移動をキャンセル、そうでなければ選択解除
