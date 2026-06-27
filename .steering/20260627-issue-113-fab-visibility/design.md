# Issue #113 — FAB 起動アイコンの視認性調整

## 原因
FAB の影が `shadow-[0_1px_3px_rgba(0,0,0,0.04)]`（alpha 0.04）と極端に薄く、立体感・コントラストが出ず
半透明のように見え、コンテンツの多い kintone 画面で背景に溶け込んでいた（opacity 指定は無い）。

## 修正（App.tsx の Fab、className のみ）
- 影を一般的な FAB 相当の二層に強化:
  `shadow-[0_4px_12px_rgba(0,0,0,0.18),0_2px_4px_rgba(0,0,0,0.12)]`
- 背景から分離する微細な輪郭: `ring-1 ring-black/5`（白系の混んだ背景でも縁が立つ）
- hover で影も持ち上げる: `hover:shadow-[0_6px_16px_rgba(0,0,0,0.24),0_3px_6px_rgba(0,0,0,0.16)]`
- transition を `transition-[transform,box-shadow]` にして影変化も滑らかに。
- 位置(bottom/right 20px)・サイズ(56px)・`hover:scale-105`・背景 `var(--cw-accent)`(teal)・白アイコンは維持。

## テーマ
accent は light/dark とも `#0d9488`。影は rgba 黒で両テーマ共通に効く。

## 検証
- tsc / eslint クリーン、App.test 11 件通過、build で desktop.css に影クラス生成を確認。
- 実機（kintone 一覧/詳細, light/dark）での見え方は要目視（自動スクショは生成しない方針）。

## 受け入れ条件
- [x] 影強化＋ring で背景から分離（コード上は達成。実機目視で最終確認）
- [x] hover 挙動・位置・サイズ維持
- [ ] light/dark 実機目視（ユーザー確認）
