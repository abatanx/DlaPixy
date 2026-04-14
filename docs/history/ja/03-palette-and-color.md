# パレットと色

## 現在のパレット機能
- 色変換 helper:
  - `rgbaToHsva`
  - `hsvaToRgba`
- 初期パレットは Web Safe Color 216 色。
- パレット項目は `{ id, color, caption, locked }` に正規化する。
- caption の最大長は `100`（`shared/palette.ts` の `PALETTE_CAPTION_MAX_LENGTH`）。
- 既存スウォッチはダブルクリックで色モーダルを開く。
- パレット色モーダルは `#RRGGBB` + `AA`、RGBA / HSV を扱う。
- モーダルプレビューでは元色と編集中の色を並べて、近くに `Delta HSV` を出す。
- 描画色とパレット色は `#RRGGBBAA` を扱え、旧 `#RRGGBB` は読込時に正規化する。

## 使用数表示と削除
- `Cmd/Ctrl` 押下中だけ、各スウォッチに使用数オーバーレイを出す。
- 選択中スウォッチには、最初の一致ピクセル（`for y` → `for x`）へ飛ぶジャンプ操作がある。
- 使用中スウォッチの削除は確認付きで、一致ピクセルを透明化してから削除する。
- 既存パレット色を編集すると、キャンバス上の一致ピクセルも Undo 1 回で置換する。
- 編集後の色が別スウォッチと重複する場合は `適用` を無効にする。
- パレット末尾の `+` セルで、同じモーダルを追加モードとして開ける。

## 統合と並び順
- `Cmd/Ctrl + click` で merge 用の複数選択を切り替える。
- 通常選択済みスウォッチがある場合、最初の `Cmd/Ctrl + click` で 2 色を統合候補に入れる。
- 統合 UI は workspace 上部に出て、スウォッチ grid を押し下げない。
- 「残す色」は明示的に選び、`残` バッジで示す。
- 統合 UI から複数削除もでき、挙動は通常削除と同じ。
- `locked` スウォッチは使用数 `0px` でも merge 後に残る。
- 現在の並び順モード:
  - 手動 `Palette` モード（drag-and-drop 可）
  - 自動ソート `Hue①`, `Hue②`, `Saturation①`, `Saturation②`, `Value①`, `Value②`
- 自動モードは表示専用で、必要なら `適用` で canonical な手動順へ戻し込む。
- `alpha < 255` のスウォッチには小さな `透` バッジを重ねる。

## 同期、減色、GPL
- パレット同期は shared helper に寄せている。
- PNG 読込時は metadata の palette と、実際の使用色を結合する。
- K-Means は `removeUnusedColors` / `addUsedColors` オプション付き helper を使う。
- 選択範囲専用 K-Means:
  - `Palette -> K-Meansで減色する...` から起動
  - renderer モーダルで条件入力
  - 対象は現在の矩形選択のみ
  - 減色前後プレビューはスクロール / 倍率を同期
  - Lab 距離ベースで、alpha は維持
  - 適用時にパレット同期も同じ Undo 単位で行う
- GPL import / export:
  - 全置換
  - 追加
  - 標準 GPL 出力（3ch のみ、alpha パレットは拒否）
  - Aseprite RGBA GPL 出力
- GPL import は標準 RGB 行と Aseprite `Channels: RGBA` の両方を受ける。
- GPL の色名は DlaPixy の caption へ写し、`Untitled` は空 caption とみなす。

## パレット同期メモ (`#42`)
- 目的:
  - `src/App.tsx` のパレット / スウォッチ同期処理を切り出し、K-Means 後や PNG 読込後で再利用しやすくする
- 維持したい挙動:
  - 透明ピクセルは無視
  - 残る既存色は現在順を維持
  - 新規使用色はキャンバス初出順で末尾追加
  - 残存色の caption / lock を維持
  - 新規色は空 caption + unlocked で開始
  - 未使用色の除去と新規使用色の追加は呼び出し側オプションで制御
- 共通 helper の置き場:
  - `src/editor/palette-sync.ts`
  - 使用数集計、同期オプション、要約ラベル、ジャンプ先情報を持つ

## パレット並び順メモ (`#46`)
- 固定した判断:
  - `palette` は常に保存対象の canonical 手動順
  - save / load は canonical 手動順を使う
  - 自動ソートは表示専用で sidecar には保存しない
  - `New` / `Open` 後は手動モードへ戻す
  - `selectedColor` はモード切替や並び替え後も維持
  - Undo 対象は手動並び替えだけ
- 自動ソート key:
  - `Hue①`: `hue -> saturation -> value`
  - `Hue②`: `hue -> value -> saturation`
  - `Saturation①`: `saturation -> value -> hue`
  - `Saturation②`: `saturation -> hue -> value`
  - `Value①`: `value -> saturation -> hue`
  - `Value②`: `value -> hue -> saturation`
- alpha ルール:
  - 完全透明は先頭固定
  - `alpha > 0` 同士では alpha 降順を最後のキーに使う
  - 最後の tie-breaker は canonical 手動順

## 安定 ID メモ (`#56`)
- `PaletteEntry.id` を durable identity として使う。
- ID は UUID 形式で、`crypto.randomUUID()` から生成する。
- sidecar schema はパレット ID 導入で `2` に上がった。
- `id` で追う UI フロー:
  - hover 対象
  - 参照ライン
  - merge 選択
  - drag-and-drop 対象
- 色意味論の処理は引き続き `color` で解決する。
  - 使用数集計
  - ピクセル置換
  - 削除 / merge 実行
