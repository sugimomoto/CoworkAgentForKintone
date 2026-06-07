# Cowork Agent for kintone — プリセットエージェント一覧 UX 対応まとめ

最終更新: 2026-06-06 / 決定: **案 A（アコーディオン）採用**

---

## 1. 結論

業務ユーザー向けの「2 クリックで価値が出る」空状態 UX として、**案 A：アコーディオン縦リスト**を採用。
4 案（A アコーディオン / B タブ / C 全件スタック / D カルーセル）を比較し、
**狭幅 360px・低認知負荷・10 個以上への拡張・2 クリック達成**を唯一すべて満たすため。

---

## 2. 成果物ファイル

| ファイル | 種別 | 内容 |
|---|---|---|
| `Preset Agents — UX Exploration.html` | 検討用 | 4 案比較 / 推奨案の文脈・狭幅・拡張検証 / 遷移ストーリーボード / エッジケース / 比較表・設計メモ（design canvas） |
| `Preset Agent Panel — Prototype.html` | 動作プロト | kintone 画面内で案 A が実際に動く（クリック→チャット遷移→ストリーミング→成果物） |
| `handoff/agents.ts` | 実装 | 型定義 + Phase 1 カタログ + `publicAgents` / `defaultOpenId` |
| `handoff/AgentGlyph.tsx` | 実装 | `iconKind` 網羅アイコン（Tailwind） |
| `handoff/PresetAgentLanding.tsx` | 実装 | **本体**。アコーディオン一覧 + エッジケース分岐 |
| `handoff/README.md` | ドキュメント | 差し込み方・依存・設計要点 |

補助 jsx（`preset-agents.jsx` / `preset-layouts.jsx` / `prototype-panel.jsx` / `wedge-header.jsx` / `design-canvas.jsx`）は検討用 HTML の描画基盤。**本実装は `handoff/` を正とする。**

---

## 3. 確定した設計判断

- **空状態では一覧が Agent ピッカーを兼ねる** → Header はブランド表示のみ。ピッカー UI を二重に出さない。プロンプト押下でエージェント確定 → 以降の切替は Header ピッカーに一本化。履歴が空に戻れば再び一覧へ。
- **既定エージェント (`isDefault`) を初期展開** → 初回 1 クリックで実行。
- **自由入力の逃げ道は常時確保** → 下部 Composer（主導線）＋ UtilityBar「新しい会話 / 履歴」。
- **遷移マイクロインタラクション**：即切替 + 軽いフェード（160ms）。押下ボタンは accent 塗り＋わずかに沈む（`active:scale-[0.99]`）。
- **スタイル**：Tailwind / アクセント `teal-600` / 角丸 10〜12px / 影は最小・境界線で領域分け / 本文 12.5px・見出し 15px・細字 10.5px。

---

## 4. 統合コントラクト（重要）

`PresetAgentLanding` の外部依存は **`onSelectPrompt(agent, prompt)` の 1 本のみ**。

```tsx
<PresetAgentLanding agents={PRESET_AGENTS} onSelectPrompt={(agent, prompt) => {
  selectAgent(agent.id);                 // エージェント選択
  if (prompt) sendUserMessage(prompt);   // user message 送信 → ストリーミング開始
  else focusComposer();                  // サンプル 0 個 → 自由入力へ
}} />
```

- **チャット遷移と送信は呼び出し側**（`messages` が入れば既存 MessageList 表示に切り替わる前提）。
- `WelcomeMessage` を、履歴空 & セッション未開始のときだけ `PresetAgentLanding` に差し替える。

---

## 5. エッジケース（`PresetAgentLanding` 内で処理済み）

| ケース | 挙動 |
|---|---|
| サンプル 0 個 | 行展開時に「自由入力で話しかける」CTA |
| エージェント 1 個のみ | リスト chrome 省略・プロンプト直接提示 |
| 10 個以上（#46 後） | 6 個超で検索ボックス自動表示（`searchable` 強制可）。行は縦積みで破綻しない |
| 幅 360px ちょうど | 1 カラム固定・余白 12px で成立 |

---

## 6. 未対応 / Claude Code 側で要対応

- [ ] **ストリーミング応答はプロト内のダミー**（`prototype-panel.jsx` の `buildScript`）。本物の Claude Managed Agents 出力へ配線が必要。
- [ ] **`PRESET_AGENTS` はサンプルデータ**。admin 設定 API から取得し同じ `PresetAgent[]` 型へ詰める（`visibility==='public'` のみ一覧表示）。
- [ ] Customizer 系の成果物（生成 JS）のプレビュー / 適用フローは未設計。
- [ ] `teal-600` を `tailwind.config` の `accent` トークンに寄せる場合は `teal-*` を置換。
- [ ] Header ピッカー（選択後の切替 UI）は既存コンポーネント側との結線が必要。
