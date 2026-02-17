# DlaPixy (Electron + React + TypeScript)

## セットアップ

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
```

## 配布物作成 (macOS / Windows)

```bash
npm run dist
```

## 開発引き継ぎドキュメント

- English: `DEVELOP.md`
- 日本語: `DEVELOP.ja.md`

## 実装済み機能

- 256x256 初期キャンバス（サイズ変更可）+ 8px / 16px / 32px 補助グリッド線
- 編集画面の拡大 / 縮小（ボタン）
- パレット選択・色追加
- 描画 / 消去 / 矩形選択
- 選択範囲のコピー / 削除
- Undo
- PNG 保存 / 読込
- PNG `tEXt` チャンクに編集メタ情報保存 (`dla-pixy-meta`)
