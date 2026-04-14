# Slice と Export

## 現在の Slice モデル
- `selection` は一時的な編集対象のまま。
- `slice` は export 向けの永続矩形メタデータとして扱う。
- 基本 shape:
  - `EditorSlice = { id, name, x, y, w, h, exportSettings? }`
- `slice` は sidecar の document メタに入る。
- 現在の sidecar 契約では `lastTool` に `slice` が含まれる。

## 現在のスコープ
- slice mode は専用 editor tool として存在する。
- slice overlay は一時 selection ではなく、永続 metadata として扱う前提。
- slice export settings は sidecar に永続化する。
- `Canvas > Slice > Auto Slice...`
  - `slice name / W / H` の renderer モーダルを開く
  - 現在の slice 一式を固定グリッドで置き換える
  - 右端 / 下端の端数領域は無視する
  - `{sliceName}-{index}` 形式で必要十分最小のゼロ埋め採番を行う
  - `selectedSliceIds` は空にし、先頭生成 slice を active にする
- `Canvas > Slice > Save...`
  - 出力先ディレクトリを選ぶ
  - 1 件以上選択中なら選択 slice、未選択なら全 slice を export 対象にする
  - renderer 側で slice 矩形を crop する
  - nearest-neighbor で拡大縮小する
  - PNG payload を Electron main へ渡して directory export する

## Export Settings
- `exportSettings` は slice ごとに持ち、global preset は持たない。
- 現在の target:
  - `generic`
  - `apple`
  - `android`
- Generic / Apple の variant:
  - `1x`
  - `@2x`
  - `@3x`
  - `@4x`
- Android の variant:
  - `ldpi`
  - `mdpi`
  - `hdpi`
  - `xhdpi`
  - `xxhdpi`
  - `xxxhdpi`
- Android の directory template では `drawable-{density}` のように `{density}` を使える。
- base export size がまだ slice 軸サイズを参照している状態なら、slice サイズ変更時にその base size も追従する。

## Export Validation
- 空の slice 名を拒否する。
- export 対象内での slice 名重複を大文字小文字無視で拒否する。
- `slice.name` の禁止文字を拒否する。
- checked variant が 1 つもない slice を拒否する。
- 解決後の相対出力 path の重複を拒否する。
- 絶対 path や `.` / `..` を含む不正な相対 path を拒否する。

## 設計メモと見送り項目 (`#38`)
- 想定している方向:
  - Unity / iOS / Android 向け export
  - 永続 slice 一覧 + canvas overlay
  - 複数選択、複製、copy / paste、nudge、resize handle
  - global preset ではなく slice 単位の export settings
- 元の初版提案で見送っているもの:
  - auto slice を別種の slice として持つこと
  - atlas / spritesheet 自動配置
  - Fireworks 系の HTML / URL / alt メタ
  - selection 起点を中心にした slice モデル

## 実装メモ (2026-04-13)
- `EditorSlice` は optional な `exportSettings` を持てるようになった。
- sidecar の `document.slices[*].exportSettings` に保存 / 読み込みする。
- export settings が無い既存 sidecar も、既定値へ正規化して読み込める。
- slice sidebar の export controls は renderer-only の一時 state をやめ、slice 本体 state を直接編集するようにした。
- その結果、undo / save / load / duplicate / paste でも export settings を維持する。
