# DEVELOP.ja.md

## 1. プロジェクト概要
- プロジェクト: `DlaPixy`（Electronデスクトップアプリ）
- 目的: macOS/Windows向けのPNGピクセルエディター（パレット、グリッド、選択、Undo、保存/読込、sidecar ベースの編集メタ情報）
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

- `npm run dev` は最初に `build:electron` を実行してから、以下を起動する。
  - Vite dev server
  - `electron/**` / `shared/**` 向けの `tsc -w`
  - `dist-electron/**` 更新時の Electron 自動再起動

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
  - グリッド線間隔: 数値入力 `0..canvasSize`（`0` = なし）
- 初期パレットは Web Safe Color 216 色を使う
- パレット項目は短いキャプション（最大4文字）を持てて、各スウォッチの下に小さく表示する
  - 既存スウォッチをダブルクリックすると、その色を選択しつつ色編集モーダルを開く
- パレット項目は `locked` 状態も持てる
  - ロック / ロック解除はパレット色モーダルから切り替える
  - GPL import で入る色は未ロックで扱う
- スウォッチパネルの使用数オーバーレイ
  - `Ctrl/Cmd` 押下中だけ、各スウォッチ上に現在の使用ピクセル数を要約ラベルで重ねて表示する
  - 現在選択中スウォッチには専用のジャンプボタンがあり、最初に見つかった同色ピクセル（`for y` → `for x` 順）へスクロールし、`1x1` 選択にする
  - 使用中のスウォッチを削除するときは確認モーダルを出し、確定時は該当ピクセルをすべて透明化してから削除する
- パレット色はスウォッチパネル上でインライン統合できる
  - `Cmd/Ctrl + クリック` でスウォッチの複数選択を追加 / 解除する
  - 通常クリックで 1 色選択済みなら、最初の `Cmd/Ctrl + クリック` でその色とクリックした色の 2 色を統合対象に入れる
  - 2 色以上が選択されると、スウォッチグリッドを押し下げずに workspace 列上部へ Bootstrap 風の統合バーが出る
  - 統合対象が 2 色未満に戻ったら、インライン統合状態は破棄して通常の単一選択へ戻る
  - 統合バーで「残す色」を選び、統合時は他の選択色をその色へ寄せる
  - workspace 上の統合バーでも、現在の「残す色」チップには `残` バッジが付く
  - workspace 上の統合バーの各チップには `×` があり、個別に統合対象から外せる
  - 統合バーには `削除` もあり、選択中スウォッチをパレットのゴミ箱ボタンと同じ「使用中なら透明化してから削除」挙動でまとめて削除できる
  - 統合対象を追加しても現在の「残す色」は自動では移動せず、統合バー上で明示的に切り替えたときだけ変わる
  - 統合はキャンバス上の一致ピクセル置換と、不要スウォッチ削除を Undo 1 回の操作でまとめて行う
  - 統合前に `locked` だった選択スウォッチは、使用数が `0px` になってもパレット上に残す
- パレット同期は共通 helper ベースに整理した
  - K-Means 後は `removeUnusedColors` / `addUsedColors` オプション付き helper を使う
  - PNG 読込時は metadata の palette と実使用色を結合する
- GPL パレットのインポート / エクスポート
  - ネイティブ `Palette` メニューに `インポート（GPL/すべて置換）` / `インポート（GPL/追加）` / `エクスポート（標準 GPL）` / `エクスポート（Aseprite向け RGBA GPL）` を追加
  - `.gpl` を Electron の native dialog 経由で読み込み、置換または追加で適用できる
  - `エクスポート（標準 GPL）` は 3ch の GPL を書き出し、alpha を含むパレットは拒否する
  - `エクスポート（Aseprite向け RGBA GPL）` は常に Aseprite 互換の `Channels: RGBA` 付き GPL を書き出す
  - GPL の色名は DlaPixy の caption に対応づけ、`Untitled` は import 時に空 caption 扱いにする
- 選択範囲専用の K-Means 減色
  - ネイティブ `Palette -> K-Meansで減色する...` で renderer モーダルを開く
  - 現在の矩形選択だけを対象に減色する
  - モーダル内で `目標色数` を指定し、減色前後プレビューを確認してから適用する
  - 減色前後プレビューは同じ倍率で拡大縮小し、スクロール位置も同期する
  - プレビュー枠のスクロールバーは常時見える状態にする
  - Lab 距離ベースの K-Means を使い、alpha は元の値を維持する
  - 適用時に、実際のキャンバス使用色へ合わせてスウォッチも同じ undo 単位で同期する
- ツール
  - 起動時の既定ツールは `Select`
  - 右ツールバーでは `Select` を最上段に置き、描画系ツールとはセパレーターで分ける
  - アニメーションフレーム追加ボタンも、描画系ツールとは別セパレーターで区切る
  - 拡大縮小ボタンは右ツールバーの最下段に置く
  - 描画（Pencil）
  - 消しゴム（Eraser）
  - 塗りつぶし（Fill）
  - 矩形選択（Select）
- 補間描画
  - 高速ドラッグでも描画/消しゴムが欠けない
- 選択範囲操作
  - コピー
  - 削除
  - DlaPixy 内コピーした選択範囲、または OS クリップボード画像の貼り付け
  - `Y` または右ツールバーのボタンで、現在の選択範囲をローテーションモーダルで編集できる
  - ローテーションモーダル内ではカーソルキーで `1px` の循環移動を行う
  - ローテーションモーダルには `90° 左 / 90° 右` ボタンもあり、正方形選択のときだけ有効になる
  - ローテーションモーダルには水平 / 垂直フリップボタンもあり、長方形選択でも利用できる
  - 本体キャンバスへの反映は `OK` 時だけで、`Cancel` / `Esc` では破棄する
  - Select ツール中は `canvas-stage` の余白クリックで現在の選択範囲を解除できる
  - Selectツールでドラッグせずクリックした場合、現在のグリッド間隔に沿った1タイルを選択
  - 矩形選択の解除は、Selectツールで選択範囲外をクリックした場合のみ（他ツール操作では選択維持）
  - 選択範囲があるとき、描画/消しゴム/塗りつぶしは選択範囲内ピクセルのみを処理
  - 貼り付け直後のドラッグ移動（Selectツール）
  - 浮動貼り付け中は 8 箇所ハンドル（`TL / TC / TR / ML / MR / BL / BC / BR`）で拡大縮小できる
  - 浮動貼り付けの拡大縮小は nearest-neighbor で行い、縦横比は固定する
  - 浮動貼り付け/移動の操作: `Enter` で確定、`Esc` でキャンセルして貼り付け前状態に復元
  - floating 中は、選択 overlay の下辺ラベルのさらに下に `置換 / ブレンド` の segmented toggle を表示する
  - 同じ floating 合成モードを、内部貼り付け / 外部クリップボード貼り付け / 選択範囲ドラッグ移動のすべてへ適用する
  - floating 合成モードを切り替えると、確定前プレビューへ即時反映される
  - 浮動貼り付けの確定時は、貼り付け画像に含まれる未登録色のスウォッチを追加し、既存スウォッチは削除しない
  - 矩形選択したピクセルのドラッグ移動（貼り付け移動と同じ挙動）
- Undo
- PNG保存/読込
  - ファイル操作はOS標準の File メニュー中心（新規/開く/保存/別名保存/最近使ったファイル）
  - ダイアログ初期ディレクトリは最終利用ディレクトリを永続利用（無効時はホーム）
  - Recent Files は上限管理・重複排除・存在しないパスの自動除外に対応
  - 編集メタ情報は PNG の隣に sidecar JSON（`<filename>.dla-pixy.json`）として保存する
  - `foo.png` を開くと同階層の `foo.dla-pixy.json` を自動読込し、なければ PNG 単体として開く
  - sidecar JSON が壊れている場合は警告ダイアログを表示し、その後 PNG 単体として開く
  - PNG 内メタ情報（`dla-pixy-meta` を含む）は読込時には使わない
  - sidecar JSON にはパレット情報に加えて、編集UI状態（`floatingCompositeMode`、`gridSpacing`、`transparentBackgroundMode`、`zoom`、表示位置、`lastTool`）も保存する
  - 保存時は sidecar JSON を新規作成または更新しつつ、既存の PNG メタ情報チャンクは壊さず維持する
- ネイティブ Canvas メニュー
  - `Canvas -> キャンバスサイズ変更...` でモーダルを開く
  - `Cmd/Ctrl + I` でもキャンバスサイズ変更モーダルを開ける
  - キャンバスサイズ変更モーダルは `Esc` でキャンセルできる
  - `Canvas -> グリッド線間隔変更...` でモーダルを開く
  - `Cmd/Ctrl + G` でもグリッド線間隔変更モーダルを開ける
  - `Canvas -> 透過バックグラウンド` で透明部分の表示背景を切り替える
  - モードは `白チェック` / `黒チェック` / `白` / `黒` / `マゼンタ`
  - 選んだモードは renderer 状態からネイティブメニューへ反映され、sidecar の editor メタ情報にも保存される
  - サイドバーの常設キャンバスサイズ / グリッド設定UIは廃止
- フッターステータス表示
  - `キャンバス`, `グリッド線`, `表示倍率`, `現在ファイル` は sidebar ではなく画面下部 footer に表示
  - footer の `キャンバス` / `グリッド線` / `表示倍率` を押すと既存の変更モーダルを開く
  - `キャンバス` 表示には macOS 風の `⌘I` 表記でショートカットを併記する
  - `グリッド線` 表示には macOS 風の `⌘G` 表記でショートカットを併記する
  - `表示倍率` 表示には macOS 風の `⌘R` 表記でショートカットを併記する
- 表示倍率モーダル
  - `Cmd/Ctrl + R` で表示倍率入力モーダルを開ける
  - 入力範囲は `1..12`、`Enter` で適用、`Esc` でキャンセル
- ズーム挙動
  - 拡大 / 縮小時、カーソルがキャンバス上にある場合はその位置のピクセルを固定したままズームする
  - カーソルがキャンバス外にある場合は、現在の表示領域中心を基準にズームする
  - `Space + ホイール` でズームでき、既存の `Space + ドラッグ` パンもそのまま使える
  - `Space + ホイール` は wheel delta を累積してしきい値超過で 1 段階だけズームするため、Magic Mouse / trackpad の高解像度入力でも過敏になりにくい
  - `Space` 押下中は stage のネイティブスクロールを止めるため、Magic Mouse でも「スクロールしながらズーム」が同時発生しにくい
- 1x PNGプレビュー
  - 大きい画像でも縮小し切らず、必要に応じてスクロールで確認できる
- 選択範囲 3x3 タイルプレビュー（1xプレビュー下）
  - 現在の選択範囲を表示
  - 選択解除後も最終選択範囲を保持して表示継続
  - 編集内容をリアルタイム反映
  - 親ノード幅いっぱいに自動拡大/縮小
  - プレビュー表示領域は正方形（`1:1`）で見せる
  - `G` で、現在の選択範囲を preview 専用の重ねとして登録できる
  - 最初に登録した重ねが、その後の Tile Preview 合成表示の基準サイズになる
  - 登録済みの重ねは、元のキャンバス矩形を参照し続けるので、ピクセル編集がそのままリアルタイム反映される
  - preview の重ねがある間は、現在の選択範囲が未確定の最上位候補として重なって見える
  - 2 枚目以降の選択範囲は、1 枚目サイズへクリッピングまたは透明余白補完してから合成する
  - preview の重ねは全クリアできるが、キャンバス本体や Undo 履歴には影響しない
  - 登録済みの重ねは Tile Preview 下にミニプレビュー付きで一覧表示され、ドラッグ&ドロップ並び替えと個別削除ができる
- アニメーションプレビューパネル（Tiling の下）
  - `T` または右ツールバーのボタンで現在の選択範囲をフレーム追加
  - フレーム追加時は自動で `Animation Preview` タブへ切り替える
  - サイドバー上で再生/停止、FPS、ループ、全クリア、削除、上下並び替えに対応
  - 操作部は Bootstrap のコンパクトなアイコン中心ボタンで表示
  - `Preview / Tiling / Animation Preview` は FontAwesome 付きの短い Bootstrap 風タブで切り替える
  - プレビュー表示領域は正方形（`1:1`）で見せる
- 左サイドバーのレイアウト
  - `SidebarPreviewSection` と `SidebarPaletteSection` は別カードで表示し、視覚的に分離する
  - Preview 側は Bootstrap タブを維持しつつ、内側のカードっぽい装飾は薄くしてフラットに見せる
- 拡大/縮小
- Space押下中のパン（手ツール挙動）
- 画面全体スクロール禁止（編集領域のみスクロール）
- 右端縦ツールバー（FontAwesome）
- TypeScript/ImageData 互換修正
  - `new ImageData(...)` 前に `slice()` を使い `TS2769` を回避

## 5. ショートカット（現状）
- ツール切替
  - `Q`: 矩形選択
  - `W`: 描画
  - `E`: 消しゴム
  - `P`: 塗りつぶし
- ズーム
  - `+D`（`Equal`, `NumpadAdd`, `KeyD`, `BracketRight`, `Period`）: 拡大
  - `-A`（`Minus`, `NumpadSubtract`, `KeyA`, `BracketLeft`, `Comma`）: 縮小
  - `Space + ホイール上下`: キャンバス上のカーソル位置基準で拡大 / 縮小
- 編集
  - `Cmd/Ctrl + Z`: Undo
  - `Cmd/Ctrl + A`: キャンバス全体を選択
  - `Cmd/Ctrl + C`: 選択範囲コピー
  - `Cmd/Ctrl + V`: 貼り付け
  - `Delete` / `Backspace`: 現在の選択範囲を削除（選択なし時は何もしない）
  - `Cmd/Ctrl + I`: キャンバスサイズ変更モーダルを開く
  - `Cmd/Ctrl + G`: グリッド線間隔変更モーダルを開く
  - `Cmd/Ctrl + R`: 表示倍率モーダルを開く
  - `G`: 現在の選択範囲を Tile Preview の重ねに追加
  - `T`: 現在の選択範囲をアニメーションプレビューへ追加
  - `Y`: 現在の選択範囲に対するローテーションモーダルを開く
  - `F`: ホバー中ピクセルを参照ラインへ追加/更新し、パレット登録色ならその色を選択
  - `S`: ホバー中ピクセルがキャンバス中央に来るようにスクロール
  - `1..9`: 番号付き参照ラインの色を選択
  - `Enter`: 浮動貼り付け/移動を確定
  - `Esc`: 浮動貼り付け/移動中はキャンセル、それ以外は選択範囲を解除

## 6. Sidecar JSON 仕様
PNG の隣に `<filename>.dla-pixy.json` として保存。

```ts
{
  dlaPixy: {
    schemaVersion: number,
    document: {
      palette: {
        entries: Array<{ color: string, caption: string, locked: boolean }>
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

- `foo.png` に対する sidecar は `foo.dla-pixy.json`
- 読み込むのは新しい `dlaPixy` 構造のみで、旧 sidecar 形式は不正データとして扱う
- sidecar が無ければ PNG 単体画像として扱う
- sidecar が壊れていれば警告ダイアログ後に PNG 単体読込へフォールバックする
- 既存の PNG メタ情報チャンクは保存時に維持するが、DlaPixy の編集状態復元には使わない

## 7. 主要ファイル
- `src/App.tsx`
  - エディター本体の状態管理と高レベルなオーケストレーション
  - サイドバー、中央ワークスペース、shell chrome component、各種編集 callback を束ねる
- `src/components/EditorCanvasWorkspace.tsx`
  - 中央のキャンバスカード UI。キャンバス面、選択オーバーレイ、ホバー情報、参照ライン、右ツールバーを担当する
  - 編集ロジックは `App.tsx` に残しつつ、中央レイアウトの見通しをよくする
- `src/components/EditorSidebar.tsx`
  - 左サイドバーのコンテナ。プレビュー部とパレット部を組み立てる
- `src/components/EditorModalLayer.tsx`
  - toast と、canvas/grid/zoom、K-Means、rotation、パレット削除確認の renderer modal 群をまとめる
  - shell レベルの modal JSX を `App.tsx` から外しつつ、既存の配線はそのまま保つ
- `src/components/EditorStatusFooter.tsx`
  - canvas/grid/zoom/file status を表示する footer ステータスバー
  - footer の JSX と表示文言を `App.tsx` から外す
- `src/hooks/useDocumentFileActions.ts`
  - PNG + sidecar metadata の保存 / 名前を付けて保存 / 読込フローをまとめる hook
  - 未保存確認ダイアログと、renderer 側での PNG decode / state 反映を担当する
- `src/hooks/useEditorShortcuts.ts`
  - グローバルショートカットとネイティブメニュー action の配線をまとめる hook
  - shortcut 系の副作用を root JSX から切り離す
- `src/hooks/useCanvasViewport.ts`
  - Space キー中の pan、wheel zoom、zoom anchor 復元、viewport 復元をまとめる hook
  - ドキュメント読込/保存やキャンバス操作が viewport 副作用を `App.tsx` で直接持たないようにする
- `src/hooks/useCanvasSettings.ts`
  - キャンバスサイズ / グリッド線 / 表示倍率モーダルの open-close と、canvas/grid 適用処理をまとめる hook
  - キャンバス設定系の副作用を 1 か所に寄せて、`App.tsx` から callback 群を減らす
- `src/hooks/useUndoHistory.ts`
  - Undo スタックの snapshot 管理と undo 適用フローをまとめる hook
  - 履歴 push/pop と復元処理を 1 か所に寄せて、`App.tsx` から undo ロジックを減らす
- `src/hooks/useCanvasEditingCore.ts`
  - キャンバス描画同期、floating preview 同期、座標解決、stroke、flood fill の低レベル処理をまとめる hook
  - 描画系の編集コアを 1 か所に寄せて、`App.tsx` から render/draw callback 群を減らす
- `src/hooks/useEditorShellUi.ts`
  - status toast の state、toast 自動非表示、document title 同期、透明背景同期をまとめる hook
  - root UI の副作用を 1 か所に寄せて、`App.tsx` から shell レベルの UI effect を減らす
- `src/hooks/useSelectionOverlay.ts`
  - selection overlay の表示判定と style 計算をまとめる hook
  - overlay 表示用のレイアウト計算を 1 か所に寄せて、`App.tsx` から style 計算を減らす
- `src/hooks/useFloatingSelectionState.ts`
  - floating selection の ref、clipboard ref、clear helper をまとめる hook
  - 浮動選択まわりの state holder を 1 か所に寄せて、`App.tsx` から橋渡し用 ref を減らす
- `src/hooks/useCanvasPointerInteractions.ts`
  - draw/select/fill の pointer event をまとめるキャンバス用 hook
  - `onMouseDown` / `onMouseMove` / `onMouseUp` の制御を持ちつつ、floating move/resize は専用 hook へ委譲する
- `src/hooks/useEditorPreviews.ts`
  - 1x preview / tile preview / animation preview をまとめるサイドバー向け hook
  - プレビュー用 Data URL、tile/animation の state、サイドバー callback を `App.tsx` から切り離す
- `src/hooks/usePaletteManagement.ts`
  - パレット編集/削除フローと GPL import/export をまとめる hook
  - パレット CRUD の副作用と削除確認 state を 1 か所に寄せて、`App.tsx` から callback 群を減らす
- `src/hooks/useSelectionOperations.ts`
  - 選択削除/全選択/選択解除と、K-Means / rotation modal request をまとめる hook
  - 選択まわりの編集副作用と modal request 管理を 1 か所に寄せて、`App.tsx` から callback 群を減らす
- `src/hooks/usePixelReferences.ts`
  - ホバー中ピクセル、参照ライン、パレット hover からの `F` 固定、drag/copy 操作をまとめる hook
  - キャンバスの参照/インスペクタ挙動を 1 か所に寄せて、`App.tsx` から callback 群を減らす
- `src/hooks/useFloatingPaste.ts`
  - copy/paste/finalize/cancel/nudge と、確定済み選択範囲の floating 化をまとめる hook
  - floating paste の副作用と selection -> floating 変換を `App.tsx` から切り離す
- `src/hooks/useFloatingInteraction.ts`
  - floating 選択範囲の move/resize を扱うポインタイベント hook
  - リサイズハンドルの hit test と overlay drag をまとめつつ、既存 ref/state をそのまま再利用する
- `src/components/sidebar/SidebarPreviewSection.tsx`
  - 1xプレビュー / タイルプレビュー / アニメーションプレビューを担当するプレビューセクション
  - 3つのプレビューは Bootstrap 風のタブ切り替えで表示する
  - Tile Preview の重ね追加 / 全クリア UI、重ね一覧、要約表示もここで担当する
- `src/editor/preview.ts`
  - 1x / Tile Preview 用の Data URL 生成を担当する
  - Tile Preview の重ねを 1 枚目サイズへ正規化して合成し、その結果を `3x3` 反復表示する
- `src/editor/app-utils.ts`
  - `App.tsx` から切り出した小さな共通 helper。ファイル名処理や selectedColor 解決を担当する
- `src/editor/canvas-pointer.ts`
  - canvas pointer interaction 用の共有 state 型
- `src/editor/floating-paste.ts`
  - `App.tsx` と floating paste hook で共有する、内部クリップボード / floating paste の型定義
- `src/editor/floating-interaction.ts`
  - floating 選択範囲の移動/リサイズ用の幾何計算、ハンドル定義、overlay style をまとめる
- `src/components/sidebar/SidebarPaletteSection.tsx`
  - 色セレクタ起点とパレット一覧を担当するパレットセクション。memo 化して再描画を減らしている
  - パレット一覧はコンパクト表示 + 独立スクロールにして、大量色でも使いやすくしている
- `src/components/sidebar/types.ts`
  - サイドバー各セクションで共有する props 型
- `src/components/EditorToolbar.tsx`
  - 右ツールバーUI（ツール切替、アニメーションフレーム追加、ズーム、Undo、コピー/貼り付け/削除）
- `src/components/modals/CanvasSizeModal.tsx`
  - キャンバスサイズ変更モーダルのUIと入力検証/適用トリガー
- `src/components/modals/GridSpacingModal.tsx`
  - グリッド線間隔変更モーダルのUI。単一の数値入力で `0` はなし、`Enter` で適用、`Esc` でキャンセル
- `src/components/modals/ZoomModal.tsx`
  - 表示倍率変更モーダルのUI。単一の数値入力で `1..12`、`Enter` で適用、`Esc` でキャンセル
- `src/components/modals/KMeansQuantizeModal.tsx`
  - 選択範囲専用の K-Means 減色モーダル。目標色数入力と減色前後プレビューを提供
- `src/components/modals/SelectionRotateModal.tsx`
  - 選択範囲ローテーションモーダル。プレビュー、カーソルキー操作、`OK` / `Cancel` を担当
- `src/components/modals/PaletteColorModal.tsx`
  - `#RRGGBB` と別枠 `AA` の HEX入力、および RGBA / HSV で選択色を編集する renderer モーダル
- `src/components/modals/useBootstrapModal.ts`
  - renderer モーダル共通の Bootstrap ライフサイクル hook
- `src/editor/constants.ts`
  - グリッド/キャンバス/ズーム制約、デフォルトパレットなど定数
- `src/editor/kmeans-quantize.ts`
  - 選択範囲抽出と Lab 距離ベース K-Means 減色 helper
- `src/editor/selection-rotate.ts`
  - ローテーションモーダル向けの選択範囲切り出し、循環移動、適用 helper
- `src/editor/palette-sync.ts`
  - パレット使用数解析とスウォッチ同期の共通 helper
  - 使用数ラベル生成と、同色ピクセルへのジャンプ先情報を持つ
- `src/editor/palette-merge.ts`
  - 複数パレット色を 1 色へ統合するときの palette / pixels 更新をまとめる pure helper
- `src/editor/preview.ts`
  - 領域/ブロックの PNG Data URL プレビュー helper
- `src/editor/transparent-background.ts`
  - 透過背景モードを renderer 共通の surface class 名へ変換する helper
- `src/editor/types.ts`
  - 共通型定義（`Tool` / `Selection` / `EditorMeta`）
- `src/editor/utils.ts`
  - ピクセル処理・選択処理のユーティリティ
- `shared/palette.ts`
  - 実行環境共通のパレット型と正規化 helper
- `shared/palette-gpl.ts`
  - Electron main process と renderer の前提で共有する GPL parser / serializer
- `shared/transparent-background.ts`
  - Electron メニューと renderer で共有する透過背景モード / ラベル定義
- `src/styles.css`
  - レイアウト、スクロール制御、ツールバー見た目
- `src/main.tsx`
  - Bootstrap / FontAwesomeのCSS読込
- `electron/main.ts`
  - Electronウィンドウ、IPC、PNG保存/読込、sidecar JSON の読込/保存
  - PNG 既存メタ情報チャンクを保持しつつ、DlaPixy の編集状態は sidecar に逃がす
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
- グリッド線間隔変更もネイティブ `Canvas` メニューから開き、値は `0..canvasSize` の範囲で扱う（`0` はなし）。
- 透過背景モードもネイティブ `Canvas` メニューから選び、Electron 側のアプリ設定へ保存して renderer state に IPC で反映する。
- 透過背景モードは、メイン編集キャンバス / sidebar の `Preview / Tile / Animation Preview` / renderer モーダル内プレビューへ同じ設定を適用する。
- 透過背景モードは PNG metadata には保存しない。
- パレット import/export はネイティブ `Palette` メニューから開き、ダイアログは Electron main process 側で扱う。
- 選択範囲の減色起動はネイティブ `Palette -> K-Meansで減色する...` だが、条件入力 UI 自体は renderer モーダルで扱う。
- パレット色選択はブラウザ標準の color picker ではなく renderer モーダルで行う。
- パレット色モーダルのプレビューは、変更前の色と現在編集中の色を横並びで表示し、近くに `Delta HSV` 差分を出す。
- パレット項目は `{ color, caption }[]` で保持する。
- パレット項目は `{ color, caption, locked }[]` で保持する。
- パレットキャプションの最大文字数は `src/editor/constants.ts` の `PALETTE_CAPTION_MAX_LENGTH` で管理する。
- `src/editor/palette-sync.ts` を、以下の共通責務の置き場にした。
  - 色ごとの使用ピクセル数集計
  - スウォッチ同期オプション（`removeUnusedColors`, `addUsedColors`）
  - 使用数ラベルの要約表示
- 描画色とパレット色は alpha 付き `#RRGGBBAA` も扱え、従来の `#RRGGBB` は読込時に正規化する。
- K-Means 減色は現状 RGB->Lab 距離でクラスタリングし、各ピクセルの alpha は変更しない。
- PNG読込時は metadata の palette と、キャンバス使用色から得たパレットを結合する。
- GPL import は標準 RGB 行と Aseprite 互換の `Channels: RGBA` を受け付ける。
- GPL export はメニューで形式を明示選択する。
  - `エクスポート（標準 GPL）`: 3ch GPL のみ。alpha を含むパレットは拒否する
  - `エクスポート（Aseprite向け RGBA GPL）`: 常に Aseprite 互換の `Channels: RGBA` を書き出す
- 既存パレット色を編集したときは、キャンバス上の一致ピクセルも新しい色へ置換し、Undo 1 回で戻せる。
- 既存パレット色の編集中に、調整後の色が別のパレット色と重複する場合は `適用` できない。
- パレットグリッド末尾の `+` セルから同じモーダルを追加モードで開き、重複しない新規パレット色を追加できる。
- renderer モーダルは `src/components/modals/**` 配下で、モーダル単位のファイルに分割している。
- 貼り付けは内部クリップボード（`selectionClipboardRef`）を使う。
- 貼り付け直後の移動は `floatingPasteRef` により実現。
- 浮動貼り付け中は、矢印キーで `1px` ずつ移動できる。
- 浮動貼り付けプレビューは stage overlay で描画する。
  - キャンバス端付近でも、少し外側まで移動 / リサイズしやすいが、最低 `1px` は見える範囲に残す
  - キャンバス外にはみ出した見た目は clip し、キャンバス内に見えている範囲だけ表示する
  - 確定時の合成は `blitBlockOnCanvas` でキャンバス内だけへ clip して反映
- 選択矩形の外側に、小さな数値ラベルを表示する。
  - 上下に幅
  - 左右に高さ
  - 左上に `x,y`
  - 選択 overlay UI（枠 / ハンドル / ラベル）は stage padding 側へはみ出せて、キャンバス surface で clip されない
  - 選択枠は軽い marching-ants アニメーションで視認しやすくする
- 浮動貼り付けのプレビュー画素は、現在の合成済み `pixels` をそのままメインキャンバスへ描く
  - 選択 overlay は枠 / ハンドル / ラベル / 合成モード toggle だけを担当する
  - overlay 自体は stage padding 側へはみ出せるが、実際の画素はキャンバス surface 内だけに見える
- 選択範囲のドラッグ移動も `floatingPasteRef` の同じ経路を再利用
  - 選択範囲ドラッグ開始時に、選択ピクセルを浮動ブロック化して移動
- 浮動貼り付け状態は以下で解除される。
  - キャンバスサイズ変更
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
6. リポジトリ管理下の `.ts` / `.tsx` / `.css` ソースは、先頭の共通 copyright header を維持する

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
- #42 `refactor: スウォッチ整理処理を共通化する`
  - https://github.com/abatanx/DlaPixy/issues/42
- #46 `feat: パレットの並び順モードを追加する（手動並び替え / 自動ソート）`
  - https://github.com/abatanx/DlaPixy/issues/46
- #47 `feat: パレットで複数スウォッチを選択して1色へ統合するUIを追加する`
  - https://github.com/abatanx/DlaPixy/issues/47
- #48 `release: App Store 登録とサブスク関連ロジックを整備する`
  - https://github.com/abatanx/DlaPixy/issues/48
- #49 `feat: OSSライセンス表示画面を追加する`
  - https://github.com/abatanx/DlaPixy/issues/49
- #50 `feat: 貼り付け時に拡大縮小して配置できるようにする`
  - https://github.com/abatanx/DlaPixy/issues/50
- #51 `update: PNGメタ保存から外部JSON管理へ移行し、保存/互換仕様を整理する`
  - https://github.com/abatanx/DlaPixy/issues/51
- #52 `spec: canvas-selection-overlay 上で合成モード（置換 / ブレンド）を切り替え、editor メタへ保存できるようにする`
  - https://github.com/abatanx/DlaPixy/issues/52
- #56 `refactor: パレットスウォッチに安定IDを導入する`
  - https://github.com/abatanx/DlaPixy/issues/56

## 13. Issue #42 仕様メモ（2026-03-24）
- 目的:
  - `src/App.tsx` にあるパレット/スウォッチ同期処理を切り出して、K-Means後・PNG読込後・今後の画像変換処理から再利用できる形にする。
- 現状の実装起点:
  - `src/App.tsx` の `collectUsedColorsFromPixels(pixels)` は、非透明ピクセルだけを対象に、出現順のユニークな `#RRGGBBAA` 色一覧を集めている。
  - `src/App.tsx` の `buildPaletteFromCanvasPixels(pixels, currentPalette)` は、使用中の既存色を残し、新しく使われた色を末尾追加し、残存色の caption を維持し、新規色の caption は空文字で作る。
  - K-Means 適用後はすでに `buildPaletteFromCanvasPixels(...)` を使っている。
  - PNG読込後はまだ同じ同期経路を使っていない。
    - メタ情報の palette があればそのまま採用
    - なければ検出色（最大64色）を `createPaletteEntries(...)` で初期化
- リファクタ時に維持したい挙動案:
  - 透明ピクセルはパレット同期の対象外にする。
  - PNG読込時に metadata の palette があれば、実際のキャンバス使用色から得たパレットと結合する。
  - スウォッチにロック状態を持てるようにする。
  - ロック / ロック解除はパレット色モーダルから行えるようにする。
  - 各スウォッチ色について、現在キャンバス上で何ピクセル使われているかを扱えるようにする。
  - スウォッチパネルでは `Ctrl/Cmd` 押下中だけ、その使用ピクセル数をスウォッチ上へ文字オーバーレイ表示できるようにする。
  - 現在選択中スウォッチには、その色を使っているピクセル位置の中心へキャンバス表示を自動移動し、`1x1` の矩形選択状態にする専用ジャンプ操作を持たせる。
  - 同じ色のピクセルが複数ある場合、ジャンプ先は `for y in 0..` の外側ループ、`for x in 0..` の内側ループで最初に見つかったピクセルとする。
  - 使用数ラベルの表示は次の形式にする。
    - `0..999`: 実数値をそのまま表示
    - `1000` 以上: `~` を付けた整数の概数 + `K / M / G / T`
    - 小数点は使わない
    - 例: `0`, `42`, `999`, `~1K`, `~12K`, `~3M`
  - 残る既存色は caption とロック状態を維持する。
  - 新規追加色の caption 初期値は `''`、ロック初期値は `false` にする。
  - パレット順序は現状挙動を維持する。
    - 残る既存色は現在順を維持
    - 新規使用色はキャンバス上の初出順で末尾追加
  - 未使用色を外すかどうかと、新規使用色を追加するかどうかは、どちらも呼び出し側オプションに従う。
  - 未使用色を外すかどうかは、呼び出し側が `外す / 外さない` を選べるようにする。
  - 呼び出し側が「外す」を選んだ場合だけ、未使用色を外す判定を行う。
    - その場合、未使用色を外す条件は次の両方を満たす場合だけにする。
      - ロックされていない
      - caption が付いていない
  - 呼び出し側が「外さない」を選んだ場合は、未使用色はロック状態や caption に関係なく残す。
- メタ情報の後方互換性は、現時点では不要とする。
- `selectedColor` のフォールバックは現状の K-Means 後挙動に合わせる。
  - まだ存在するなら現在色を維持
  - なくなったら先頭パレット色へフォールバック

## 14. Issue #52 仕様メモ（2026-03-28）
- 目的:
  - floating 中の選択矩形 overlay 上で `置換 / ブレンド` を切り替えられるようにする。
  - 貼り付けだけでなく、選択範囲ドラッグ移動を含むすべての floating 操作に同じ合成モードを適用する。
  - 選択した floating 合成モードを sidecar の `editor` メタへ保存する。
- 現状の実装起点:
  - `src/hooks/useFloatingPaste.ts`
    - `beginFloatingPaste(...)` が内部コピー / 外部クリップボード画像から浮動貼り付けを開始する。
    - `liftSelectionToFloatingPaste()` は、選択範囲ドラッグ移動でも同じ floating state を再利用している。
    - `applyFloatingPasteBlock(...)` は `blitBlockOnCanvas(...)` を使ってプレビューを再合成している。
  - `src/editor/utils.ts`
    - `blitBlockOnCanvas(...)` は現状だと常に置換動作になっている。
  - `src/components/EditorCanvasWorkspace.tsx`
    - `.canvas-selection-overlay` には、すでに floating handle とサイズラベル描画の責務がある。
  - `shared/sidecar.ts`, `src/hooks/useDocumentFileActions.ts`, `electron/main.ts`
    - editor メタは現状 `gridSpacing`, `transparentBackgroundMode`, `zoom`, `viewport`, `lastTool` を保存 / 復元している。
- 実装ブレを防ぐための判断:
  - `FloatingCompositeMode = 'replace' | 'blend'` を導入する。
  - sidecar の `editor.floatingCompositeMode` として保存する。
  - sidecar に値が無い、または無効な場合は `replace` を既定値にする。
  - 浮動プレビュー更新は不要な確保を増やさない。
    - 移動だけでサイズ不変なら、現在の拡大縮小済み floating block を再利用する。
    - メインキャンバス描画は temp canvas / image data を毎回作らず、再利用可能な offscreen buffer を使う。
  - `SIDECAR_SCHEMA_VERSION = 1` は維持する。
    - 既存 sidecar は `floatingCompositeMode` 欠損時に `replace` 補完でそのまま読めるようにする。
    - この項目追加だけで schema version を上げない。
  - 合成モードは、すべての floating 操作に共通で適用する。
    - DlaPixy 内コピー → 貼り付け
    - OS クリップボード画像 → 貼り付け
    - 選択範囲ドラッグ移動 → floating 化した移動
  - overlay の toggle UI は、floating state が存在するときは常に表示する。
  - この機能のために floating state の origin/kind を分ける必要はない。
    - 他用途で持つのはよいが、合成ロジック自体は origin に依存させない。
  - 浮動貼り付け中にモード変更したら、次の材料で即時再合成する。
    - 現在の `basePixels`
    - 現在の floating rect（`x / y / width / height`）
    - 必要なら拡大縮小済みの `sourcePixels`
  - `Enter` 確定時は、その時点で見えているプレビュー結果をそのまま確定する。
  - `Esc`、移動、リサイズ、Undo の既存挙動は変えない。
- ブレンド規則:
  - `置換`
    - 貼り付け元 RGBA をそのまま書き込む
  - `ブレンド`
    - 貼り付け先ピクセルに対して source-over で合成する
    - source alpha `0` は貼り付け先を変更しない
    - source alpha `255` は完全置換になる
- UI / 操作メモ:
  - segmented button は `.canvas-selection-overlay` の下辺ラベルよりさらに下へ置く。
  - overlay は従来どおり overflow-visible のままにする。
  - ボタン操作で move / resize が始まらないようにする。
    - ボタン側で `preventDefault` / `stopPropagation` を先に処理して、overlay の drag 開始へ流さない。
- パレット同期:
  - 確定時は既存の共通パレット同期をそのまま使う。
  - 維持条件:
    - `removeUnusedColors: false`
    - `addUsedColors: true`
  - 新しく使われた色は追加する。
  - 不要になった既存スウォッチは削除しない。
- 実装分割案:
  1. `FloatingCompositeMode` 型と sidecar 保存 / 復元を追加する。
  2. `blitBlockOnCanvas(...)` を、モード指定付きの共通合成 helper へ置き換える。
  3. 既存の floating state の流れは保ったまま、現在の合成モードを通せるようにする。
  4. overlay に segmented button と誤操作防止のイベントガードを追加する。
  5. モード変更時にプレビューを即時再計算する。
- 確認観点:
  - 内部コピー貼り付けで `置換 / ブレンド` の両方が正しくプレビューされる。
  - 外部クリップボード画像貼り付けでも同様に動く。
  - 選択範囲ドラッグ移動でも `置換 / ブレンド` の両方が正しく動く。
  - `alpha = 0` は `ブレンド` 時に貼り付け先を変えない。
  - `alpha = 255` は `ブレンド` でも置換結果と一致する。
  - toggle を押しても move / resize が始まらない。
  - 確定結果が最後に見えていたプレビューと一致する。
  - 保存時に `editor.floatingCompositeMode` が書かれ、読込時に復元される。

## 15. Issue #46 仕様メモ（2026-04-06）
- 目的:
  - パレットに 2 種類の並び順モードを追加する。
    - sidecar 保存 / 読込で復元される手動並び替えモード
    - 画面表示だけを変える自動ソートモード
  - パレットカード内の新規タブから、モードと自動ソート条件を切り替えられるようにする。
- 前提:
  - 先に `#56 refactor: パレットスウォッチに安定IDを導入する` を完了する。
  - #46 は、stable な swatch identity が入った前提で進める。
- 現状の実装起点:
  - `src/components/sidebar/SidebarPaletteSection.tsx`
    - 現状はパレットグリッド表示と、選択 / 編集 / 追加 / 削除 UI を持っている
  - `src/hooks/usePaletteManagement.ts`
    - 追加 / 編集 / 削除 / 統合と、Undo / 未保存化 / toast 更新を持っている
  - `shared/sidecar.ts`, `src/hooks/useDocumentFileActions.ts`
    - 現状は `document.palette.entries` と既存 editor UI 状態を保存している
  - 既存の drag-and-drop 実装例:
    - `src/hooks/usePixelReferences.ts`
    - `src/components/sidebar/SidebarPreviewSection.tsx`
- 実装ブレを防ぐための判断:
  - React state 上の `palette` は、常に「保存される手動順」を表す canonical order とする。
  - Save 時は常に、その canonical order を `document.palette.entries` へ保存する。
  - Load 時は、その手動順をそのまま復元する。
  - 自動ソートは canonical order から導出する表示専用モードで、sidecar メタには保存しない。
  - `New` / `Open` 後の初期表示モードは `手動` に戻す。
  - パレット末尾の `+` 追加ボタンは固定で、手動並び替え対象に含めない。
  - 手動並び替えで変えるのは `palette` 配列順だけにする。
    - キャンバスピクセル、`caption`、`locked`、usage 値は変更しない。
  - `selectedColor` は、対応スウォッチが移動しても、表示モードが変わっても維持する。
  - 手動並び替えは Undo 1 回で戻せる 1 操作とし、未保存変更にする。
  - `手動 / 自動` の切り替えや auto sort key の切り替えは view state なので Undo 対象にしない。
  - 削除は現行フローを維持する。
    - 未使用色は即削除
    - 使用中色は確認後に一致ピクセルを透明化してから削除
    - merge UI 側の複数色削除導線も維持
  - merge UI 表示中は、手動 drag-and-drop 並び替えを無効にする。
- 表示モデル:
  - 手動モード:
    - `displayPalette === palette`
  - 自動モード:
    - `displayPalette = sortPaletteEntries(palette, autoSortKey)`
  - 追加 / 編集 / 削除 / 統合 / PNG 読込 / K-Means 後同期などの既存更新処理は、canonical な `palette` を更新する。
  - 自動モードは、その canonical `palette` から表示順だけを再計算する。
- identity / index の扱い:
  - `#56` 完了後は、スウォッチの安定 identity に `PaletteEntry.id` を使う。
  - 並び順モード導入後は、生の配列 index を durable な識別子として持ち回さない。
  - hover / 参照ラインなどで `paletteIndex` を表示したい場合は、スウォッチ自体は `id` で追い、現在の `displayPalette` から都度 index を解決する方針に寄せる。
    - 手動モードでは手動順 index
    - 自動モードでは自動ソート後の表示 index
- 初版の自動ソート key:
  - `Hue①`
    - `hue -> saturation -> value`
    - 無彩色は先頭へまとめる
  - `Hue②`
    - `hue -> value -> saturation`
    - 無彩色は先頭へまとめる
  - `Saturation①`
    - `saturation -> value -> hue`
    - 無彩色は先頭へまとめる
  - `Saturation②`
    - `saturation -> hue -> value`
    - 無彩色は先頭へまとめる
  - `Value①`
    - `value -> saturation -> hue`
    - 無彩色は先頭へまとめる
  - `Value②`
    - `value -> hue -> saturation`
    - 無彩色は先頭へまとめる
  - 6タブ共通の alpha ルール:
    - 完全透明 (`alpha = 0`) は先頭固定
    - `alpha > 0` 同士では、最後のソートキーとして alpha 降順を使う
  - 初版では `Red` / `Green` / `Blue` は入れない。
    - 系統を見る用途は `Hue` で十分カバーできる
    - 初版 UI と実装判断を増やしすぎないため
  - alpha 比較まで同じなら、canonical な手動順を最終 tie-breaker にして表示を安定させる
- UI 方針:
  - パレットカードの並び順切り替えは、Bootstrap dropdown にする。
    - `Palette`
    - `Hue①`
    - `Hue②`
    - `Saturation①`
    - `Saturation②`
    - `Value①`
    - `Value②`
  - スウォッチ grid は表示したままにして、ドロップダウンだけで並び順モードを切り替える。
  - 概念上は:
    - `Palette` が手動モード
    - それ以外の各タブが、それぞれ対応 key の自動モード
  - 手動モードのときだけ palette grid の drag-and-drop を有効にする。
  - 自動モードでは drag-and-drop を無効にする。
- 実装分割案:
  1. 非永続の表示 state として `paletteOrderMode`, `paletteAutoSortKey` を追加する。
  2. `src/editor/` 配下へ `sortPaletteEntries(...)` helper を追加する。
  3. `SidebarPaletteSection` をタブ対応にして、`displayPalette` ベース描画へ切り替える。
  4. 手動モード時だけ使う DnD 並び替え handler を追加する。
  5. hover / 参照ラインの index 前提を、`id` ベースの identity + display index 解決へ寄せる。
  6. sidecar 往復、load 時のモード初期化、Undo 範囲を確認する。
- 確認観点:
  - 手動モードで drag-and-drop した順が保存され、再読込後も復元される。
  - 自動モードへ切り替えると、指定 key で見た目だけ並び替わる。
  - 自動モードのまま保存して再読込しても、復元されるのは手動順である。
  - 手動モードへ戻すと、最後の canonical 手動順が表示される。
  - 自動モード中に追加 / 編集 / 削除 / merge しても破綻せず、表示順が再計算される。
  - `selectedColor` はモード切り替えや並び替え後も維持される。
  - hover / 参照ラインの palette index 表示が現在の表示順と一致する。
  - merge UI 表示中は手動 DnD が無効になる。
  - 手動並び替えだけが Undo 対象になり、表示モード切り替えは Undo を汚さない。
- 2026-04-06 実装メモ:
  - `src/editor/palette-order.ts` を追加して、HSV ベースの表示ソート（`Hue①` / `Hue②` / `Saturation①` / `Saturation②` / `Value①` / `Value②`）をまとめた。
  - `src/hooks/usePaletteOrdering.ts` を追加して、非永続 UI state を持たせた。
    - `paletteOrderMode`
    - `paletteAutoSortKey`
    - 派生表示用の `displayPalette`
  - `SidebarPaletteSection` は、Bootstrap dropdown で並び順モードを切り替えるようにした。
    - `Palette` は手動順を表示して drag-and-drop を有効にする
    - `Hue①` / `Hue②` / `Saturation①` / `Saturation②` / `Value①` / `Value②` は対応 key の自動ソート表示に切り替える
    - トグルは `bootstrap/js/dist/dropdown` で初期化する
    - 右側に `fa-house` ボタンを置き、`Palette` へ直接戻せるようにする（`Palette` 中は disable）
    - スウォッチ grid は表示したままにする
    - `alpha < 255` のスウォッチには、スウォッチ内に小さい `透` バッジを重ねて表示する
  - `usePixelReferences.ts` は、identity を `PaletteEntry.id` で追いながら、`paletteIndex` は常に `displayPalette` から解決するようにした。
  - `useDocumentFileActions.ts` は、`Open` 後にパレット並び順 view mode を `手動` に戻す。
  - `EditorPaletteMergeBar` は `displayPalette` を受けるようにして、統合候補の並びも現在の表示順へ合わせた。

## 16. Issue #56 仕様メモ（2026-04-06）
- 目的:
  - #46 の並び順モード追加より先に、パレットスウォッチの stable identity を導入する。
- 現状の実装起点:
  - `shared/palette.ts`
    - `PaletteEntry` は現状 `color`, `caption`, `locked` だけを持つ
    - normalize は `color` ベースで重複除去している
  - `src/components/sidebar/SidebarPaletteSection.tsx`
    - パレット UI の操作は `color` と表示 index への依存がまだ強い
  - `src/hooks/usePixelReferences.ts`
    - hovered palette state は現状 `color + index` を持っている
  - `src/hooks/useDocumentFileActions.ts`, `shared/sidecar.ts`
    - sidecar は palette entry をそのまま保存している
- 実装ブレを防ぐための判断:
  - `PaletteEntry` に `id: string` を追加する。
  - `id` はハイフン付き UUID 形式の文字列とする。
  - 生成は `crypto.randomUUID()` を使い、ID 生成のための追加依存は入れない。
  - 検証では UUID の version / variant までは厳密に固定しない。
  - `color` はピクセル色 / 使用数 / 置換対象の意味を保つ。
  - 新規 palette entry を作るすべての経路で `id` を付ける。
    - 初期パレット
    - 手動追加
    - パレット同期での追加
    - GPL import
    - 新スキーマ前提の PNG / sidecar 読込生成
  - 旧 sidecar との後方互換は不要とする。
  - palette metadata の breaking change として扱ってよい。
  - 必要なら `SIDECAR_SCHEMA_VERSION` を上げてよい。
  - 旧 sidecar を開いた場合は、警告して sidecar を無視し、PNG 単体として開ければ十分とする。
  - 同じスウォッチの色編集では `id` を維持する。
  - 現状どおり「同じ color を複数スウォッチとして持たない」前提は維持する。
  - UI identity に関わる処理は `id` ベースへ寄せる。
    - 選択対象
    - hover 対象
    - drag-and-drop 対象
    - merge 選択対象
  - 色意味論の処理は `color` ベースのまま維持する。
    - 使用数集計
    - ピクセル置換
    - 使用位置ジャンプ
- 実装分割案:
  1. `PaletteEntry` と normalize / clone helper を `id` 対応に拡張する。
  2. すべての palette entry 生成経路へ ID 生成 helper を入れる。
  3. sidecar 読込 / 保存を新スキーマ前提へ更新する。
  4. index 前提の UI を、`id` + display index 解決へ寄せる。
  5. #46 が追加移行なしで進められることを確認する。
- 確認観点:
  - メモリ上の全 palette entry が UUID 形式の `id` を持つ。
  - 保存し直すと sidecar の palette entry に `id` が書かれる。
  - 色編集しても同じスウォッチの `id` は変わらない。
  - パレット UI の主要操作が raw index を durable identity として使わなくなる。
- 実装メモ:
  - `SIDECAR_SCHEMA_VERSION` は `2` に上げ、sidecar の palette entry では UUID 形式の `id` を必須にした。
  - パレット hover / 参照ライン / merge 選択 UI は `id` で追跡し、表示 index は必要時に都度解決する形へ寄せた。
  - 使用数集計、ピクセル置換、削除、merge 実行のような色意味論の処理は引き続き `color` で解決する。
