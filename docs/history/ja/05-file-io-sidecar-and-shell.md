# ファイル I/O、Sidecar、Shell

## ファイル操作フロー
- ネイティブ `File` メニューで次を扱う:
  - New
  - Open
  - Save
  - Save As
  - Recent Files
- 最終利用ディレクトリを保持し、次回ダイアログの初期位置に使う。
- Recent Files は上限管理、重複排除、存在しない path の除外を行う。
- `foo.png` を開くと、同階層の `foo.dla-pixy.json` も読み込もうとする。
- sidecar が無ければ PNG 単体として開く。
- sidecar が壊れていれば警告して、PNG 単体読込へフォールバックする。
- 保存時は既存 PNG metadata chunk を維持する。
- DlaPixy の editor state 復元は sidecar JSON のみを見る。

## Sidecar 契約
PNG の隣に `<filename>.dla-pixy.json` として保存する。

現在の shape:
```ts
{
  dlaPixy: {
    schemaVersion: 2,
    document: {
      palette: {
        entries: PaletteEntry[]
      },
      slices: EditorSlice[]
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
      lastTool: 'pencil' | 'eraser' | 'fill' | 'select' | 'slice'
    }
  }
}
```

ルール:
- `PaletteEntry` は UUID 形式の安定 `id` を必須にする。
- `EditorSlice` は永続 slice 矩形と optional な export settings を持つ。
- 旧 sidecar 形式は不正として扱う。

## メニューと Renderer の役割
- ネイティブ `Canvas` メニュー:
  - キャンバスサイズ
  - グリッド線間隔
  - 透過背景
  - 表示倍率
  - slice 関連コマンド
  - slice export 入口
- ネイティブ `Palette` メニュー:
  - GPL import / export
  - K-Means 起動
- 実際の入力 UI は renderer モーダル側で持つ。

## 透過背景と Shell UI
- 透過背景モード:
  - `white-check`
  - `black-check`
  - `white`
  - `black`
  - `magenta`
- 選択中モードはネイティブメニューと renderer state で同期する。
- 適用先:
  - メイン編集キャンバス
  - sidebar preview 群
  - renderer モーダル内プレビュー
- 透過背景モードは sidecar editor メタには入るが、PNG metadata そのものには入らない。
- status 表示は toast 化し、常設 sidebar status 行は使わない。
- footer status row が旧 sidebar status を置き換えている。
