# メモとバックログ

## 既知の改善候補
- クリップボード連携はまだハイブリッド。
  - 正確な貼り付け挙動のための内部ピクセルクリップボード
  - OS 画像クリップボード書き込み

## 次セッション向けメモ
1. まず `DEVELOP.md` と `DEVELOP.ja.md` を読む。
2. `src/App.tsx` を早めに確認し、UI を触るなら `src/components/EditorSidebar.tsx` と `src/components/EditorToolbar.tsx` も見る。
3. エディタ全体の大改造より、小さい差分を優先する。
4. メタ情報スキーマは current の `EditorMeta` / sidecar 契約と揃える。
5. 右端縦ツールバー + FontAwesome の UI 言語を維持する。
6. リポジトリ管理下の `.ts` / `.tsx` / `.css` では共通 copyright header を残す。

## ワークスペース注意
- ルートに `+` という stray file がある。
  - path: `/Users/abatan/Develop/DlaPixy/+`
  - app runtime では未使用
  - 削除はユーザー確認後のみ

## GitHub バックログのスナップショット
- ラベル運用:
  - このリポジトリの GitHub Issue ラベルは日本語で揃える
  - 例: `機能追加`, `仕様変更`, `高`, `中`, `低`
- この履歴メモで参照している主な issue:
  - `#2` 貼り付け確定 / キャンセル
  - `#3` クリップボード責務分離
  - `#33` キャンバスサイズ変更で画像が消える問題
  - `#38` slice / export
  - `#42` パレット同期の共通化
  - `#46` パレット並び順モード
  - `#47` 複数スウォッチ merge UI
  - `#48` App Store / サブスク対応
  - `#49` OSS ライセンス画面
  - `#50` 拡大縮小付き貼り付け
  - `#51` PNG metadata から sidecar JSON への移行
  - `#52` floating 合成モード
  - `#56` パレット項目の安定 ID
