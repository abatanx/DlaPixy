# キャンバス、選択範囲、Viewport

## 現行のキャンバス挙動
- 既定キャンバスサイズは `256x256`。
- グリッドはキャンバス解像度ではなくオーバーレイ間隔。
- グリッド線間隔は `0..canvasSize` で、`0` はなし。
- 起動時の既定ツールは `Select`。
- 右ツールバーの並びは:
  - `Select` を描画ツールより上
  - アニメーションフレーム追加を描画ツールと分離
  - ズームを最下段
- 高速ドラッグでも Pencil / Eraser が欠けないよう補間する。
- Fill は 4 近傍の連結同色領域に対して実行する。
- 画面全体スクロールは止めて、stage / 内部スクロールだけを使う。

## 選択範囲と Floating
- 矩形選択、コピー、削除、貼り付け、直接ドラッグ移動に対応。
- Select ツール中に stage の空き部分をクリックすると選択解除。
- 見えている canvas 周辺余白も、Select のドラッグ開始・ドラッグ拡張・クリック解除を端セル clamp 付きで受ける。
- Select でドラッグなしクリックした場合は、現在のグリッド間隔に沿った 1 タイルを選ぶ。
- 描画系ツールは、選択範囲があるときはその内側だけに作用する。
- 貼り付けは DlaPixy 内部クリップボードと OS クリップボード画像の両方を受ける。
- floating 貼り付け / 移動では次を扱える:
  - 貼り付け直後のドラッグ移動
  - 8 ハンドル（`TL / TC / TR / ML / MR / BL / BC / BR`）
  - nearest-neighbor の拡大縮小
  - 矢印キーで `1px` 移動
  - 少しだけキャンバス外へ出しつつ、最低 `1px` は見える範囲に残す
  - キャンバス外側は見た目を clip
  - `Enter` で確定、`Esc` でキャンセル
- 確定時はキャンバス内だけに clip して反映し、貼り付け画像の未登録色はパレットへ追加する。

## 選択 Overlay
- overlay 上の数値ラベル:
  - 上下に幅
  - 左右に高さ
  - 左上に `x,y`
- overlay の枠 / ハンドル / ラベルは stage padding 側へはみ出せる。
- 選択枠は軽い marching-ants 表現を使う。
- floating 中は、下辺ラベルのさらに下に `置換 / ブレンド` toggle を表示する。

## Viewport とズーム
- キャンバス上にカーソルがあるときは、そのピクセルを固定したままズームする。
- カーソルが外にあるときは、現在 viewport の中心基準でズームする。
- `Space + ドラッグ` で手ツール風のパン。
- `Space + ホイール` は wheel delta を累積して高解像度入力でも飛びすぎないようにする。
- `Space` 押下中はネイティブスクロールを抑えて、ズームとスクロールの同時発生を避ける。
- 表示倍率モーダルは `1..12` を受けて、`Enter` / `Esc` に対応する。

## Canvas 周辺 UI
- ネイティブ `Canvas` メニューから次の renderer モーダルを開く:
  - キャンバスサイズ変更
  - グリッド線間隔変更
  - 表示倍率変更
- footer には `Canvas`, `Grid`, `Zoom`, `Current File` を表示する。
- footer を押すと同じ既存モーダルを開く。
- macOS 風の `⌘I`, `⌘G`, `⌘R` を footer 表記に出す。
- キャンバス周辺の見えている stage 余白は、slice mode ではそのまま新規 slice 作成 hotzone として扱う。
- floating の操作用 padding は、見た目の stage 余白とは別責務で持つ。

## 実装メモ
- キャンバスサイズ変更は左上基準で既存ピクセルを保持する。
  - 拡大: 追加領域を透明で埋める
  - 縮小: 範囲外ピクセルを切り捨てる
- サイズ変更時は選択状態と floating 状態を解除する。
- floating 状態は、選択削除、PNG 読込、Undo でも解除される。
- Undo スナップショットは少なくとも `canvasSize`, `pixels`, `selection`, `palette`, `selectedColor` を持つ。

## Floating 合成モード履歴 (`#52`)
- 目的:
  - floating overlay 上で `置換 / ブレンド` を切り替える
  - 内部貼り付け、外部クリップボード貼り付け、選択範囲ドラッグ移動へ共通適用する
  - sidecar の editor メタへ保存する
- 固定した判断:
  - `FloatingCompositeMode = 'replace' | 'blend'`
  - 値が無い / 不正な場合は `replace`
  - `Enter`、`Esc`、移動、リサイズ、Undo の既存挙動は変えない
  - モード変更時は即時再合成する
- ブレンド規則:
  - `置換`: RGBA をそのまま書き込む
  - `ブレンド`: source-over 合成、`alpha = 0` は変更なし、`alpha = 255` は完全置換
- 現在の結果:
  - floating モードは sidecar の editor メタへ保存される
  - overlay toggle は floating 状態がある間は常に表示される
  - プレビューは現在の base pixels と floating block から即時再合成される
