# Handoff: Pebble Sprout — Cowork Agent Mascot

## Overview

**Pebble Sprout** は、Cowork Agent for kintone のチャットパネル UI に組み込むためのマスコットキャラクターです。
Agent の状態（待機・思考中・実行中・承認待ち・完了）に応じて、シルエットを変えずに表情とアニメーションだけで状態を伝えます。

- 軽量（SVG + CSS keyframes のみ、外部依存なし）
- 24px〜160px までシームレスにスケール
- `state` プロップを切り替えるだけでアニメが自動切替
- カラーは Cowork Agent の既存パレット（teal 主役 / cream / amber アクセント / charcoal）に準拠

## About the Design Files

このバンドルに含まれる HTML / JSX ファイルは **デザインリファレンス** です（HTML プロトタイプとして作成）。
そのままプロダクションコードとして取り込むのではなく、対象コードベースの既存環境（React/Vue/その他）と既存のスタイリング規約に合わせて **再実装** してください。

ただし、SVG マークアップ自体（パスや座標、CSS keyframes 定義）はそのまま流用可能です。状態切替のロジックや配置のみコードベースに合わせて書き換えるイメージです。

## Fidelity

**High-fidelity (hifi)**。色・サイズ・タイミング・イージングはすべて確定値です。ピクセルパーフェクトに再現してください。

---

## Component: AnimatedPebbleSprout

### Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `state` | `'idle' \| 'thinking' \| 'working' \| 'waiting' \| 'done'` | `'idle'` | 表示する状態 |
| `size` | `number` | `120` | px 単位の幅・高さ |

### SVG 構造

ベースの viewBox は `0 0 100 100`。要素の z 順（背面→前面）：

1. **左の葉**（楕円）: `cx=-9 cy=-4 rx=9 ry=14`、`transform: translate(50, 28) rotate(-16deg)` 起点
2. **右の葉**（楕円）: `cx=9 cy=-4 rx=9 ry=14`、`transform: translate(50, 28) rotate(16deg)` 起点
3. **茎**（rect）: `x=48.5 y=22 w=3 h=12 rx=1`
4. **本体**（rect）: `x=14 y=32 w=72 h=58 rx=22`
5. **頬ドット 2つ**: `cx=26,74 cy=68 r=3`、fill amber、opacity 0.55
6. **顔パーツ**（state によって変化、後述）
7. **スパークル**（done 時のみ）

葉の楕円中心は親の `transform="translate(50 28)"` を起点とした相対座標で、`rotate()` を加えて葉が傾くようにしています。

### Face / 状態別の顔パーツ

すべて `fill=cream (#faf2dc)` または `stroke=cream` を使用。

| 状態 | 顔パーツ |
|---|---|
| **idle** | 目: rect `x=34/60 y=56 w=6 h=10 rx=3` × 2、口: `path d="M44 72 Q50 76 56 72" stroke-width=2` |
| **thinking** | 目: 細く `rect y=60 h=2` × 2、思考バブル 3つ（amber #ffbf00 円: r=2/2.6/3.4）が右上に順番にポップ |
| **working** | 目: rect `x=32/58 y=58 w=10 h=6 rx=1`（横長スクリーン状）、内部に amber 走査バー、口の下に cream のローダーバー＋amber プログレス |
| **waiting** | 目: idle と同じ、口の代わりに amber の感嘆符（`rect y=72 h=6` + `rect y=80 h=2`）が点滅 |
| **done** | 両目とも笑顔の弧、口は大きな笑顔。amber スパークル 3つが周囲で点滅 |

---

## Animations / CSS keyframes

すべて `animated-pebble-sprout.jsx` に定義済み。グローバルに 1 度だけ inject される `<style id="ps-anim-style">` で管理しています（再実装時は CSS Module / Styled Components / global stylesheet などコードベースに合わせてください）。

### Body wrapper animation（全体ラッパに適用）

| State | Animation | Duration | Easing | Iteration |
|---|---|---|---|---|
| idle | `ps-breathe` (translateY 0→-2px) | 3.6s | ease-in-out | infinite |
| thinking | `ps-breathe` | 2.4s | ease-in-out | infinite |
| working | `ps-toddle` (translateX ±1.5px + rotate ±2deg) | 0.7s | ease-in-out | infinite |
| waiting | `ps-pulse` (scale 1→1.03) | 1.4s | ease-in-out | infinite |
| done | `ps-hop` (translateY -8px + scaleY squash/stretch) | 1s | ease-out | infinite |

### Leaf animations

| State | Left leaf | Right leaf | Duration |
|---|---|---|---|
| idle | sway -14°↔-20° | sway 14°↔20° | 4s |
| thinking | jitter -8°↔-22° | jitter 8°↔22° | 1.4s |
| working | sway | sway | 2s |
| waiting | sway slow | sway slow | 5s |
| done | spread to -32° then settle to -22° | spread to 32° then settle to 22° | 1s |

### Face element animations

- **idle 瞬き**: 目に `ps-blink` (scaleY 1→0.05) 4s ease-in-out infinite。`transform-origin` を目の中心 `(37,61)` `(63,61)` に設定。
- **thinking バブル**: 3つの円を `ps-bubble-1/2/3` で順番に opacity + scale ポップアップ、合計 1.8s ループ。
- **working 走査バー**: `ps-scan-bar` (translateX -12px→12px) 1.2s linear infinite。両目に 0.1s ディレイ差。
- **working ローダー**: `ps-scan` (opacity 0.3→1→0.3) 1.2s ease-in-out infinite。
- **waiting アラート**: `ps-alert-blink` (opacity 0.4↔1) 1s ease-in-out infinite。
- **done スパークル**: `ps-sparkle` (opacity 0→1→0 + scale 0.4→1→0.4) 1s ease-in-out infinite。3つに 0s/0.3s/0.5s のディレイ差。

完全なキーフレーム定義は `animated-pebble-sprout.jsx` の `injectPSAnim()` 内を参照してください。

---

## Design Tokens

### Colors

| Token | Hex | 用途 |
|---|---|---|
| teal | `#0d9488` | 本体 / 葉（メインカラー） |
| teal deep | `#0a7a70` | （未使用、シャドウが必要な場合の予備） |
| cream | `#faf2dc` | 顔パーツ・口 |
| amber | `#ffbf00` | 頬ドット・思考バブル・走査ライン・スパークル・アラート |
| charcoal | `#231200` | テキスト（コンポーネント外で使用） |

### Sizes

- 推奨利用サイズ: 24 / 32 / 40 / 64 / 96 / 120 / 160 px
- 24px 未満は表情が潰れるため非推奨
- アバター（チャットメッセージ横）は 32px、ヘッダーは 40px、ヒーロー（welcome 画面）は 120-160px

### Animation timing 原則

- idle 系は 3-5s でゆったり、無意識に視界に入ってもうるさくない
- thinking / working は 1-2s で「何かしている感」
- done は 1s で完結（無限ループでも違和感ないよう）

---

## State Mapping (Cowork Agent 連携)

```jsx
const status = useMemo(() => {
  if (toolCallInProgress)        return 'working';
  if (waitingForApproval)        return 'waiting';      // HITL 中
  if (lastResultJustReturned)    return 'done';         // 数秒で idle に戻す
  if (agentIsReasoning)          return 'thinking';
  return 'idle';
}, [toolCallInProgress, waitingForApproval, lastResultJustReturned, agentIsReasoning]);

<AnimatedPebbleSprout state={status} size={40} />
```

**done → idle の自動遷移を推奨**: 完了アニメは 3-5 秒後に自動で idle に戻すと自然です（永久に跳ね続けるとうるさい）。

---

## Placement Guidelines

### チャットパネル

1. **ヘッダー（40px）** — Agent 名の左、現在状態を反映
2. **メッセージのアバター（32px）** — Agent からのメッセージ吹き出しの左。最新メッセージのみ現在状態、過去メッセージは `idle` 固定
3. **空状態 / ウェルカム画面（120px）** — チャット履歴ゼロの時に大きく表示
4. **ローディング状態** — 「実行中…」のテキスト横に 24px で

### 避けるべき配置

- ボタン内アイコン（スケールが小さすぎる）
- リスト項目の bullet（マスコット性が薄れる）

---

## Accessibility

- アニメーションは装飾的なので、`@media (prefers-reduced-motion: reduce)` で全アニメを無効化／短縮することを推奨
- SVG にはコンポーネント全体で `role="img"` と `aria-label="Cowork Agent — {状態}"` を付与
- 状態変化は別途テキストでも伝える（このマスコットは情報伝達の唯一の手段にしない）

```css
@media (prefers-reduced-motion: reduce) {
  [class*="ps-"] {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

---

## Files in this bundle

| File | 役割 |
|---|---|
| `animated-pebble-sprout.jsx` | **メインコンポーネント**。React 用。SVG マークアップ＋keyframes inject。これを再実装の起点に |
| `Pebble Sprout Animations.html` | デモページ。5状態の動作確認＋チャットパネル組み込みプレビュー |
| `Flat Characters Reference.html` | キャラクター案 9種の比較ビュー（Pebble Sprout 採用に至った検討ログ） |
| `flat-characters.jsx` | 上記比較ビューで使われた静的版。アニメ無し |

---

## Recreating in Target Codebase

1. **React の場合**: `animated-pebble-sprout.jsx` の `AnimatedPebbleSprout` 関数をそのまま import 可能。`injectPSAnim()` の代わりに CSS-in-JS / CSS Module に移植。
2. **Vue / Svelte の場合**: SVG マークアップとアニメーション定義を移植。`state` を prop として受け取り条件分岐
3. **素の Web Component の場合**: SVG を Shadow DOM に、keyframes を `<style>` で同梱

いずれの場合も:
- 色は CSS variables（`--ps-teal` など）にすると design system に統合しやすい
- `transformOrigin` の設定が崩れやすいので、葉の `transform-box: fill-box` 指定は維持してください
